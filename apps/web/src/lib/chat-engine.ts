/**
 * Shared Chat Engine
 * Core chat pipeline used by both /api/chat (human-facing) and /api/a2a (agent-facing).
 * Handles tools, skills, memory, RAG, and LLM resolution.
 */

import { streamText, generateText, Message } from "ai";
import { getDB, getCtx } from "./db";
import { searchDocuments, SearchResult } from "./rag";
import { resolveModel, deductPlatformCost, refundPlatformCost, InsufficientBalanceError } from "./llm-providers";
import { loadMemoryContext, getMemoryConfig, isRememberCommand, storeExplicitMemory } from "./memory";
import { resolveAgentTools, getToolRows, buildToolInstructions } from "./tools";
import { getActiveSkillInstructions, formatSkillsForPrompt } from "./skills";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ChatPipelineInput {
  agentId: string;
  messages: Message[];
  sessionId: string;
  userId: string | null;
  callDepth?: number;
  callChain?: string[];
  useRag?: boolean;
  stream?: boolean;
}

export interface ChatPipelineResult {
  stream?: ReadableStream;
  text?: string;
  citations: SearchResult[];
}

interface AgentRow {
  id: string;
  system_prompt: string;
  name: string;
}

const MAX_CALL_DEPTH = 3;

// ─── Main Pipeline ──────────────────────────────────────────────────────────

/**
 * Execute the full chat pipeline.
 * Returns either a stream (for human-facing) or text (for A2A/internal calls).
 */
export async function executeChatPipeline(input: ChatPipelineInput): Promise<ChatPipelineResult> {
  const {
    agentId,
    messages,
    sessionId,
    userId,
    callDepth = 0,
    callChain = [],
    useRag = true,
    stream = true,
  } = input;

  // Safety: prevent infinite recursion
  if (callDepth > MAX_CALL_DEPTH) {
    throw new Error(`Maximum call depth (${MAX_CALL_DEPTH}) exceeded`);
  }
  if (callChain.includes(agentId)) {
    throw new Error(`Cycle detected: agent ${agentId} already in call chain`);
  }

  const db = await getDB();

  // Resolve agent
  const agent = await db
    .prepare("SELECT id, system_prompt, name FROM agents WHERE (id = ? OR slug = ?) AND is_active = 1")
    .bind(agentId, agentId)
    .first<AgentRow>();

  if (!agent) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  const resolvedAgentId = agent.id;
  let systemPrompt = agent.system_prompt || "You are a helpful AI assistant.";
  const agentName = agent.name || "Assistant";

  // Resolve LLM model
  let resolved;
  try {
    resolved = await resolveModel(resolvedAgentId);
  } catch (error) {
    if (error instanceof InsufficientBalanceError) {
      throw error;
    }
    throw error;
  }

  // Load memory context
  let memoryContext = "";
  if (userId && resolvedAgentId) {
    try {
      const memConfig = await getMemoryConfig(resolvedAgentId);
      if (memConfig.memory_enabled) {
        memoryContext = await loadMemoryContext(userId, resolvedAgentId, { maxTokens: 800 });
      }
    } catch (error) {
      console.error("Failed to load memory context:", error);
    }
  }

  // RAG search
  let ragContext = "";
  let citations: SearchResult[] = [];

  if (useRag && resolvedAgentId) {
    try {
      const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
      if (lastUserMessage) {
        citations = await searchDocuments(resolvedAgentId, lastUserMessage.content, 3);
        if (citations.length > 0) {
          ragContext = "\n\n## Relevant Information:\n" +
            citations.map((c, i) => `[${i + 1}] ${c.title}:\n${c.content}`).join("\n\n");
        }
      }
    } catch (error) {
      console.error("RAG search error:", error);
    }
  }

  // Check for explicit memory commands
  const lastUserMsg = messages[messages.length - 1];
  if (userId && resolvedAgentId && sessionId && lastUserMsg?.role === "user" && isRememberCommand(lastUserMsg.content)) {
    try {
      const ctx = await getCtx();
      ctx.waitUntil(storeExplicitMemory(userId, resolvedAgentId, lastUserMsg.content, sessionId));
    } catch (error) {
      console.error("Failed to trigger explicit memory storage:", error);
    }
  }

  // Build full system prompt
  let fullSystemPrompt = `${systemPrompt}\n\nYou are ${agentName}. Be helpful, accurate, and concise.`;

  if (memoryContext) {
    fullSystemPrompt += `\n\n${memoryContext}`;
  }

  // Load skills
  try {
    const skills = await getActiveSkillInstructions(resolvedAgentId);
    if (skills.length > 0) {
      fullSystemPrompt += "\n\n" + formatSkillsForPrompt(skills);
    }
  } catch (error) {
    console.error("Failed to load skills:", error);
  }

  if (ragContext) {
    fullSystemPrompt += `\n\nUse the following information to help answer the user's question. Cite sources using [1], [2], etc. when referencing information.${ragContext}`;
  }

  // Resolve tools
  let tools: Record<string, import("ai").CoreTool> | undefined;
  let maxSteps: number | undefined;
  try {
    const toolContext = {
      sessionId,
      userId,
      agentId: resolvedAgentId,
      callDepth,
      callChain: [...callChain, agentId],
    };
    const resolvedTools = await resolveAgentTools(resolvedAgentId, toolContext);
    if (Object.keys(resolvedTools).length > 0) {
      tools = resolvedTools;
      maxSteps = 5;
      const toolRows = await getToolRows(resolvedAgentId);
      fullSystemPrompt += buildToolInstructions(toolRows);
    }
  } catch (error) {
    console.error("Failed to resolve tools:", error);
  }

  // Deduct platform cost BEFORE the LLM call (atomic, prevents race conditions)
  if (!resolved.isByok && resolvedAgentId) {
    const deducted = await deductPlatformCost(resolvedAgentId);
    if (!deducted) {
      throw new InsufficientBalanceError(
        "Agent creator has insufficient platform balance for inference."
      );
    }
  }

  if (stream) {
    // Streaming response (for human-facing HTTP)
    const result = streamText({
      model: resolved.model,
      system: fullSystemPrompt,
      messages,
      tools,
      maxSteps,
      onError: (error) => {
        console.error("AI streaming error:", error);
        // Refund on LLM failure (best-effort)
        if (!resolved.isByok && resolvedAgentId) {
          refundPlatformCost(resolvedAgentId);
        }
      },
    });

    return { stream: result.toDataStreamResponse().body!, citations };
  } else {
    // Non-streaming (for A2A / internal calls)
    try {
      const result = await generateText({
        model: resolved.model,
        system: fullSystemPrompt,
        messages,
        tools,
        maxSteps,
      });

      return { text: result.text, citations };
    } catch (error) {
      // Refund on LLM failure
      if (!resolved.isByok && resolvedAgentId) {
        await refundPlatformCost(resolvedAgentId);
      }
      throw error;
    }
  }
}
