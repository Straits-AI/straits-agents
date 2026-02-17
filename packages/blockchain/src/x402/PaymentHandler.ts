import type {
  X402PaymentRequest,
  X402PaymentReceipt,
  Transaction,
  TransactionStatus,
  ChainConfig,
} from '@straits/core';
import { CHAIN_CONFIGS, generateId } from '@straits/core';

export interface PaymentHandlerConfig {
  chainId: number;
  facilitatorUrl?: string;
  rpcUrl?: string;
}

export interface CreatePaymentRequestInput {
  payeeAddress: string;
  amount: number; // in cents (smallest unit)
  description: string;
  expiresInMinutes?: number;
  callbackUrl?: string;
}

export interface VerifyPaymentInput {
  paymentId: string;
  payerAddress: string;
  transactionHash: string;
}

/**
 * PaymentHandler implements x402 micropayment protocol.
 *
 * x402 uses HTTP 402 Payment Required status code for pay-per-use APIs.
 * Flow:
 * 1. Client makes request to protected endpoint
 * 2. Server returns 402 with payment details in headers
 * 3. Client makes payment via stablecoin transfer
 * 4. Client retries request with payment receipt
 * 5. Server verifies payment and processes request
 */
export class PaymentHandler {
  private chainConfig: ChainConfig;
  private facilitatorUrl: string;
  private usdcAddress: string;

  constructor(config: PaymentHandlerConfig) {
    const chainKey = this.getChainKey(config.chainId);
    const chainConfig = CHAIN_CONFIGS[chainKey];

    if (!chainConfig) {
      throw new Error(`Unsupported chain ID: ${config.chainId}`);
    }

    this.chainConfig = chainConfig;
    this.usdcAddress = chainConfig.contracts.usdcToken;
    this.facilitatorUrl = config.facilitatorUrl || 'https://x402.coinbase.com';
  }

  /**
   * Create a payment request (returned in 402 response).
   */
  createPaymentRequest(input: CreatePaymentRequestInput): X402PaymentRequest {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + (input.expiresInMinutes || 15));

    return {
      paymentId: generateId(),
      payeeAddress: input.payeeAddress,
      amount: input.amount,
      currency: 'USDC',
      chainId: this.chainConfig.chainId,
      description: input.description,
      expiresAt,
      callbackUrl: input.callbackUrl,
    };
  }

  /**
   * Generate HTTP 402 response headers.
   */
  generate402Headers(request: X402PaymentRequest): Record<string, string> {
    return {
      'X-Payment-Required': 'true',
      'X-Payment-Id': request.paymentId,
      'X-Payment-Amount': request.amount.toString(),
      'X-Payment-Currency': request.currency,
      'X-Payment-Chain-Id': request.chainId.toString(),
      'X-Payment-Payee': request.payeeAddress,
      'X-Payment-USDC-Address': this.usdcAddress,
      'X-Payment-Expires': request.expiresAt.toISOString(),
      'X-Payment-Description': request.description,
      'X-Payment-Facilitator': this.facilitatorUrl,
    };
  }

  /**
   * Parse payment receipt from request headers.
   */
  parsePaymentHeaders(headers: Record<string, string>): VerifyPaymentInput | null {
    const paymentId = headers['x-payment-id'];
    const payerAddress = headers['x-payment-payer'];
    const transactionHash = headers['x-payment-tx'];

    if (!paymentId || !payerAddress || !transactionHash) {
      return null;
    }

    return {
      paymentId,
      payerAddress,
      transactionHash,
    };
  }

  /**
   * Verify a payment was made on-chain.
   */
  async verifyPayment(input: VerifyPaymentInput): Promise<X402PaymentReceipt | null> {
    console.log('Verifying payment:', {
      chain: this.chainConfig.name,
      input,
    });

    // In production, this would:
    // 1. Query the transaction on-chain
    // 2. Verify the USDC transfer matches expected amount
    // 3. Verify sender and recipient addresses
    // 4. Check transaction is confirmed

    // Placeholder - actual implementation uses viem
    return {
      paymentId: input.paymentId,
      payerAddress: input.payerAddress,
      payeeAddress: '0x0000000000000000000000000000000000000000',
      amount: 0, // Would be extracted from transaction
      currency: 'USDC',
      chainId: this.chainConfig.chainId,
      transactionHash: input.transactionHash,
      blockNumber: 0, // Would be from transaction receipt
      timestamp: new Date(),
    };
  }

  /**
   * Create a transaction record for tracking.
   */
  createTransaction(
    request: X402PaymentRequest,
    receipt?: X402PaymentReceipt
  ): Transaction {
    return {
      id: generateId(),
      x402PaymentId: request.paymentId,
      payerAddress: receipt?.payerAddress || '0x0',
      payeeAddress: request.payeeAddress,
      amount: request.amount,
      currency: 'USDC',
      chainId: request.chainId,
      status: receipt ? 'verified' : 'pending',
      transactionHash: receipt?.transactionHash,
      blockNumber: receipt?.blockNumber,
      agentId: '', // Set by caller
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Check if a payment request has expired.
   */
  isPaymentExpired(request: X402PaymentRequest): boolean {
    return new Date() > request.expiresAt;
  }

  /**
   * Format amount for display.
   */
  formatAmount(cents: number): string {
    return `$${(cents / 100).toFixed(2)} USDC`;
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
   * Get the USDC token address.
   */
  getUSDCAddress(): string {
    return this.usdcAddress;
  }

  /**
   * Get the chain configuration.
   */
  getChainConfig(): ChainConfig {
    return this.chainConfig;
  }
}
