import { NextResponse } from "next/server";
import {
  recordPayment,
  verifyPayment,
  updatePaymentStatus,
  updateSessionPaymentStatus,
  getUserPayments,
} from "@/lib/x402";
import { getSession } from "@/lib/auth";
import { getDB } from "@/lib/db";

// Get payment history (authenticated user's own payments only)
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Look up the authenticated user's wallet address
    const db = await getDB();
    const user = await db
      .prepare("SELECT embedded_wallet_address FROM users WHERE id = ?")
      .bind(session.userId)
      .first<{ embedded_wallet_address: string | null }>();

    const url = new URL(request.url);
    const walletAddress = url.searchParams.get("wallet");

    if (!walletAddress) {
      return NextResponse.json(
        { error: "wallet parameter is required" },
        { status: 400 }
      );
    }

    // Ensure the wallet belongs to the authenticated user
    if (
      user?.embedded_wallet_address?.toLowerCase() !== walletAddress.toLowerCase() &&
      session.walletAddress?.toLowerCase() !== walletAddress.toLowerCase()
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const payments = await getUserPayments(walletAddress);
    return NextResponse.json({ payments });
  } catch (error) {
    console.error("Failed to fetch payments:", error);
    return NextResponse.json(
      { error: "Failed to fetch payments" },
      { status: 500 }
    );
  }
}

// Record a new payment (authenticated only)
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      paymentId,
      payerAddress,
      amount,
      chainId,
      transactionHash,
      sessionId,
      agentId,
    } = await request.json();

    // Validate required fields
    if (!paymentId || !payerAddress || !amount || !chainId || !transactionHash || !agentId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get agent info for verification
    const db = await getDB();
    const agent = await db
      .prepare("SELECT agent_wallet FROM agents WHERE id = ?")
      .bind(agentId)
      .first<{ agent_wallet: string }>();

    if (!agent?.agent_wallet) {
      return NextResponse.json(
        { error: "Agent wallet not configured" },
        { status: 400 }
      );
    }
    const payeeAddress = agent.agent_wallet;

    // Record the payment
    const receipt = await recordPayment(
      paymentId,
      payerAddress,
      payeeAddress,
      amount,
      chainId,
      transactionHash,
      agentId,
      sessionId
    );

    // Verify the payment on-chain
    const verification = await verifyPayment(transactionHash, amount, payeeAddress);

    if (verification.verified) {
      await updatePaymentStatus(paymentId, "verified");
      receipt.status = "verified";

      // Update session payment status if session provided
      if (sessionId) {
        await updateSessionPaymentStatus(sessionId, "pay-as-you-go");
      }
    }

    return NextResponse.json({
      receipt,
      verified: verification.verified,
      error: verification.error,
    });
  } catch (error) {
    console.error("Failed to record payment:", error);
    return NextResponse.json(
      { error: "Failed to record payment" },
      { status: 500 }
    );
  }
}
