/**
 * Reputation Cache
 * KV-cached on-chain reputation scores with 5-minute TTL.
 * Provides fast reputation lookups for marketplace filtering and A2A trust checks.
 */

import { getKV, getDB } from "./db";

// ─── Constants ──────────────────────────────────────────────────────────────

const KV_REP_PREFIX = "rep:";
const KV_REP_TTL = 300; // 5 minutes

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CachedReputation {
  agentId: string;
  score: number;        // 0-100 scale
  totalReviews: number;
  avgRating: number;    // 0-5 scale
  updatedAt: string;
}

// ─── Cache Functions ────────────────────────────────────────────────────────

/**
 * Get cached reputation for an agent.
 * Falls back to DB if not cached.
 */
export async function getCachedReputation(agentId: string): Promise<CachedReputation> {
  const kv = await getKV();
  const cacheKey = `${KV_REP_PREFIX}${agentId}`;

  // Try cache
  const cached = await kv.get(cacheKey, "json");
  if (cached) return cached as CachedReputation;

  // Fall back to DB
  const rep = await fetchReputationFromDB(agentId);

  // Cache it
  await kv.put(cacheKey, JSON.stringify(rep), { expirationTtl: KV_REP_TTL });

  return rep;
}

/**
 * Get reputation for multiple agents (batched).
 */
export async function getCachedReputations(agentIds: string[]): Promise<Map<string, CachedReputation>> {
  const results = new Map<string, CachedReputation>();
  const uncached: string[] = [];
  const kv = await getKV();

  // Check cache for each
  for (const id of agentIds) {
    const cached = await kv.get(`${KV_REP_PREFIX}${id}`, "json");
    if (cached) {
      results.set(id, cached as CachedReputation);
    } else {
      uncached.push(id);
    }
  }

  // Batch fetch uncached from DB
  if (uncached.length > 0) {
    const db = await getDB();
    for (const id of uncached) {
      const rep = await fetchReputationFromDB(id);
      results.set(id, rep);
      await kv.put(`${KV_REP_PREFIX}${id}`, JSON.stringify(rep), { expirationTtl: KV_REP_TTL });
    }
  }

  return results;
}

/**
 * Invalidate cached reputation for an agent.
 * Call this after new feedback is submitted.
 */
export async function invalidateReputation(agentId: string): Promise<void> {
  const kv = await getKV();
  await kv.delete(`${KV_REP_PREFIX}${agentId}`);
}

// ─── Internal ───────────────────────────────────────────────────────────────

async function fetchReputationFromDB(agentId: string): Promise<CachedReputation> {
  const db = await getDB();

  const result = await db
    .prepare(
      `SELECT AVG(rating) as avg_rating, COUNT(*) as total_reviews
       FROM feedback WHERE agent_id = ?`
    )
    .bind(agentId)
    .first<{ avg_rating: number | null; total_reviews: number }>();

  const avgRating = result?.avg_rating || 0;
  const totalReviews = result?.total_reviews || 0;

  return {
    agentId,
    score: totalReviews > 0 ? Math.round(avgRating * 20) : 0, // 5-star → 0-100
    totalReviews,
    avgRating: Math.round(avgRating * 100) / 100,
    updatedAt: new Date().toISOString(),
  };
}
