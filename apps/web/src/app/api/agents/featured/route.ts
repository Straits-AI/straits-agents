import { getDB } from "@/lib/db";
import { NextResponse } from "next/server";

interface FeaturedAgentRow {
  id: string;
  name: string;
  description: string;
  category: string;
  type: string;
  icon: string;
  pricing_type: string;
  price_per_query: number;
  free_queries: number;
  capabilities: string | null;
  is_featured: number;
  featured_order: number;
  avg_rating: number | null;
  total_reviews: number;
}

// GET featured agents
export async function GET() {
  try {
    const db = await getDB();

    // Fetch featured agents (manually marked OR high-rated with many reviews)
    const result = await db
      .prepare(
        `SELECT
           a.id, a.name, a.description, a.category, a.type, a.icon,
           a.pricing_type, a.price_per_query, a.free_queries, a.capabilities,
           COALESCE(a.is_featured, 0) as is_featured,
           COALESCE(a.featured_order, 999) as featured_order,
           COALESCE(f.avg_rating, 0) as avg_rating,
           COALESCE(f.total_reviews, 0) as total_reviews
         FROM agents a
         LEFT JOIN (
           SELECT agent_id, AVG(rating) as avg_rating, COUNT(*) as total_reviews
           FROM feedback GROUP BY agent_id
         ) f ON a.id = f.agent_id
         WHERE a.is_active = 1
           AND (
             a.is_featured = 1
             OR (COALESCE(f.avg_rating, 0) >= 4.5 AND COALESCE(f.total_reviews, 0) >= 10)
           )
         ORDER BY
           a.is_featured DESC,
           a.featured_order ASC,
           f.avg_rating DESC,
           f.total_reviews DESC
         LIMIT 6`
      )
      .all<FeaturedAgentRow>();

    const agents = result.results.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      type: row.type,
      icon: row.icon,
      pricingType: row.pricing_type,
      pricePerQuery: row.price_per_query,
      freeQueries: row.free_queries,
      capabilities: row.capabilities ? JSON.parse(row.capabilities) : [],
      isFeatured: row.is_featured === 1,
      stats: {
        avgRating: Math.round((row.avg_rating || 0) * 100) / 100,
        totalReviews: row.total_reviews,
      },
    }));

    return NextResponse.json({ agents });
  } catch (error) {
    console.error("Failed to fetch featured agents:", error);
    return NextResponse.json(
      { error: "Failed to fetch featured agents" },
      { status: 500 }
    );
  }
}
