import { NextResponse } from "next/server";
import { getDB, getEnv } from "@/lib/db";
import { createToken, setSessionCookie } from "@/lib/auth";
import { generateEmbeddedWallet, getSmartAccountAddress, decryptPrivateKey } from "@/lib/embedded-wallet";
import { checkRateLimit, OTP_RATE_LIMIT } from "@/lib/rate-limit";
import { z } from "zod";

const otpSchema = z.object({
  email: z.string().email(),
  otp: z.string(),
});

export async function POST(req: Request) {
  try {
    // Block OTP test bypass in production unless explicitly enabled
    const testDomain = process.env.TEST_EMAIL_DOMAIN;
    const testOtp = process.env.TEST_OTP_CODE;
    if (!testDomain || !testOtp) {
      return NextResponse.json(
        { error: "OTP login is not configured" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { email, otp } = otpSchema.parse(body);

    // Rate limit: 5 per minute per email
    const rl = await checkRateLimit(OTP_RATE_LIMIT, email.toLowerCase());
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many OTP attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
      );
    }

    // Only allow configured test domain emails
    if (!email.endsWith(testDomain)) {
      return NextResponse.json(
        { error: "OTP login is only available for test accounts" },
        { status: 400 }
      );
    }

    // Constant-time OTP comparison to prevent timing attacks
    if (!timingSafeEqual(otp, testOtp)) {
      return NextResponse.json(
        { error: "Invalid OTP" },
        { status: 401 }
      );
    }

    const db = await getDB();

    // Check if user exists
    let user = await db
      .prepare("SELECT id, email, name, embedded_wallet_address, wallet_type, embedded_balance FROM users WHERE email = ?")
      .bind(email)
      .first<{
        id: string;
        email: string;
        name: string | null;
        embedded_wallet_address: string | null;
        wallet_type: string | null;
        embedded_balance: number | null;
      }>();

    if (!user) {
      // Auto-create user for test emails
      const userId = crypto.randomUUID();
      const name = email.split("@")[0];

      await db
        .prepare(
          "INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))"
        )
        .bind(userId, email, "otp-bypass", name)
        .run();

      // Generate embedded wallet (EOA signer + derive Safe smart account address)
      const env = await getEnv();
      const { encryptedPrivateKey } =
        await generateEmbeddedWallet(env.EMBEDDED_WALLET_SECRET);

      // Derive Safe smart account address from the signer key
      const privateKey = await decryptPrivateKey(encryptedPrivateKey, env.EMBEDDED_WALLET_SECRET);
      const embeddedWalletAddress = await getSmartAccountAddress(privateKey);
      const initialBalance = Number(process.env.INITIAL_BALANCE_CENTS || "10000"); // $100.00 default

      await db
        .prepare(
          "UPDATE users SET embedded_wallet_address = ?, encrypted_private_key = ?, wallet_type = 'embedded', embedded_balance = ? WHERE id = ?"
        )
        .bind(embeddedWalletAddress, encryptedPrivateKey, initialBalance, userId)
        .run();

      user = {
        id: userId,
        email,
        name,
        embedded_wallet_address: embeddedWalletAddress,
        wallet_type: "embedded",
        embedded_balance: initialBalance,
      };
    }

    // Create session
    const token = await createToken({ userId: user.id, email: user.email });
    await setSessionCookie(token);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        embeddedWalletAddress: user.embedded_wallet_address,
        walletType: user.wallet_type || "none",
        embeddedBalance: user.embedded_balance ?? 0,
      },
      message: "OTP login successful",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }
    console.error("OTP login error:", error);
    return NextResponse.json(
      { error: "OTP login failed" },
      { status: 500 }
    );
  }
}

/** Constant-time string comparison to prevent timing side-channel attacks */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do a comparison to avoid leaking length info via timing
    b = a;
  }
  let result = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
