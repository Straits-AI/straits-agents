import type { ReputationScore, FeedbackEntry, ChainConfig } from '@straits/core';
import { CHAIN_CONFIGS, generateId } from '@straits/core';

// ERC-8004 Reputation Registry ABI (simplified)
export const REPUTATION_REGISTRY_ABI = [
  {
    name: 'submitFeedback',
    type: 'function',
    inputs: [
      { name: 'agentTokenId', type: 'uint256' },
      { name: 'rating', type: 'uint8' },
      { name: 'commentHash', type: 'bytes32' },
    ],
    outputs: [{ name: 'feedbackId', type: 'uint256' }],
  },
  {
    name: 'getReputation',
    type: 'function',
    inputs: [{ name: 'agentTokenId', type: 'uint256' }],
    outputs: [
      { name: 'overallScore', type: 'uint256' },
      { name: 'totalReviews', type: 'uint256' },
      { name: 'accuracyScore', type: 'uint256' },
      { name: 'helpfulnessScore', type: 'uint256' },
      { name: 'speedScore', type: 'uint256' },
      { name: 'safetyScore', type: 'uint256' },
    ],
  },
  {
    name: 'getFeedback',
    type: 'function',
    inputs: [{ name: 'feedbackId', type: 'uint256' }],
    outputs: [
      { name: 'reviewer', type: 'address' },
      { name: 'rating', type: 'uint8' },
      { name: 'timestamp', type: 'uint256' },
    ],
  },
  {
    name: 'FeedbackSubmitted',
    type: 'event',
    inputs: [
      { name: 'feedbackId', type: 'uint256', indexed: true },
      { name: 'agentTokenId', type: 'uint256', indexed: true },
      { name: 'reviewer', type: 'address', indexed: true },
      { name: 'rating', type: 'uint8', indexed: false },
    ],
  },
] as const;

export interface ReputationRegistryConfig {
  chainId: number;
  rpcUrl?: string;
}

export interface SubmitFeedbackInput {
  agentTokenId: string;
  reviewerAddress: string;
  rating: number; // 1-5
  comment?: string;
}

export interface SubmitFeedbackResult {
  feedbackId: string;
  transactionHash: string;
}

/**
 * ReputationRegistry handles on-chain reputation management.
 */
export class ReputationRegistry {
  private chainConfig: ChainConfig;
  private contractAddress: string;

  constructor(config: ReputationRegistryConfig) {
    const chainKey = this.getChainKey(config.chainId);
    const chainConfig = CHAIN_CONFIGS[chainKey];

    if (!chainConfig) {
      throw new Error(`Unsupported chain ID: ${config.chainId}`);
    }

    this.chainConfig = chainConfig;
    this.contractAddress = chainConfig.contracts.reputationRegistry;
  }

  /**
   * Submit feedback for an agent.
   */
  async submitFeedback(input: SubmitFeedbackInput): Promise<SubmitFeedbackResult> {
    // Validate rating
    if (input.rating < 1 || input.rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    // Hash comment if provided (stored off-chain, hash on-chain)
    const commentHash = input.comment ? this.hashComment(input.comment) : null;

    console.log('Submitting feedback:', {
      chain: this.chainConfig.name,
      contract: this.contractAddress,
      input: { ...input, commentHash },
    });

    // Placeholder - actual implementation uses viem
    return {
      feedbackId: generateId(),
      transactionHash: `0x${Array(64).fill('0').join('')}`,
    };
  }

  /**
   * Get reputation score for an agent.
   */
  async getReputation(agentTokenId: string): Promise<ReputationScore | null> {
    console.log('Getting reputation:', {
      chain: this.chainConfig.name,
      agentTokenId,
    });

    // Placeholder - actual implementation reads from contract
    return {
      agentId: agentTokenId,
      overallScore: 85,
      totalReviews: 42,
      breakdown: {
        accuracy: 88,
        helpfulness: 90,
        speed: 82,
        safety: 80,
      },
      lastUpdated: new Date(),
    };
  }

  /**
   * Get feedback entries for an agent.
   */
  async getFeedbackEntries(
    agentTokenId: string,
    limit: number = 10
  ): Promise<FeedbackEntry[]> {
    console.log('Getting feedback entries:', {
      chain: this.chainConfig.name,
      agentTokenId,
      limit,
    });

    // Placeholder - actual implementation reads from contract events
    return [];
  }

  /**
   * Calculate trust level based on reputation.
   */
  calculateTrustLevel(score: number, reviews: number): 'unverified' | 'basic' | 'verified' | 'premium' {
    if (reviews < 5) return 'unverified';
    if (score < 60) return 'basic';
    if (score < 80 || reviews < 50) return 'verified';
    return 'premium';
  }

  /**
   * Hash a comment for on-chain storage.
   */
  private hashComment(comment: string): string {
    // Simple hash - in production use keccak256
    let hash = 0;
    for (let i = 0; i < comment.length; i++) {
      const char = comment.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `0x${Math.abs(hash).toString(16).padStart(64, '0')}`;
  }

  /**
   * Get chain key from chain ID.
   */
  private getChainKey(chainId: number): string {
    const mapping: Record<number, string> = {
      8453: 'base',
      84532: 'base-sepolia',
      137: 'polygon',
      80002: 'polygon-amoy',
    };
    return mapping[chainId] || 'base-sepolia';
  }

  /**
   * Get the contract address.
   */
  getContractAddress(): string {
    return this.contractAddress;
  }
}
