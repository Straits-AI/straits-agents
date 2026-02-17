import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { createToken, setSessionCookie, getSession } from "@/lib/auth";
import { checkRateLimit, WALLET_AUTH_RATE_LIMIT } from "@/lib/rate-limit";
import { z } from "zod";
import { verifyMessage } from "viem";

const addressRegex = /^0x[a-fA-F0-9]{40}$/;

const walletAuthSchema = z.object({
  address: z.string().regex(addressRegex), // Primary address (smart account if available)
  eoaAddress: z.string().regex(addressRegex).optional(), // EOA that signed
  smartAccountAddress: z.string().regex(addressRegex).optional().nullable(),
  message: z.string(),
  signature: z.string(),
});

const linkWalletSchema = z.object({
  address: z.string().regex(addressRegex),
  eoaAddress: z.string().regex(addressRegex).optional(),
  smartAccountAddress: z.string().regex(addressRegex).optional().nullable(),
  message: z.string(),
  signature: z.string(),
});

// Sign in with wallet (supports both EOA and Smart Account)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      address,
      eoaAddress,
      smartAccountAddress,
      message,
      signature,
    } = walletAuthSchema.parse(body);

    // Rate limit: 10 per minute per address
    const rl = await checkRateLimit(WALLET_AUTH_RATE_LIMIT, address.toLowerCase());
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many wallet auth attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
      );
    }

    // The signature is always from the EOA (the signer)
    // If eoaAddress is provided, verify against it; otherwise verify against address
    const signerAddress = eoaAddress || address;

    // Verify signature
    const isValid = await verifyMessage({
      address: signerAddress as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const db = await getDB();

    // Determine lookup address - prefer smart account if available
    const lookupAddress = (smartAccountAddress || address).toLowerCase();
    const eoaAddr = (eoaAddress || address).toLowerCase();
    const smartAddr = smartAccountAddress?.toLowerCase() || null;

    // Try to find user by smart account first, then by EOA, then by legacy wallet_address
    let user = await db
      .prepare(`
        SELECT id, email, name, wallet_address, smart_account_address, eoa_address
        FROM users
        WHERE smart_account_address = ?
           OR eoa_address = ?
           OR wallet_address = ?
        LIMIT 1
      `)
      .bind(smartAddr, eoaAddr, lookupAddress)
      .first<{
        id: string;
        email: string | null;
        name: string | null;
        wallet_address: string | null;
        smart_account_address: string | null;
        eoa_address: string | null;
      }>();

    if (!user) {
      // Create new user with wallet
      const userId = crypto.randomUUID();
      await db
        .prepare(`
          INSERT INTO users (
            id,
            wallet_address,
            smart_account_address,
            eoa_address,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
        `)
        .bind(userId, lookupAddress, smartAddr, eoaAddr)
        .run();

      user = {
        id: userId,
        email: null,
        name: null,
        wallet_address: lookupAddress,
        smart_account_address: smartAddr,
        eoa_address: eoaAddr,
      };
    } else {
      // Update existing user with smart account info if not already set
      if (smartAddr && !user.smart_account_address) {
        await db
          .prepare(`
            UPDATE users
            SET smart_account_address = ?, eoa_address = ?, updated_at = datetime('now')
            WHERE id = ?
          `)
          .bind(smartAddr, eoaAddr, user.id)
          .run();
        user.smart_account_address = smartAddr;
        user.eoa_address = eoaAddr;
      }
    }

    // Create session with primary address (smart account preferred)
    const token = await createToken({
      userId: user.id,
      email: user.email || "",
      walletAddress: user.smart_account_address || user.wallet_address || "",
    });
    await setSessionCookie(token);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        walletAddress: user.smart_account_address || user.wallet_address,
        smartAccountAddress: user.smart_account_address,
        eoaAddress: user.eoa_address,
      },
      message: "Wallet authentication successful",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Wallet auth error:", error);
    return NextResponse.json(
      { error: "Wallet authentication failed" },
      { status: 500 }
    );
  }
}

// Link wallet to existing account (supports smart accounts)
export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const {
      address,
      eoaAddress,
      smartAccountAddress,
      message,
      signature,
    } = linkWalletSchema.parse(body);

    // Verify signature against EOA
    const signerAddress = eoaAddress || address;
    const isValid = await verifyMessage({
      address: signerAddress as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const db = await getDB();

    const lookupAddress = (smartAccountAddress || address).toLowerCase();
    const eoaAddr = (eoaAddress || address).toLowerCase();
    const smartAddr = smartAccountAddress?.toLowerCase() || null;

    // Check if wallet is already linked to another account
    const existing = await db
      .prepare(`
        SELECT id FROM users
        WHERE (smart_account_address = ? OR eoa_address = ? OR wallet_address = ?)
          AND id != ?
      `)
      .bind(smartAddr, eoaAddr, lookupAddress, session.userId)
      .first();

    if (existing) {
      return NextResponse.json(
        { error: "Wallet already linked to another account" },
        { status: 400 }
      );
    }

    // Link wallet to account
    await db
      .prepare(`
        UPDATE users
        SET wallet_address = ?,
            smart_account_address = ?,
            eoa_address = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `)
      .bind(lookupAddress, smartAddr, eoaAddr, session.userId)
      .run();

    // Update session with wallet
    const token = await createToken({
      userId: session.userId,
      email: session.email,
      walletAddress: smartAddr || lookupAddress,
    });
    await setSessionCookie(token);

    return NextResponse.json({
      message: "Wallet linked successfully",
      walletAddress: smartAddr || lookupAddress,
      smartAccountAddress: smartAddr,
      eoaAddress: eoaAddr,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Link wallet error:", error);
    return NextResponse.json(
      { error: "Failed to link wallet" },
      { status: 500 }
    );
  }
}
