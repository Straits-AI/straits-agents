import { NextResponse } from "next/server";
import { getDB, getEnv } from "@/lib/db";
import { hashPassword, createToken, setSessionCookie } from "@/lib/auth";
import { generateEmbeddedWallet, getSmartAccountAddress, decryptPrivateKey } from "@/lib/embedded-wallet";
import { checkRateLimit, REGISTER_RATE_LIMIT } from "@/lib/rate-limit";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, name } = registerSchema.parse(body);

    // Rate limit: 3 registrations per hour per IP
    const clientIp = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = await checkRateLimit(REGISTER_RATE_LIMIT, clientIp);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many registration attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
      );
    }

    const db = await getDB();

    // Check if user exists
    const existing = await db
      .prepare("SELECT id FROM users WHERE email = ?")
      .bind(email)
      .first();

    if (existing) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 400 }
      );
    }

    // Create user
    const hashedPassword = await hashPassword(password);
    const userId = crypto.randomUUID();

    await db
      .prepare(
        "INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))"
      )
      .bind(userId, email, hashedPassword, name || null)
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

    // Create session
    const token = await createToken({ userId, email });
    await setSessionCookie(token);

    return NextResponse.json({
      user: {
        id: userId,
        email,
        name,
        embeddedWalletAddress,
        embeddedBalance: initialBalance,
      },
      message: "Registration successful",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 }
    );
  }
}
