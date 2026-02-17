/**
 * Agent Types - Core definitions for AI agents in the marketplace
 */

export type AgentCategory = 'customer-facing' | 'productivity';

export type AgentType =
  // Customer-facing agents
  | 'qr-menu'
  | 'retail'
  | 'support'
  // Productivity agents
  | 'prd-generator'
  | 'sales-proposal'
  | 'postmortem'
  | 'roadmap'
  | 'sop-generator'
  | 'opinion-research';

export type TrustLevel = 'unverified' | 'basic' | 'verified' | 'premium';

export interface PricingModel {
  type: 'free' | 'per-query' | 'subscription' | 'tiered';
  currency: 'USDC';
  /** Price per query in smallest unit (e.g., cents for USDC) */
  pricePerQuery?: number;
  /** Monthly subscription price */
  monthlyPrice?: number;
  /** Free queries before payment required */
  freeQueries?: number;
}

export interface AgentCapability {
  id: string;
  name: string;
  description: string;
  /** Whether this capability requires payment */
  premium?: boolean;
}

export interface Agent {
  id: string;
  /** NFT token ID on the blockchain */
  nftTokenId: string;
  /** Chain ID where the agent is registered */
  chainId: number;
  name: string;
  description: string;
  category: AgentCategory;
  type: AgentType;
  capabilities: AgentCapability[];
  /** Agent's wallet address for receiving payments */
  agentWallet: string;
  pricingModel: PricingModel;
  /** Owner's user ID */
  ownerId: string;
  /** System prompt for the agent */
  systemPrompt: string;
  /** Welcome message shown at start of conversation */
  welcomeMessage: string;
  /** Icon emoji or URL */
  icon: string;
  /** Metadata stored on-chain */
  metadata: AgentMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentMetadata {
  version: string;
  /** IPFS hash for extended metadata */
  ipfsHash?: string;
  /** Tags for discovery */
  tags: string[];
  /** Supported languages */
  languages: string[];
  /** Integration endpoints */
  integrations?: AgentIntegration[];
}

export interface AgentIntegration {
  type: 'webhook' | 'api' | 'oauth';
  name: string;
  endpoint?: string;
  scopes?: string[];
}

export interface CreateAgentInput {
  name: string;
  description: string;
  category: AgentCategory;
  type: AgentType;
  capabilities: Omit<AgentCapability, 'id'>[];
  pricingModel: PricingModel;
  systemPrompt: string;
  welcomeMessage: string;
  icon: string;
  tags?: string[];
  languages?: string[];
}

export interface UpdateAgentInput {
  name?: string;
  description?: string;
  capabilities?: Omit<AgentCapability, 'id'>[];
  pricingModel?: PricingModel;
  systemPrompt?: string;
  welcomeMessage?: string;
  icon?: string;
  metadata?: Partial<AgentMetadata>;
}
