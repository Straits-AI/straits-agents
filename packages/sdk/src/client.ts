import type { Agent, Session, Message } from '@straits/core';

export interface StraitsClientConfig {
  apiKey: string;
  baseUrl?: string;
  chainId?: number;
}

export interface ChatOptions {
  agentId: string;
  userId?: string;
  sessionId?: string;
}

export interface ChatResponse {
  sessionId: string;
  message: Message;
  citations?: Array<{ title: string; excerpt: string }>;
}

/**
 * StraitsClient provides methods to interact with the Straits Agents API.
 */
export class StraitsClient {
  private apiKey: string;
  private baseUrl: string;
  private chainId: number;

  constructor(config: StraitsClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.straitsagents.com';
    this.chainId = config.chainId || 84532; // Base Sepolia default
  }

  /**
   * List available agents.
   */
  async listAgents(): Promise<Agent[]> {
    const response = await this.fetch('/api/agents');
    const data = await response.json() as { agents: Agent[] };
    return data.agents;
  }

  /**
   * Get an agent by ID.
   */
  async getAgent(agentId: string): Promise<Agent> {
    const response = await this.fetch(`/api/agents/${agentId}`);
    return response.json() as Promise<Agent>;
  }

  /**
   * Create a new chat session.
   */
  async createSession(options: ChatOptions): Promise<Session> {
    const response = await this.fetch('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({
        agentId: options.agentId,
        userId: options.userId,
      }),
    });
    return response.json() as Promise<Session>;
  }

  /**
   * Send a message in a session.
   */
  async sendMessage(sessionId: string, content: string): Promise<ChatResponse> {
    const response = await this.fetch(`/api/sessions/${sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        role: 'user',
        content,
      }),
    });

    const data = await response.json() as { messageId: string };

    // Return the response
    return {
      sessionId,
      message: {
        id: data.messageId,
        role: 'assistant',
        content: '', // Will be filled by streaming or polling
        createdAt: new Date(),
      },
    };
  }

  /**
   * Get messages from a session.
   */
  async getMessages(sessionId: string): Promise<Message[]> {
    const response = await this.fetch(`/api/sessions/${sessionId}/messages`);
    const data = await response.json() as { messages: Message[] };
    return data.messages;
  }

  /**
   * Get a session by ID.
   */
  async getSession(sessionId: string): Promise<Session> {
    const response = await this.fetch(`/api/sessions/${sessionId}`);
    return response.json() as Promise<Session>;
  }

  /**
   * Internal fetch wrapper with authentication.
   */
  private async fetch(path: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.baseUrl}${path}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' })) as { message: string };
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response;
  }
}
