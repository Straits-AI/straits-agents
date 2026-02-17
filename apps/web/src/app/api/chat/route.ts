import { streamText, Message } from "ai";
import { getDB, getCtx } from "@/lib/db";
import { NextResponse } from "next/server";
import { searchDocuments, SearchResult } from "@/lib/rag";
import { checkPaymentRequired } from "@/lib/x402";
import { resolveModel, deductPlatformCost, refundPlatformCost, InsufficientBalanceError } from "@/lib/llm-providers";
import { getSession } from "@/lib/auth";
import { loadMemoryContext, getMemoryConfig, isRememberCommand, storeExplicitMemory } from "@/lib/memory";
import { resolveAgentTools, getToolRows, buildToolInstructions } from "@/lib/tools";
import { getActiveSkillInstructions, formatSkillsForPrompt } from "@/lib/skills";

interface AgentRow {
  system_prompt: string;
  name: string;
}

export async function POST(req: Request) {
  try {
    const { messages, sessionId, agentId, useRag = true } = await req.json();

    // Validate messages
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages are required" }, { status: 400 });
    }

    // Get agent's system prompt from database
    let systemPrompt = "You are a helpful AI assistant.";
    let agentName = "Assistant";

    // Resolve agent by id or slug
    let resolvedAgentId = agentId;
    if (agentId) {
      try {
        const db = await getDB();
        const agent = await db
          .prepare("SELECT id, system_prompt, name FROM agents WHERE (id = ? OR slug = ?) AND is_active = 1")
          .bind(agentId, agentId)
          .first<AgentRow & { id: string }>();

        if (agent) {
          resolvedAgentId = agent.id;
          systemPrompt = agent.system_prompt;
          agentName = agent.name;
        }
      } catch (error) {
        console.error("Failed to fetch agent:", error);
      }
    }

    // Get authenticated user (optional — anonymous users still work)
    let userId: string | null = null;
    try {
      const userSession = await getSession();
      userId = userSession?.userId ?? null;
    } catch {
      // Auth not available — continue as anonymous
    }

    // Load memory context for authenticated users
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

    // Normalize messages to ensure they have IDs
    const normalizedMessages: Message[] = messages.map((m: { id?: string; role: string; content: string }, idx: number) => ({
      id: m.id || `msg-${idx}-${Date.now()}`,
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    }));

    // Build context from session history if available
    let contextMessages: Message[] = normalizedMessages;

    if (sessionId) {
      try {
        const db = await getDB();
        const result = await db
          .prepare(
            `SELECT role, content FROM messages
             WHERE session_id = ?
             ORDER BY created_at ASC
             LIMIT 20`
          )
          .bind(sessionId)
          .all<{ role: string; content: string }>();

        // Prepend historical messages for context
        if (result.results.length > 0) {
          const historyMessages: Message[] = result.results.map((row, idx) => ({
            id: `history-${idx}`,
            role: row.role as "user" | "assistant",
            content: row.content,
          }));
          // Only use history if current messages don't already include it
          if (normalizedMessages.length <= 1) {
            contextMessages = [
              ...historyMessages,
              ...normalizedMessages.filter((m) => !m.id.startsWith("history-")),
            ];
          }
        }
      } catch (error) {
        console.error("Failed to fetch session history:", error);
      }
    }

    // Check if payment is required (x402)
    if (sessionId && resolvedAgentId) {
      try {
        const paymentCheck = await checkPaymentRequired(sessionId, resolvedAgentId);
        if (paymentCheck.required && paymentCheck.paymentResponse) {
          return NextResponse.json(paymentCheck.paymentResponse, {
            status: 402,
            headers: {
              "X-Payment-Required": "true",
              "X-Payment-Id": paymentCheck.paymentResponse.paymentId,
            },
          });
        }

        // Increment queries_used for free query usage tracking
        const db = await getDB();
        await db
          .prepare("UPDATE sessions SET queries_used = queries_used + 1, updated_at = ? WHERE id = ?")
          .bind(new Date().toISOString(), sessionId)
          .run();
      } catch (error) {
        console.error("Payment check error:", error);
        // Fail closed: reject request if payment check fails
        return NextResponse.json(
          { error: "Payment verification unavailable. Please try again." },
          { status: 503 }
        );
      }
    }

    // RAG: Search for relevant documents
    let ragContext = "";
    let citations: SearchResult[] = [];

    if (useRag && resolvedAgentId) {
      try {
        // Get the latest user message for search
        const lastUserMessage = [...normalizedMessages].reverse().find((m) => m.role === "user");
        if (lastUserMessage) {
          citations = await searchDocuments(resolvedAgentId, lastUserMessage.content, 3);

          if (citations.length > 0) {
            ragContext = "\n\n## Relevant Information:\n" +
              citations
                .map((c, i) => `[${i + 1}] ${c.title}:\n${c.content}`)
                .join("\n\n");
          }
        }
      } catch (error) {
        console.error("RAG search error:", error);
        // Continue without RAG if it fails
      }
    }

    // Resolve LLM model (BYOK or platform default)
    let resolved;
    try {
      resolved = await resolveModel(resolvedAgentId);
    } catch (error) {
      if (error instanceof InsufficientBalanceError) {
        return NextResponse.json(
          { error: error.message },
          { status: 402 }
        );
      }
      throw error;
    }

    // Check for explicit "remember" commands from the latest user message
    const lastUserMsg = normalizedMessages[normalizedMessages.length - 1];
    if (userId && resolvedAgentId && sessionId && lastUserMsg?.role === "user" && isRememberCommand(lastUserMsg.content)) {
      try {
        const ctx = await getCtx();
        ctx.waitUntil(storeExplicitMemory(userId, resolvedAgentId, lastUserMsg.content, sessionId));
      } catch (error) {
        console.error("Failed to trigger explicit memory storage:", error);
      }
    }

    // Build system prompt with RAG context and memory
    let fullSystemPrompt = `${systemPrompt}\n\nYou are ${agentName}. Be helpful, accurate, and concise.`;

    if (memoryContext) {
      fullSystemPrompt += `\n\n${memoryContext}`;
    }

    if (ragContext) {
      fullSystemPrompt += `\n\nUse the following information to help answer the user's question. Cite sources using [1], [2], etc. when referencing information.${ragContext}`;
    }

    // Load skills for system prompt
    try {
      const skills = await getActiveSkillInstructions(resolvedAgentId);
      if (skills.length > 0) {
        fullSystemPrompt += "\n\n" + formatSkillsForPrompt(skills);
      }
    } catch (error) {
      console.error("Failed to load skills:", error);
    }

    // Resolve tools for this agent
    let tools: Record<string, import("ai").CoreTool> | undefined;
    let maxSteps: number | undefined;
    try {
      const toolContext = { sessionId: sessionId || "anon", userId, agentId: resolvedAgentId };
      const resolvedTools = await resolveAgentTools(resolvedAgentId, toolContext);
      if (Object.keys(resolvedTools).length > 0) {
        tools = resolvedTools;
        maxSteps = 5;
        // Add tool descriptions to system prompt
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
        return NextResponse.json(
          { error: "Agent creator has insufficient platform balance" },
          { status: 402 }
        );
      }
    }

    const result = streamText({
      model: resolved.model,
      system: fullSystemPrompt,
      messages: contextMessages,
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

    // Add citations to the response headers
    const response = result.toDataStreamResponse();
    if (citations.length > 0) {
      response.headers.set("X-Citations", JSON.stringify(citations.map((c) => ({
        id: c.chunkId,
        title: c.title,
        excerpt: c.content.slice(0, 200),
        score: c.score,
      }))));
    }

    return response;
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Failed to process chat request" },
      { status: 500 }
    );
  }
}
