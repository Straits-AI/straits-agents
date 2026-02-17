import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { createPublicClient, http, formatUnits, type Address } from "viem";
import { isSupportedChain, getChainById, getChainConfig, type SupportedChainId } from "@/lib/smart-account/config";

const ERC20_BALANCE_ABI = [
  {
    type: "function" as const,
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view" as const,
  },
] as const;

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDB();
    const user = await db
      .prepare(
        "SELECT embedded_wallet_address, embedded_balance, wallet_type FROM users WHERE id = ?"
      )
      .bind(session.userId)
      .first<{
        embedded_wallet_address: string | null;
        embedded_balance: number | null;
        wallet_type: string | null;
      }>();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Query on-chain USDC balance if address is available
    let usdcBalance: string | null = null;
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address") || user.embedded_wallet_address;
    const chainIdParam = parseInt(searchParams.get("chainId") || "421614", 10);
    const chainId: SupportedChainId = isSupportedChain(chainIdParam) ? chainIdParam : 421614;

    if (address) {
      try {
        const chain = getChainById(chainId);
        const chainConfig = getChainConfig(chainId);

        const publicClient = createPublicClient({
          chain,
          transport: http(),
        });

        const rawBalance = await publicClient.readContract({
          address: chainConfig.usdcAddress,
          abi: ERC20_BALANCE_ABI,
          functionName: "balanceOf",
          args: [address as Address],
        });

        usdcBalance = formatUnits(rawBalance, 6);
      } catch (err) {
        console.error("On-chain balance query failed:", err);
      }
    }

    return NextResponse.json({
      balance: user.embedded_balance ?? 0,
      address: user.embedded_wallet_address,
      walletType: user.wallet_type || "none",
      usdcBalance,
    });
  } catch (error) {
    console.error("Balance query error:", error);
    return NextResponse.json(
      { error: "Failed to fetch balance" },
      { status: 500 }
    );
  }
}
