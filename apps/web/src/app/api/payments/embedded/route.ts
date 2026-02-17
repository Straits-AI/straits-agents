import { NextResponse } from "next/server";
import { getDB, getEnv } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  recordPayment,
  updatePaymentStatus,
  updateSessionPaymentStatus,
} from "@/lib/x402";
import { sendUsdcViaPaymaster } from "@/lib/embedded-wallet";
import { z } from "zod";
import type { Address } from "viem";

const paymentSchema = z.object({
  paymentId: z.string(),
  amount: z.number().positive(),
  sessionId: z.string().optional(),
  agentId: z.string(),
});

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { paymentId, amount, sessionId, agentId } = paymentSchema.parse(body);

    const db = await getDB();

    // Get user's embedded wallet info
    const user = await db
      .prepare(
        "SELECT embedded_wallet_address, encrypted_private_key, embedded_balance, wallet_type FROM users WHERE id = ?"
      )
      .bind(session.userId)
      .first<{
        embedded_wallet_address: string | null;
        encrypted_private_key: string | null;
        embedded_balance: number;
        wallet_type: string;
      }>();

    if (!user || user.wallet_type !== "embedded" || !user.embedded_wallet_address) {
      return NextResponse.json(
        { error: "No embedded wallet found" },
        { status: 400 }
      );
    }

    if (user.embedded_balance < amount) {
      return NextResponse.json(
        { error: "Insufficient balance", balance: user.embedded_balance },
        { status: 400 }
      );
    }

    // Get agent wallet and chain for recording / real transfer recipient
    const agent = await db
      .prepare("SELECT agent_wallet, chain_id FROM agents WHERE id = ?")
      .bind(agentId)
      .first<{ agent_wallet: string; chain_id: number | null }>();

    if (!agent?.agent_wallet) {
      return NextResponse.json(
        { error: "Agent wallet not configured" },
        { status: 400 }
      );
    }
    const payeeAddress = agent.agent_wallet;
    const agentChainId = (agent.chain_id || 421614) as import("@/lib/smart-account/config").SupportedChainId;

    // Try real on-chain USDC transfer first
    let transactionHash: string;
    let onChain = false;
    const env = await getEnv();

    // Determine which paymaster to use based on agent's chain
    const paymasterAddr = agentChainId === 97
      ? ((env as unknown as Record<string, string>)["PAYMASTER_ADDRESS_BSC"] || env.PAYMASTER_ADDRESS)
      : env.PAYMASTER_ADDRESS;

    if (user.encrypted_private_key && env.EMBEDDED_WALLET_SECRET && env.RELAYER_PRIVATE_KEY && paymasterAddr) {
      const realResult = await sendUsdcViaPaymaster(
        user.encrypted_private_key,
        env.EMBEDDED_WALLET_SECRET,
        payeeAddress as Address,
        amount,
        env.RELAYER_PRIVATE_KEY,
        paymasterAddr,
        agentChainId
      );
      if (realResult.hash) {
        transactionHash = realResult.hash;
        onChain = true;
      } else {
        transactionHash = `0xsim_${crypto.randomUUID().replace(/-/g, "")}`;
      }
    } else {
      transactionHash = `0xsim_${crypto.randomUUID().replace(/-/g, "")}`;
    }

    // Deduct balance atomically (WHERE clause prevents going negative)
    const result = await db
      .prepare(
        "UPDATE users SET embedded_balance = embedded_balance - ? WHERE id = ? AND embedded_balance >= ?"
      )
      .bind(amount, session.userId, amount)
      .run();

    if (!result.meta.changes || result.meta.changes === 0) {
      return NextResponse.json(
        { error: "Insufficient balance (race condition)" },
        { status: 400 }
      );
    }

    // Record the payment
    await recordPayment(
      paymentId,
      user.embedded_wallet_address,
      payeeAddress,
      amount,
      agentChainId,
      transactionHash,
      agentId,
      sessionId
    );

    // Mark as verified only for real on-chain payments
    if (onChain) {
      await updatePaymentStatus(paymentId, "verified");
    }

    // Update session payment status (embedded balance was already deducted)
    if (sessionId) {
      await updateSessionPaymentStatus(sessionId, "pay-as-you-go");
    }

    // Get new balance
    const updated = await db
      .prepare("SELECT embedded_balance FROM users WHERE id = ?")
      .bind(session.userId)
      .first<{ embedded_balance: number }>();

    return NextResponse.json({
      success: true,
      transactionHash,
      onChain,
      newBalance: updated?.embedded_balance ?? 0,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Embedded payment error:", error);
    return NextResponse.json(
      { error: "Payment failed" },
      { status: 500 }
    );
  }
}
