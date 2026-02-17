/**
 * Blockchain Types - ERC-8004 identity and x402 payments
 */

export type SupportedChain = 'base' | 'polygon' | 'base-sepolia' | 'polygon-amoy';

export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  explorerUrl: string;
  contracts: ContractAddresses;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  isTestnet: boolean;
}

export interface ContractAddresses {
  identityRegistry: string;
  reputationRegistry: string;
  validationRegistry: string;
  usdcToken: string;
}

// ERC-8004 Types

export interface AgentIdentity {
  /** NFT token ID */
  tokenId: string;
  /** Owner address */
  owner: string;
  /** Agent wallet address */
  agentWallet: string;
  /** Metadata URI (IPFS) */
  metadataUri: string;
  /** Chain where registered */
  chainId: number;
  /** Registration timestamp */
  registeredAt: Date;
  /** Whether the identity is active */
  isActive: boolean;
}

export interface ReputationScore {
  agentId: string;
  /** Overall score (0-100) */
  overallScore: number;
  /** Total number of reviews */
  totalReviews: number;
  /** Breakdown by category */
  breakdown: {
    accuracy: number;
    helpfulness: number;
    speed: number;
    safety: number;
  };
  /** Last updated on-chain */
  lastUpdated: Date;
}

export interface FeedbackEntry {
  id: string;
  agentId: string;
  /** Reviewer address */
  reviewer: string;
  /** Rating (1-5) */
  rating: number;
  /** Optional comment (stored off-chain, hash on-chain) */
  comment?: string;
  /** On-chain transaction hash */
  transactionHash: string;
  createdAt: Date;
}

export interface ValidationRecord {
  id: string;
  agentId: string;
  /** Validator address */
  validator: string;
  /** Type of validation */
  validationType: ValidationType;
  /** Validation status */
  status: 'pending' | 'approved' | 'rejected';
  /** Evidence or notes */
  evidence?: string;
  /** On-chain transaction hash */
  transactionHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ValidationType =
  | 'identity' // Owner identity verification
  | 'capability' // Capability claims verification
  | 'security' // Security audit
  | 'compliance'; // Regulatory compliance

export type Reputation = {
  agentId: string;
  overallScore: number;
  totalReviews: number;
  feedbackEntries: FeedbackEntry[];
  validations: ValidationRecord[];
  trustLevel: TrustLevel;
};

import { TrustLevel } from './agent';

// x402 Payment Types

export interface X402PaymentRequest {
  /** Unique payment ID */
  paymentId: string;
  /** Agent receiving payment */
  payeeAddress: string;
  /** Amount in smallest unit */
  amount: number;
  /** Currency (USDC) */
  currency: 'USDC';
  /** Chain for payment */
  chainId: number;
  /** What the payment is for */
  description: string;
  /** Expiration timestamp */
  expiresAt: Date;
  /** Callback URL after payment */
  callbackUrl?: string;
}

export interface X402PaymentReceipt {
  /** Original payment ID */
  paymentId: string;
  /** Payer address */
  payerAddress: string;
  /** Payee address */
  payeeAddress: string;
  /** Amount paid */
  amount: number;
  /** Currency */
  currency: 'USDC';
  /** Chain where payment occurred */
  chainId: number;
  /** On-chain transaction hash */
  transactionHash: string;
  /** Block number */
  blockNumber: number;
  /** Payment timestamp */
  timestamp: Date;
}

export type TransactionStatus = 'pending' | 'verified' | 'settled' | 'failed' | 'refunded';

export interface Transaction {
  id: string;
  /** x402 payment ID */
  x402PaymentId: string;
  /** Payer wallet address */
  payerAddress: string;
  /** Payee (agent) wallet address */
  payeeAddress: string;
  /** Amount in smallest unit */
  amount: number;
  /** Currency */
  currency: 'USDC';
  /** Chain ID */
  chainId: number;
  /** Current status */
  status: TransactionStatus;
  /** On-chain transaction hash */
  transactionHash?: string;
  /** Block number when confirmed */
  blockNumber?: number;
  /** Associated session ID */
  sessionId?: string;
  /** Associated agent ID */
  agentId: string;
  /** Error message if failed */
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}
