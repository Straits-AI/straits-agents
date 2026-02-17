/**
 * x402 Payment Protocol Implementation
 * HTTP 402 Payment Required with USDC micropayments
 */

import { getDB } from "./db";

export interface PaymentDetails {
  amount: number; // Amount in cents (USDC has 6 decimals, so 1 USDC = 1000000)
  currency: "USDC";
  recipient: string; // Wallet address
  description: string;
  expiresAt: string;
}

export interface PaymentReceipt {
  id: string;
  paymentId: string;
  payerAddress: string;
  amount: number;
  currency: "USDC";
  chainId: number;
  transactionHash: string;
  status: "pending" | "verified" | "settled";
  createdAt: string;
}

export interface X402Response {
  status: 402;
  paymentDetails: PaymentDetails;
  paymentId: string;
  paymentUrl?: string;
}

/**
 * Generate a payment ID
 */
export function generatePaymentId(): string {
  return `pay_${crypto.randomUUID().replace(/-/g, "")}`;
}

/**
 * Create a 402 payment required response
 */
export function createPaymentRequired(
  amount: number,
  recipient: string,
  description: string,
  expiresInSeconds = 3600
): X402Response {
  const paymentId = generatePaymentId();
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

  return {
    status: 402,
    paymentDetails: {
      amount,
      currency: "USDC",
      recipient,
      description,
      expiresAt,
    },
    paymentId,
  };
}

/**
 * Check if a session has exceeded free queries
 */
export async function checkPaymentRequired(
  sessionId: string,
  agentId: string
): Promise<{ required: boolean; paymentResponse?: X402Response }> {
  const db = await getDB();

  // Get session and agent info
  const session = await db
    .prepare("SELECT queries_used, payment_status FROM sessions WHERE id = ?")
    .bind(sessionId)
    .first<{ queries_used: number; payment_status: string }>();

  const agent = await db
    .prepare("SELECT agent_wallet, free_queries, price_per_query FROM agents WHERE id = ?")
    .bind(agentId)
    .first<{ agent_wallet: string; free_queries: number; price_per_query: number }>();

  if (!session || !agent) {
    return { required: false };
  }

  // Check if user has exceeded free queries
  if (session.queries_used >= agent.free_queries && session.payment_status === "free") {
    if (!agent.agent_wallet) {
      return { required: false };
    }
    const paymentResponse = createPaymentRequired(
      agent.price_per_query,
      agent.agent_wallet,
      `Query ${session.queries_used + 1} for agent ${agentId}`
    );

    return { required: true, paymentResponse };
  }

  return { required: false };
}

/**
 * Record a payment receipt
 */
export async function recordPayment(
  paymentId: string,
  payerAddress: string,
  payeeAddress: string,
  amount: number,
  chainId: number,
  transactionHash: string,
  agentId: string,
  sessionId?: string
): Promise<PaymentReceipt> {
  const db = await getDB();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO transactions (id, x402_payment_id, payer_address, payee_address, amount, currency, chain_id, transaction_hash, status, agent_id, session_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'USDC', ?, ?, 'pending', ?, ?, ?, ?)`
    )
    .bind(id, paymentId, payerAddress, payeeAddress, amount, chainId, transactionHash, agentId, sessionId || null, now, now)
    .run();

  return {
    id,
    paymentId,
    payerAddress,
    amount,
    currency: "USDC",
    chainId,
    transactionHash,
    status: "pending",
    createdAt: now,
  };
}

/**
 * Verify a payment on-chain (simplified - in production, use actual blockchain verification)
 */
export async function verifyPayment(
  transactionHash: string,
  expectedAmount: number,
  expectedRecipient: string
): Promise<{ verified: boolean; error?: string }> {
  // In production, this would:
  // 1. Query the blockchain for the transaction
  // 2. Verify it's a USDC transfer
  // 3. Verify the amount matches
  // 4. Verify the recipient matches
  // 5. Verify the transaction is confirmed

  // Simulated payments: mark as simulated, not verified
  // They are only used as fallback when on-chain payment fails
  if (transactionHash.startsWith("0xsim_")) {
    return { verified: false, error: "Simulated payment — not verified on-chain" };
  }

  // Validate transaction hash format
  if (!transactionHash.startsWith("0x") || transactionHash.length !== 66) {
    return { verified: false, error: "Invalid transaction hash format" };
  }

  // TODO: In production, call blockchain RPC to verify on-chain
  // const client = createPublicClient({ chain: arbitrumSepolia, transport: http() });
  // const receipt = await client.getTransactionReceipt({ hash: transactionHash });
  // Verify: receipt.status === 'success', correct amount, correct recipient

  return { verified: true };
}

/**
 * Update payment status after verification
 */
export async function updatePaymentStatus(
  paymentId: string,
  status: "verified" | "settled"
): Promise<void> {
  const db = await getDB();

  await db
    .prepare("UPDATE transactions SET status = ? WHERE x402_payment_id = ?")
    .bind(status, paymentId)
    .run();
}

/**
 * Update session payment status after successful payment
 */
export async function updateSessionPaymentStatus(
  sessionId: string,
  status: "prepaid" | "pay-as-you-go"
): Promise<void> {
  const db = await getDB();

  await db
    .prepare("UPDATE sessions SET payment_status = ?, updated_at = ? WHERE id = ?")
    .bind(status, new Date().toISOString(), sessionId)
    .run();
}

/**
 * Get payment history for a user
 */
export async function getUserPayments(payerAddress: string): Promise<PaymentReceipt[]> {
  const db = await getDB();

  const result = await db
    .prepare(
      `SELECT id, x402_payment_id, payer_address, amount, currency, chain_id, transaction_hash, status, created_at
       FROM transactions WHERE payer_address = ? ORDER BY created_at DESC LIMIT 50`
    )
    .bind(payerAddress)
    .all<{
      id: string;
      x402_payment_id: string;
      payer_address: string;
      amount: number;
      currency: string;
      chain_id: number;
      transaction_hash: string;
      status: string;
      created_at: string;
    }>();

  return result.results.map((row) => ({
    id: row.id,
    paymentId: row.x402_payment_id,
    payerAddress: row.payer_address,
    amount: row.amount,
    currency: "USDC",
    chainId: row.chain_id,
    transactionHash: row.transaction_hash,
    status: row.status as "pending" | "verified" | "settled",
    createdAt: row.created_at,
  }));
}
