/**
 * Session Types - Conversation session management
 */

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  /** Citations extracted from RAG */
  citations?: Citation[];
  /** Tool calls made during this message */
  toolCalls?: ToolCall[];
  /** Timestamp */
  createdAt: Date;
  /** Token count for this message */
  tokenCount?: number;
}

export interface Citation {
  id: string;
  /** Source document ID */
  documentId: string;
  /** Document title */
  title: string;
  /** Relevant excerpt */
  excerpt: string;
  /** Page or section number */
  location?: string;
  /** Relevance score from vector search */
  score: number;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  status: 'pending' | 'completed' | 'failed';
}

export interface SessionMemory {
  /** Short-term memory (recent messages) */
  shortTerm: Message[];
  /** Summarized context from older messages */
  summary?: string;
  /** Key facts extracted from conversation */
  facts: string[];
  /** User preferences detected */
  preferences: Record<string, unknown>;
}

export interface GeneratedArtifact {
  id: string;
  type: ArtifactType;
  title: string;
  content: string;
  format: 'markdown' | 'json' | 'html';
  /** Structured data for the artifact */
  data?: Record<string, unknown>;
  createdAt: Date;
}

export type ArtifactType =
  | 'prd' // Product Requirements Document
  | 'proposal' // Sales Proposal
  | 'postmortem' // Incident Postmortem
  | 'roadmap' // Product Roadmap
  | 'sop' // Standard Operating Procedure
  | 'stance-map' // Opinion Research Summary
  | 'order' // Restaurant/Retail Order
  | 'ticket'; // Support Ticket

export interface Session {
  id: string;
  agentId: string;
  /** User ID if authenticated */
  userId?: string;
  /** Anonymous session token */
  sessionToken?: string;
  messages: Message[];
  memory: SessionMemory;
  /** Number of queries used in this session */
  queriesUsed: number;
  /** Generated artifact if any */
  generatedArtifact?: GeneratedArtifact;
  /** Session state for multi-step flows */
  state?: SessionState;
  /** Payment status */
  paymentStatus: PaymentStatus;
  createdAt: Date;
  updatedAt: Date;
  /** When the session expires */
  expiresAt: Date;
}

export interface SessionState {
  /** Current step in a multi-step flow */
  currentStep?: string;
  /** Collected data from the flow */
  collectedData: Record<string, unknown>;
  /** Whether confirmation is pending */
  awaitingConfirmation?: boolean;
}

export type PaymentStatus = 'free' | 'prepaid' | 'pay-as-you-go' | 'exhausted';

export interface CreateSessionInput {
  agentId: string;
  userId?: string;
}

export interface AddMessageInput {
  sessionId: string;
  role: MessageRole;
  content: string;
}
