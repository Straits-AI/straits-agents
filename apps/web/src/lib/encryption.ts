/**
 * Shared AES-256-GCM encryption utilities
 * Used by embedded-wallet.ts (private keys) and llm-providers.ts (API keys)
 *
 * v2 format uses PBKDF2 with random salt for key derivation (stronger than SHA-256).
 * v1 format (legacy) uses SHA-256 direct hashing — kept for backward compatibility.
 * Context separation ensures the same master secret produces different keys per purpose.
 */

const encoder = new TextEncoder();

// PBKDF2 configuration
const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16; // 128-bit salt

/** Encryption contexts for key derivation separation */
export type EncryptionContext =
  | "wallet"       // Embedded wallet private keys
  | "llm-api-key"  // BYOK LLM API keys
  | "webhook"      // Webhook auth headers
  | "mcp"          // MCP server auth headers
  | "default";     // Backward compatible (no context)

// ─── v2 Key Derivation (PBKDF2) ─────────────────────────────────────────────

/**
 * Derive a 256-bit AES key using PBKDF2 with a random salt + context.
 * Much stronger than SHA-256 direct hashing — resistant to brute-force.
 */
async function deriveAesKeyV2(
  secret: string,
  salt: Uint8Array,
  context: EncryptionContext = "default"
): Promise<CryptoKey> {
  const material = context === "default"
    ? secret
    : `${secret}:ctx:${context}`;

  // Import the secret as PBKDF2 key material
  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(material),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  // Derive AES-256-GCM key with PBKDF2
  // Cast salt to BufferSource for Workers TypeScript compat
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// ─── v1 Key Derivation (Legacy SHA-256) ──────────────────────────────────────

/**
 * Derive a 256-bit AES key from a secret string + optional context (legacy).
 * The context ensures the same master secret produces different keys per purpose.
 */
async function deriveAesKeyV1(secret: string, context: EncryptionContext = "default"): Promise<CryptoKey> {
  const material = context === "default"
    ? secret
    : `${secret}:ctx:${context}`;
  const keyMaterial = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(material)
  );
  return crypto.subtle.importKey("raw", keyMaterial, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

// Keep the old export name for any code that imports it directly
export const deriveAesKey = deriveAesKeyV1;

// ─── Encrypt (always v2) ─────────────────────────────────────────────────────

/**
 * Encrypt plaintext with AES-256-GCM using PBKDF2-derived key.
 * Returns format: v2:base64(salt):base64(iv):base64(ciphertext)
 */
export async function encrypt(plaintext: string, secret: string, context?: EncryptionContext): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aesKey = await deriveAesKeyV2(secret, salt, context);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    encoder.encode(plaintext)
  );

  const saltB64 = btoa(String.fromCharCode(...salt));
  const ivB64 = btoa(String.fromCharCode(...iv));
  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));

  return `v2:${saltB64}:${ivB64}:${ctB64}`;
}

// ─── Decrypt (v2 or v1 fallback) ─────────────────────────────────────────────

/**
 * Decrypt AES-256-GCM encrypted string.
 *
 * Supports two formats:
 *   v2: v2:base64(salt):base64(iv):base64(ciphertext)   — PBKDF2
 *   v1: base64(iv):base64(ciphertext)                    — SHA-256 (legacy)
 *
 * For v1, if context-based decryption fails, falls back to "default" context
 * for backward compatibility with pre-context encrypted data.
 */
export async function decrypt(encrypted: string, secret: string, context?: EncryptionContext): Promise<string> {
  // Detect v2 format
  if (encrypted.startsWith("v2:")) {
    return decryptV2(encrypted, secret, context);
  }

  // Legacy v1 format
  return decryptV1(encrypted, secret, context);
}

async function decryptV2(encrypted: string, secret: string, context?: EncryptionContext): Promise<string> {
  const parts = encrypted.split(":");
  // Format: v2:saltB64:ivB64:ctB64
  if (parts.length !== 4 || parts[0] !== "v2") {
    throw new Error("Invalid v2 encrypted data format");
  }

  const salt = Uint8Array.from(atob(parts[1]), (c) => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(parts[2]), (c) => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(parts[3]), (c) => c.charCodeAt(0));

  // Try with provided context first
  if (context && context !== "default") {
    try {
      const aesKey = await deriveAesKeyV2(secret, salt, context);
      const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        aesKey,
        ciphertext
      );
      return new TextDecoder().decode(plaintext);
    } catch {
      // Fall through to default context
    }
  }

  // Default context
  const aesKey = await deriveAesKeyV2(secret, salt, "default");
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    ciphertext
  );
  return new TextDecoder().decode(plaintext);
}

async function decryptV1(encrypted: string, secret: string, context?: EncryptionContext): Promise<string> {
  const [ivB64, ctB64] = encrypted.split(":");
  if (!ivB64 || !ctB64) {
    throw new Error("Invalid encrypted data format");
  }

  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(ctB64), (c) => c.charCodeAt(0));

  // Try with context first
  if (context && context !== "default") {
    try {
      const aesKey = await deriveAesKeyV1(secret, context);
      const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        aesKey,
        ciphertext
      );
      return new TextDecoder().decode(plaintext);
    } catch {
      // Fall through to default context for backward compatibility
    }
  }

  // Default (backward compatible)
  const aesKey = await deriveAesKeyV1(secret, "default");
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    ciphertext
  );

  return new TextDecoder().decode(plaintext);
}
