/**
 * KV-based Rate Limiter
 * Generic sliding-window rate limiter using Cloudflare KV.
 * Each key tracks a counter with TTL-based expiry.
 */

import { getKV } from "./db";

export interface RateLimitConfig {
  /** KV key prefix (e.g., "rl:login") */
  prefix: string;
  /** Maximum allowed requests in the window */
  maxRequests: number;
  /** Window size in seconds */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Check and increment rate limit for a given identifier.
 * Returns whether the request is allowed and remaining quota.
 */
export async function checkRateLimit(
  config: RateLimitConfig,
  identifier: string
): Promise<RateLimitResult> {
  const kv = await getKV();
  const key = `${config.prefix}:${identifier}`;

  const currentStr = await kv.get(key);
  const current = currentStr ? parseInt(currentStr, 10) : 0;

  if (current >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: config.windowSeconds,
    };
  }

  // Increment counter (TTL set on first request in window)
  await kv.put(key, String(current + 1), {
    expirationTtl: config.windowSeconds,
  });

  return {
    allowed: true,
    remaining: config.maxRequests - current - 1,
    retryAfterSeconds: 0,
  };
}

// ─── Pre-configured Rate Limits ──────────────────────────────────────────────

/** Login: 5 attempts per 15 minutes per email */
export const LOGIN_RATE_LIMIT: RateLimitConfig = {
  prefix: "rl:login",
  maxRequests: 5,
  windowSeconds: 900, // 15 min
};

/** Registration: 3 per hour per IP */
export const REGISTER_RATE_LIMIT: RateLimitConfig = {
  prefix: "rl:register",
  maxRequests: 3,
  windowSeconds: 3600, // 1 hour
};

/** Wallet auth: 10 per minute per address */
export const WALLET_AUTH_RATE_LIMIT: RateLimitConfig = {
  prefix: "rl:wallet",
  maxRequests: 10,
  windowSeconds: 60,
};

/** OTP: 5 per minute per email */
export const OTP_RATE_LIMIT: RateLimitConfig = {
  prefix: "rl:otp",
  maxRequests: 5,
  windowSeconds: 60,
};
