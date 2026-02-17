/**
 * Straits Agents SDK
 * Core client for interacting with Straits Agents API
 */

export interface StraitsConfig {
  apiKey: string;
  baseUrl?: string;
  agentId: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
}

export interface Session {
  id: string;
  agentId: string;
  messages: Message[];
  queriesUsed: number;
}

export interface ChatResponse {
  message: Message;
  sessionId: string;
  citations?: Array<{
    id: string;
    title: string;
    excerpt: string;
    score: number;
  }>;
}

export interface StreamCallbacks {
  onToken?: (token: string) => void;
  onComplete?: (message: Message) => void;
  onError?: (error: Error) => void;
}

export class StraitsAgentClient {
  private config: Required<StraitsConfig>;
  private sessionId: string | null = null;

  constructor(config: StraitsConfig) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl || "https://straits-agents-web.mystraits-ai.workers.dev",
    };
  }

  /**
   * Create a new chat session
   */
  async createSession(): Promise<Session> {
    const response = await fetch(`${this.config.baseUrl}/api/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({ agentId: this.config.agentId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.statusText}`);
    }

    const data = await response.json();
    this.sessionId = data.sessionId;

    return {
      id: data.sessionId,
      agentId: this.config.agentId,
      messages: [],
      queriesUsed: 0,
    };
  }

  /**
   * Send a message and get a response
   */
  async chat(message: string): Promise<ChatResponse> {
    if (!this.sessionId) {
      await this.createSession();
    }

    const response = await fetch(`${this.config.baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: message }],
        agentId: this.config.agentId,
        sessionId: this.sessionId,
      }),
    });

    if (response.status === 402) {
      const paymentRequired = await response.json();
      throw new PaymentRequiredError(paymentRequired);
    }

    if (!response.ok) {
      throw new Error(`Chat request failed: ${response.statusText}`);
    }

    // Read streaming response
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullContent += decoder.decode(value, { stream: true });
      }
    }

    // Parse the streamed response
    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: fullContent,
      createdAt: new Date().toISOString(),
    };

    return {
      message: assistantMessage,
      sessionId: this.sessionId!,
    };
  }

  /**
   * Stream a chat response with callbacks
   */
  async streamChat(message: string, callbacks: StreamCallbacks): Promise<void> {
    if (!this.sessionId) {
      await this.createSession();
    }

    const response = await fetch(`${this.config.baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: message }],
        agentId: this.config.agentId,
        sessionId: this.sessionId,
      }),
    });

    if (response.status === 402) {
      const paymentRequired = await response.json();
      callbacks.onError?.(new PaymentRequiredError(paymentRequired));
      return;
    }

    if (!response.ok) {
      callbacks.onError?.(new Error(`Chat request failed: ${response.statusText}`));
      return;
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";

    if (reader) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullContent += chunk;
          callbacks.onToken?.(chunk);
        }

        callbacks.onComplete?.({
          id: crypto.randomUUID(),
          role: "assistant",
          content: fullContent,
          createdAt: new Date().toISOString(),
        });
      } catch (error) {
        callbacks.onError?.(error as Error);
      }
    }
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Reset the session
   */
  resetSession(): void {
    this.sessionId = null;
  }
}

export class PaymentRequiredError extends Error {
  public paymentDetails: {
    status: 402;
    paymentId: string;
    paymentDetails: {
      amount: number;
      currency: string;
      recipient: string;
      description: string;
    };
  };

  constructor(details: PaymentRequiredError["paymentDetails"]) {
    super("Payment required");
    this.name = "PaymentRequiredError";
    this.paymentDetails = details;
  }
}

// Default export
export default StraitsAgentClient;
