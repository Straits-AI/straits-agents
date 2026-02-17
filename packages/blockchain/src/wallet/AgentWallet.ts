import type { ChainConfig } from '@straits/core';
import { CHAIN_CONFIGS } from '@straits/core';

export interface AgentWalletConfig {
  chainId: number;
  rpcUrl?: string;
}

export interface WalletBalance {
  native: string;
  nativeSymbol: string;
  usdc: string;
}

/**
 * AgentWallet manages agent wallet operations.
 */
export class AgentWallet {
  private chainConfig: ChainConfig;
  private address: string | null = null;

  constructor(config: AgentWalletConfig) {
    const chainKey = this.getChainKey(config.chainId);
    const chainConfig = CHAIN_CONFIGS[chainKey];

    if (!chainConfig) {
      throw new Error(`Unsupported chain ID: ${config.chainId}`);
    }

    this.chainConfig = chainConfig;
  }

  /**
   * Generate a new agent wallet.
   */
  async generateWallet(): Promise<{ address: string; privateKey: string }> {
    // In production, use viem's generatePrivateKey and privateKeyToAccount
    // This is a placeholder

    const privateKey = `0x${Array(64)
      .fill(0)
      .map(() => Math.floor(Math.random() * 16).toString(16))
      .join('')}`;

    const address = `0x${Array(40)
      .fill(0)
      .map(() => Math.floor(Math.random() * 16).toString(16))
      .join('')}`;

    this.address = address;

    return { address, privateKey };
  }

  /**
   * Import an existing wallet.
   */
  async importWallet(privateKey: string): Promise<string> {
    // In production, use viem to derive address from private key
    const address = `0x${Array(40)
      .fill(0)
      .map(() => Math.floor(Math.random() * 16).toString(16))
      .join('')}`;

    this.address = address;
    return address;
  }

  /**
   * Get wallet balances.
   */
  async getBalance(address: string): Promise<WalletBalance> {
    // Placeholder - actual implementation uses viem
    return {
      native: '0.0',
      nativeSymbol: this.chainConfig.nativeCurrency.symbol,
      usdc: '0.00',
    };
  }

  /**
   * Sign a message with the wallet.
   */
  async signMessage(message: string, privateKey: string): Promise<string> {
    // Placeholder - actual implementation uses viem
    return `0x${Array(130).fill('0').join('')}`;
  }

  /**
   * Verify a signature.
   */
  async verifySignature(
    message: string,
    signature: string,
    expectedAddress: string
  ): Promise<boolean> {
    // Placeholder - actual implementation uses viem
    return true;
  }

  /**
   * Get the current wallet address.
   */
  getAddress(): string | null {
    return this.address;
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
   * Get the chain configuration.
   */
  getChainConfig(): ChainConfig {
    return this.chainConfig;
  }
}
