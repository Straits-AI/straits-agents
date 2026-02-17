import type { AgentIdentity, ChainConfig } from '@straits/core';
import { CHAIN_CONFIGS } from '@straits/core';

// ERC-8004 Identity Registry ABI (simplified)
export const IDENTITY_REGISTRY_ABI = [
  {
    name: 'registerAgent',
    type: 'function',
    inputs: [
      { name: 'agentWallet', type: 'address' },
      { name: 'metadataUri', type: 'string' },
    ],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
  },
  {
    name: 'getAgent',
    type: 'function',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      { name: 'owner', type: 'address' },
      { name: 'agentWallet', type: 'address' },
      { name: 'metadataUri', type: 'string' },
      { name: 'isActive', type: 'bool' },
    ],
  },
  {
    name: 'updateMetadata',
    type: 'function',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'metadataUri', type: 'string' },
    ],
    outputs: [],
  },
  {
    name: 'deactivateAgent',
    type: 'function',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'AgentRegistered',
    type: 'event',
    inputs: [
      { name: 'tokenId', type: 'uint256', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'agentWallet', type: 'address', indexed: false },
    ],
  },
] as const;

export interface IdentityRegistryConfig {
  chainId: number;
  rpcUrl?: string;
}

export interface RegisterAgentInput {
  ownerAddress: string;
  agentWallet: string;
  metadataUri: string;
}

export interface RegisterAgentResult {
  tokenId: string;
  transactionHash: string;
}

/**
 * IdentityRegistry handles ERC-8004 agent identity operations.
 */
export class IdentityRegistry {
  private chainConfig: ChainConfig;
  private contractAddress: string;

  constructor(config: IdentityRegistryConfig) {
    const chainKey = this.getChainKey(config.chainId);
    const chainConfig = CHAIN_CONFIGS[chainKey];

    if (!chainConfig) {
      throw new Error(`Unsupported chain ID: ${config.chainId}`);
    }

    this.chainConfig = chainConfig;
    this.contractAddress = chainConfig.contracts.identityRegistry;
  }

  /**
   * Register a new agent on-chain.
   */
  async registerAgent(input: RegisterAgentInput): Promise<RegisterAgentResult> {
    // In production, this would use viem to call the contract
    // For now, return a placeholder

    console.log('Registering agent:', {
      chain: this.chainConfig.name,
      contract: this.contractAddress,
      input,
    });

    // Placeholder - actual implementation uses viem
    return {
      tokenId: `${Date.now()}`,
      transactionHash: `0x${Array(64).fill('0').join('')}`,
    };
  }

  /**
   * Get agent identity from on-chain.
   */
  async getAgent(tokenId: string): Promise<AgentIdentity | null> {
    // Placeholder - actual implementation uses viem
    console.log('Getting agent:', {
      chain: this.chainConfig.name,
      tokenId,
    });

    return null;
  }

  /**
   * Update agent metadata on-chain.
   */
  async updateMetadata(tokenId: string, metadataUri: string): Promise<string> {
    // Placeholder - returns transaction hash
    console.log('Updating metadata:', {
      chain: this.chainConfig.name,
      tokenId,
      metadataUri,
    });

    return `0x${Array(64).fill('0').join('')}`;
  }

  /**
   * Deactivate an agent on-chain.
   */
  async deactivateAgent(tokenId: string): Promise<string> {
    // Placeholder - returns transaction hash
    console.log('Deactivating agent:', {
      chain: this.chainConfig.name,
      tokenId,
    });

    return `0x${Array(64).fill('0').join('')}`;
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

  /**
   * Get the chain configuration.
   */
  getChainConfig(): ChainConfig {
    return this.chainConfig;
  }
}
