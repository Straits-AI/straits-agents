/**
 * Agent Discovery
 * Search marketplace for agents by capability, with optional reputation filtering.
 * Used by the discover_agents and call_agent builtin tools.
 */

import { getDB, getKV } from "./db";
import { getReputationOnChain, DEFAULT_CHAIN_ID } from "./contracts";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DiscoveredAgent {
  id: string;
  name: string;
  description: string;
  slug: string | null;
  icon: string;
  pricingType: string;
  pricePerQuery: number;
  capabilities: string[];
  reputationScore: number | null;
}

// ─── Discovery ──────────────────────────────────────────────────────────────

/**
 * Search the marketplace for agents matching a query.
 */
export async function discoverAgents(
  query: string,
  options?: {
    minReputation?: number;
    category?: string;
    excludeAgentId?: string;
    limit?: number;
  }
): Promise<DiscoveredAgent[]> {
  const db = await getDB();
  const limit = options?.limit || 5;

  const whereClauses = ["a.is_active = 1"];
  const params: (string | number)[] = [];

  if (options?.excludeAgentId) {
    whereClauses.push("a.id != ?");
    params.push(options.excludeAgentId);
  }

  if (options?.category) {
    whereClauses.push("a.category = ?");
    params.push(options.category);
  }

  // Text search on name and description
  if (query) {
    whereClauses.push("(a.name LIKE ? OR a.description LIKE ?)");
    params.push(`%${query}%`, `%${query}%`);
  }

  const result = await db
    .prepare(
      `SELECT a.id, a.name, a.description, a.slug, a.icon, a.pricing_type, a.price_per_query, a.capabilities,
              COALESCE(f.avg_rating, 0) as avg_rating, COALESCE(f.total_reviews, 0) as total_reviews
       FROM agents a
       LEFT JOIN (
         SELECT agent_id, AVG(rating) as avg_rating, COUNT(*) as total_reviews
         FROM feedback GROUP BY agent_id
       ) f ON a.id = f.agent_id
       WHERE ${whereClauses.join(" AND ")}
       ORDER BY avg_rating DESC, total_reviews DESC
       LIMIT ?`
    )
    .bind(...params, limit)
    .all<{
      id: string;
      name: string;
      description: string;
      slug: string | null;
      icon: string;
      pricing_type: string;
      price_per_query: number;
      capabilities: string | null;
      avg_rating: number;
      total_reviews: number;
    }>();

  return result.results.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    slug: row.slug,
    icon: row.icon,
    pricingType: row.pricing_type,
    pricePerQuery: row.price_per_query,
    capabilities: row.capabilities ? JSON.parse(row.capabilities) : [],
    reputationScore: row.total_reviews > 0 ? Math.round(row.avg_rating * 20) : null, // Convert 5-star to 0-100
  }));
}

/**
 * Check if an agent meets a minimum reputation threshold.
 * Uses cached reputation when available, falls back to DB rating.
 */
export async function checkReputationThreshold(
  agentId: string,
  minScore: number
): Promise<{ passes: boolean; score: number }> {
  const db = await getDB();

  // First try DB rating (fast path)
  const rating = await db
    .prepare(
      `SELECT AVG(rating) as avg_rating, COUNT(*) as total_reviews
       FROM feedback WHERE agent_id = ?`
    )
    .bind(agentId)
    .first<{ avg_rating: number | null; total_reviews: number }>();

  if (!rating || rating.total_reviews === 0) {
    // No reviews — pass by default (new agents shouldn't be blocked)
    return { passes: true, score: 0 };
  }

  // Convert 5-star rating to 0-100 score
  const score = Math.round((rating.avg_rating || 0) * 20);
  return { passes: score >= minScore, score };
}
