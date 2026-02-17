import type { Agent, AgentType, SessionMemory, Citation } from '@straits/core';
import { AGENT_PROMPTS, type AgentPromptConfig } from './templates';

export interface PromptEngineConfig {
  maxContextTokens?: number;
}

export interface GenerateResponseInput {
  agent: Agent;
  memory: SessionMemory;
  userMessage: string;
  toolResults?: Record<string, unknown>;
  llmContext?: string;
}

export interface GenerateResponseOutput {
  response: string;
  citations?: Citation[];
}

/**
 * PromptEngine manages prompt construction and response generation.
 */
export class PromptEngine {
  private maxContextTokens: number;

  constructor(config: PromptEngineConfig = {}) {
    this.maxContextTokens = config.maxContextTokens ?? 8000;
  }

  /**
   * Build the system prompt for an agent.
   */
  buildSystemPrompt(agent: Agent): string {
    const basePrompt = agent.systemPrompt;
    const agentConfig = AGENT_PROMPTS[agent.type];

    if (!agentConfig) {
      return basePrompt;
    }

    const parts: string[] = [basePrompt];

    // Add role-specific instructions
    if (agentConfig.roleInstructions) {
      parts.push(`\n\n## Role\n${agentConfig.roleInstructions}`);
    }

    // Add output format instructions
    if (agentConfig.outputFormat) {
      parts.push(`\n\n## Output Format\n${agentConfig.outputFormat}`);
    }

    // Add constraints
    if (agentConfig.constraints && agentConfig.constraints.length > 0) {
      parts.push(`\n\n## Constraints\n${agentConfig.constraints.map((c) => `- ${c}`).join('\n')}`);
    }

    return parts.join('');
  }

  /**
   * Build the conversation context for the LLM.
   */
  buildConversationContext(memory: SessionMemory, llmContext?: string): string {
    const parts: string[] = [];

    if (llmContext) {
      parts.push(llmContext);
    }

    // Add recent conversation history
    const recentMessages = memory.shortTerm.slice(-10);
    if (recentMessages.length > 0) {
      const history = recentMessages
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n\n');
      parts.push(`Recent conversation:\n${history}`);
    }

    return parts.join('\n\n---\n\n');
  }

  /**
   * Generate a response (placeholder - actual LLM call happens in worker).
   */
  async generateResponse(input: GenerateResponseInput): Promise<GenerateResponseOutput> {
    // This is a placeholder - actual LLM call is made in the worker
    // The PromptEngine prepares the prompt but doesn't call the LLM directly
    const systemPrompt = this.buildSystemPrompt(input.agent);
    const context = this.buildConversationContext(input.memory, input.llmContext);

    // Return placeholder - worker will use these to call LLM
    return {
      response: '', // Will be filled by worker
      citations: [],
    };
  }

  /**
   * Get the prompt configuration for an agent type.
   */
  getPromptConfig(agentType: AgentType): AgentPromptConfig | undefined {
    return AGENT_PROMPTS[agentType];
  }

  /**
   * Build a prompt for artifact generation.
   */
  buildArtifactPrompt(
    agent: Agent,
    conversationSummary: string,
    collectedData: Record<string, unknown>
  ): string {
    const config = AGENT_PROMPTS[agent.type];
    if (!config?.artifactTemplate) {
      return '';
    }

    let template = config.artifactTemplate;

    // Replace placeholders in template
    for (const [key, value] of Object.entries(collectedData)) {
      const placeholder = `{{${key}}}`;
      template = template.replace(new RegExp(placeholder, 'g'), String(value));
    }

    return `Based on the following conversation, generate the artifact:\n\n${conversationSummary}\n\nCollected Information:\n${JSON.stringify(collectedData, null, 2)}\n\nTemplate:\n${template}`;
  }
}
