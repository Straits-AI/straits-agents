/**
 * API Key authentication for SDK usage
 */

import { getDB } from "./db";
import { createHash } from "crypto";

interface ApiKeyInfo {
  userId: string;
  keyId: string;
  scopes: string[];
}

/**
 * Validate an API key and return associated user info
 */
export async function validateApiKey(apiKey: string): Promise<ApiKeyInfo | null> {
  if (!apiKey || !apiKey.startsWith("sk_")) {
    return null;
  }

  const keyHash = createHash("sha256").update(apiKey).digest("hex");
  const db = await getDB();

  const key = await db
    .prepare(
      `SELECT id, user_id, scopes, expires_at FROM api_keys WHERE key_hash = ?`
    )
    .bind(keyHash)
    .first<{
      id: string;
      user_id: string;
      scopes: string | null;
      expires_at: string | null;
    }>();

  if (!key) {
    return null;
  }

  // Check expiration
  if (key.expires_at && new Date(key.expires_at) < new Date()) {
    return null;
  }

  // Update last_used
  await db
    .prepare("UPDATE api_keys SET last_used = ? WHERE id = ?")
    .bind(new Date().toISOString(), key.id)
    .run();

  return {
    userId: key.user_id,
    keyId: key.id,
    scopes: key.scopes ? JSON.parse(key.scopes) : [],
  };
}

/**
 * Extract API key from request headers
 */
export function getApiKeyFromRequest(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return null;
}
