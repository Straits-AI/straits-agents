import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { verifyPassword, createToken, setSessionCookie } from "@/lib/auth";
import { checkRateLimit, LOGIN_RATE_LIMIT } from "@/lib/rate-limit";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = loginSchema.parse(body);

    // Rate limit: 5 attempts per 15 minutes per email
    const rl = await checkRateLimit(LOGIN_RATE_LIMIT, email.toLowerCase());
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
      );
    }

    const db = await getDB();

    // Find user
    const user = await db
      .prepare("SELECT id, email, password_hash, name, wallet_address, embedded_wallet_address, wallet_type, embedded_balance FROM users WHERE email = ?")
      .bind(email)
      .first<{
        id: string;
        email: string;
        password_hash: string;
        name: string | null;
        wallet_address: string | null;
        embedded_wallet_address: string | null;
        wallet_type: string | null;
        embedded_balance: number | null;
      }>();

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Create session
    const token = await createToken({
      userId: user.id,
      email: user.email,
      walletAddress: user.wallet_address || undefined,
    });
    await setSessionCookie(token);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        walletAddress: user.wallet_address,
        embeddedWalletAddress: user.embedded_wallet_address,
        walletType: user.wallet_type || "none",
        embeddedBalance: user.embedded_balance ?? 0,
      },
      message: "Login successful",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
