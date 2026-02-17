import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const db = await getDB();
    const user = await db
      .prepare("SELECT id, email, name, wallet_address, embedded_wallet_address, wallet_type, embedded_balance, created_at FROM users WHERE id = ?")
      .bind(session.userId)
      .first<{
        id: string;
        email: string;
        name: string | null;
        wallet_address: string | null;
        embedded_wallet_address: string | null;
        wallet_type: string | null;
        embedded_balance: number | null;
        created_at: string;
      }>();

    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        walletAddress: user.wallet_address,
        embeddedWalletAddress: user.embedded_wallet_address,
        walletType: user.wallet_type || "none",
        embeddedBalance: user.embedded_balance ?? 0,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json({ error: "Failed to get user" }, { status: 500 });
  }
}
