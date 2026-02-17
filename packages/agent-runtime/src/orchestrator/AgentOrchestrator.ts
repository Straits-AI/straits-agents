import type {
  Agent,
  Session,
  Message,
  SessionMemory,
  GeneratedArtifact,
  ToolCall,
} from '@straits/core';
import { generateId, addMessageToMemory, SESSION_CONFIG } from '@straits/core';
import type { MemoryManager } from '../memory/MemoryManager';
import type { ToolRegistry } from '../tools/ToolRegistry';
import type { PromptEngine } from '../prompts/PromptEngine';
import type { OutputGenerator } from '../output/OutputGenerator';

export interface OrchestratorConfig {
  memoryManager: MemoryManager;
  toolRegistry: ToolRegistry;
  promptEngine: PromptEngine;
  outputGenerator: OutputGenerator;
}

export interface MessageContext {
  session: Session;
  agent: Agent;
  userMessage: string;
}

export interface OrchestratorResult {
  response: string;
  citations?: Array<{ id: string; title: string; excerpt: string }>;
  toolCalls?: ToolCall[];
  artifact?: GeneratedArtifact;
  updatedMemory: SessionMemory;
  shouldContinue: boolean;
}

/**
 * AgentOrchestrator coordinates the processing of user messages.
 * It manages the flow between memory, tools, prompts, and output generation.
 */
export class AgentOrchestrator {
  private memoryManager: MemoryManager;
  private toolRegistry: ToolRegistry;
  private promptEngine: PromptEngine;
  private outputGenerator: OutputGenerator;

  constructor(config: OrchestratorConfig) {
    this.memoryManager = config.memoryManager;
    this.toolRegistry = config.toolRegistry;
    this.promptEngine = config.promptEngine;
    this.outputGenerator = config.outputGenerator;
  }

  /**
   * Process an incoming user message and generate a response.
   */
  async processMessage(context: MessageContext): Promise<OrchestratorResult> {
    const { session, agent, userMessage } = context;

    // 1. Create user message
    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      content: userMessage,
      createdAt: new Date(),
    };

    // 2. Update memory with user message
    let updatedMemory = addMessageToMemory(
      session.memory,
      userMsg,
      SESSION_CONFIG.MAX_SHORT_TERM_MESSAGES
    );

    // 3. Build context for LLM
    const llmContext = await this.buildLLMContext(agent, updatedMemory, userMessage);

    // 4. Check if tools are needed
    const availableTools = this.toolRegistry.getToolsForAgent(agent.type);
    const toolsNeeded = this.analyzeToolNeeds(userMessage, availableTools);

    // 5. Execute tools if needed
    let toolCalls: ToolCall[] = [];
    let toolResults: Record<string, unknown> = {};

    if (toolsNeeded.length > 0) {
      const toolExecution = await this.executeTools(toolsNeeded, context);
      toolCalls = toolExecution.calls;
      toolResults = toolExecution.results;
    }

    // 6. Generate response using prompt engine
    const promptResult = await this.promptEngine.generateResponse({
      agent,
      memory: updatedMemory,
      userMessage,
      toolResults,
      llmContext,
    });

    // 7. Check if artifact should be generated
    let artifact: GeneratedArtifact | undefined;
    if (this.shouldGenerateArtifact(agent, promptResult.response, session.state)) {
      artifact = await this.outputGenerator.generateArtifact({
        agent,
        session: { ...session, memory: updatedMemory },
        conversationHistory: updatedMemory.shortTerm,
      });
    }

    // 8. Create assistant message
    const assistantMsg: Message = {
      id: generateId(),
      role: 'assistant',
      content: promptResult.response,
      citations: promptResult.citations,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      createdAt: new Date(),
    };

    // 9. Update memory with assistant message
    updatedMemory = addMessageToMemory(
      updatedMemory,
      assistantMsg,
      SESSION_CONFIG.MAX_SHORT_TERM_MESSAGES
    );

    // 10. Extract and store facts/preferences
    updatedMemory = await this.memoryManager.extractAndStoreFacts(updatedMemory, [
      userMsg,
      assistantMsg,
    ]);

    return {
      response: promptResult.response,
      citations: promptResult.citations,
      toolCalls,
      artifact,
      updatedMemory,
      shouldContinue: !artifact, // Stop if artifact was generated
    };
  }

  /**
   * Build context for the LLM including RAG results and memory summary.
   */
  private async buildLLMContext(
    agent: Agent,
    memory: SessionMemory,
    userMessage: string
  ): Promise<string> {
    const contextParts: string[] = [];

    // Add memory summary if exists
    if (memory.summary) {
      contextParts.push(`Previous conversation summary:\n${memory.summary}`);
    }

    // Add extracted facts
    if (memory.facts.length > 0) {
      contextParts.push(`Known facts:\n${memory.facts.map((f) => `- ${f}`).join('\n')}`);
    }

    // Add user preferences
    const prefEntries = Object.entries(memory.preferences);
    if (prefEntries.length > 0) {
      contextParts.push(
        `User preferences:\n${prefEntries.map(([k, v]) => `- ${k}: ${v}`).join('\n')}`
      );
    }

    return contextParts.join('\n\n');
  }

  /**
   * Analyze if any tools are needed based on the user message.
   */
  private analyzeToolNeeds(
    userMessage: string,
    availableTools: Array<{ name: string; triggers: string[] }>
  ): string[] {
    const neededTools: string[] = [];
    const lowerMessage = userMessage.toLowerCase();

    for (const tool of availableTools) {
      if (tool.triggers.some((trigger) => lowerMessage.includes(trigger.toLowerCase()))) {
        neededTools.push(tool.name);
      }
    }

    return neededTools;
  }

  /**
   * Execute the required tools and return results.
   */
  private async executeTools(
    toolNames: string[],
    context: MessageContext
  ): Promise<{ calls: ToolCall[]; results: Record<string, unknown> }> {
    const calls: ToolCall[] = [];
    const results: Record<string, unknown> = {};

    for (const toolName of toolNames) {
      const call: ToolCall = {
        id: generateId(),
        name: toolName,
        arguments: {},
        status: 'pending',
      };

      try {
        const result = await this.toolRegistry.executeTool(toolName, {
          session: context.session,
          agent: context.agent,
          userMessage: context.userMessage,
        });

        call.result = result;
        call.status = 'completed';
        results[toolName] = result;
      } catch (error) {
        call.status = 'failed';
        call.result = error instanceof Error ? error.message : 'Unknown error';
      }

      calls.push(call);
    }

    return { calls, results };
  }

  /**
   * Determine if an artifact should be generated based on conversation state.
   */
  private shouldGenerateArtifact(
    agent: Agent,
    response: string,
    state?: { awaitingConfirmation?: boolean; collectedData: Record<string, unknown> }
  ): boolean {
    // Productivity agents generate artifacts
    if (agent.category !== 'productivity') return false;

    // Check if conversation indicates completion
    const completionIndicators = [
      'here is your',
      "here's your",
      'generated the',
      'created the',
      'document is ready',
      'prd is ready',
      'proposal is ready',
    ];

    const lowerResponse = response.toLowerCase();
    return completionIndicators.some((indicator) => lowerResponse.includes(indicator));
  }
}
