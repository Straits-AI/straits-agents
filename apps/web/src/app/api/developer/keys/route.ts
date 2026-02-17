import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { createHash, randomBytes } from "crypto";

// GET list API keys for current user
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDB();
    const keys = await db
      .prepare(
        `SELECT id, key_prefix, name, scopes, last_used, expires_at, created_at
         FROM api_keys WHERE user_id = ? ORDER BY created_at DESC`
      )
      .bind(session.userId)
      .all<{
        id: string;
        key_prefix: string;
        name: string;
        scopes: string | null;
        last_used: string | null;
        expires_at: string | null;
        created_at: string;
      }>();

    return NextResponse.json({
      keys: keys.results.map((k) => ({
        id: k.id,
        keyPrefix: k.key_prefix,
        name: k.name,
        scopes: k.scopes ? JSON.parse(k.scopes) : [],
        lastUsed: k.last_used,
        expiresAt: k.expires_at,
        createdAt: k.created_at,
      })),
    });
  } catch (error) {
    console.error("Failed to fetch API keys:", error);
    return NextResponse.json(
      { error: "Failed to fetch API keys" },
      { status: 500 }
    );
  }
}

// POST create new API key
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, scopes, expiresInDays } = await request.json();

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const db = await getDB();

    // Check key limit (max 5 keys per user)
    const countResult = await db
      .prepare("SELECT COUNT(*) as count FROM api_keys WHERE user_id = ?")
      .bind(session.userId)
      .first<{ count: number }>();

    if (countResult && countResult.count >= 5) {
      return NextResponse.json(
        { error: "Maximum of 5 API keys allowed" },
        { status: 400 }
      );
    }

    // Generate API key
    const keyBytes = randomBytes(32);
    const apiKey = `sk_${keyBytes.toString("hex")}`;
    const keyPrefix = `sk_...${apiKey.slice(-8)}`;
    const keyHash = createHash("sha256").update(apiKey).digest("hex");

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    await db
      .prepare(
        `INSERT INTO api_keys (id, user_id, key_hash, key_prefix, name, scopes, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        session.userId,
        keyHash,
        keyPrefix,
        name,
        scopes ? JSON.stringify(scopes) : null,
        expiresAt,
        now
      )
      .run();

    return NextResponse.json({
      id,
      apiKey, // Only returned once at creation
      keyPrefix,
      name,
      scopes: scopes || [],
      expiresAt,
      createdAt: now,
      message: "Save this API key - it won't be shown again",
    });
  } catch (error) {
    console.error("Failed to create API key:", error);
    return NextResponse.json(
      { error: "Failed to create API key" },
      { status: 500 }
    );
  }
}

// DELETE revoke an API key
export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { keyId } = await request.json();

    if (!keyId) {
      return NextResponse.json({ error: "keyId is required" }, { status: 400 });
    }

    const db = await getDB();

    // Verify ownership
    const key = await db
      .prepare("SELECT id FROM api_keys WHERE id = ? AND user_id = ?")
      .bind(keyId, session.userId)
      .first();

    if (!key) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    await db
      .prepare("DELETE FROM api_keys WHERE id = ?")
      .bind(keyId)
      .run();

    return NextResponse.json({ message: "API key revoked" });
  } catch (error) {
    console.error("Failed to revoke API key:", error);
    return NextResponse.json(
      { error: "Failed to revoke API key" },
      { status: 500 }
    );
  }
}
