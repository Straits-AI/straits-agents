import type { Session, Message, SessionMemory, GeneratedArtifact } from '@straits/core';
import { generateId, createEmptyMemory, addMessageToMemory, SESSION_CONFIG } from '@straits/core';

export interface Env {
  SESSION_DO: DurableObjectNamespace;
  DB?: D1Database;
  KV?: KVNamespace;
  VECTORIZE?: Vectorize;
  AI?: Ai;
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  ENVIRONMENT: string;
}

interface SessionState {
  session: Session | null;
  lastAccess: number;
}

/**
 * SessionDO is a Durable Object that manages a single chat session.
 * It persists conversation state and handles message processing.
 */
export class SessionDO implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private session: Session | null = null;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;

    // Load session from storage on initialization
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<SessionState>('session');
      if (stored) {
        this.session = stored.session;
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    try {
      // Route handling
      if (method === 'POST' && url.pathname === '/init') {
        return this.handleInit(request);
      }

      if (method === 'POST' && url.pathname === '/message') {
        return this.handleMessage(request);
      }

      if (method === 'GET' && url.pathname === '/session') {
        return this.handleGetSession();
      }

      if (method === 'GET' && url.pathname === '/messages') {
        return this.handleGetMessages();
      }

      if (method === 'POST' && url.pathname === '/artifact') {
        return this.handleSetArtifact(request);
      }

      if (method === 'DELETE' && url.pathname === '/session') {
        return this.handleDeleteSession();
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('SessionDO error:', error);
      return new Response(
        JSON.stringify({
          error: 'Internal Error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  /**
   * Initialize a new session.
   */
  private async handleInit(request: Request): Promise<Response> {
    const body = await request.json() as {
      agentId: string;
      userId?: string;
    };

    if (this.session) {
      return new Response(
        JSON.stringify({ error: 'Session already exists' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_CONFIG.SESSION_EXPIRY_HOURS * 60 * 60 * 1000);

    this.session = {
      id: this.state.id.toString(),
      agentId: body.agentId,
      userId: body.userId,
      sessionToken: `sess_${generateId().replace(/-/g, '')}`,
      messages: [],
      memory: createEmptyMemory(),
      queriesUsed: 0,
      paymentStatus: 'free',
      createdAt: now,
      updatedAt: now,
      expiresAt,
    };

    await this.saveSession();

    return new Response(
      JSON.stringify({
        sessionId: this.session.id,
        sessionToken: this.session.sessionToken,
        expiresAt: this.session.expiresAt,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Add a message to the session.
   */
  private async handleMessage(request: Request): Promise<Response> {
    if (!this.session) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json() as {
      role: 'user' | 'assistant';
      content: string;
      citations?: Array<{ id: string; title: string; excerpt: string; score: number }>;
    };

    const message: Message = {
      id: generateId(),
      role: body.role,
      content: body.content,
      citations: body.citations?.map(c => ({
        ...c,
        documentId: c.id,
        location: undefined,
      })),
      createdAt: new Date(),
    };

    // Add to messages list
    this.session.messages.push(message);

    // Update memory
    this.session.memory = addMessageToMemory(
      this.session.memory,
      message,
      SESSION_CONFIG.MAX_SHORT_TERM_MESSAGES
    );

    // Update query count for user messages
    if (body.role === 'user') {
      this.session.queriesUsed++;
    }

    this.session.updatedAt = new Date();
    await this.saveSession();

    return new Response(
      JSON.stringify({
        messageId: message.id,
        queriesUsed: this.session.queriesUsed,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Get the current session.
   */
  private async handleGetSession(): Promise<Response> {
    if (!this.session) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify(this.session), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Get messages from the session.
   */
  private async handleGetMessages(): Promise<Response> {
    if (!this.session) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        messages: this.session.messages,
        memory: {
          summary: this.session.memory.summary,
          factsCount: this.session.memory.facts.length,
        },
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Set the generated artifact.
   */
  private async handleSetArtifact(request: Request): Promise<Response> {
    if (!this.session) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const artifact = await request.json() as GeneratedArtifact;

    this.session.generatedArtifact = artifact;
    this.session.updatedAt = new Date();
    await this.saveSession();

    return new Response(
      JSON.stringify({ success: true, artifactId: artifact.id }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Delete the session.
   */
  private async handleDeleteSession(): Promise<Response> {
    await this.state.storage.delete('session');
    this.session = null;

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Save session to durable storage.
   */
  private async saveSession(): Promise<void> {
    await this.state.storage.put<SessionState>('session', {
      session: this.session,
      lastAccess: Date.now(),
    });
  }

  /**
   * Alarm handler for session cleanup.
   */
  async alarm(): Promise<void> {
    // Clean up expired sessions
    if (this.session && new Date() > this.session.expiresAt) {
      await this.state.storage.delete('session');
      this.session = null;
    }
  }
}
