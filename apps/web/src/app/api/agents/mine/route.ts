import { getDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { NextResponse } from "next/server";

interface MyAgentRow {
  id: string;
  name: string;
  description: string;
  category: string;
  type: string;
  icon: string;
  slug: string | null;
  template: string | null;
  pricing_type: string;
  is_active: number;
  created_at: string;
  total_sessions: number;
  total_documents: number;
  unique_users: number;
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const db = await getDB();

    const result = await db
      .prepare(
        `SELECT
           a.id, a.name, a.description, a.category, a.type, a.icon,
           a.slug, a.template, a.pricing_type, a.is_active, a.created_at,
           COALESCE(s.total_sessions, 0) as total_sessions,
           COALESCE(d.total_documents, 0) as total_documents,
           COALESCE(s.unique_users, 0) as unique_users
         FROM agents a
         LEFT JOIN (
           SELECT agent_id, COUNT(*) as total_sessions, COUNT(DISTINCT user_id) as unique_users
           FROM sessions GROUP BY agent_id
         ) s ON a.id = s.agent_id
         LEFT JOIN (
           SELECT agent_id, COUNT(*) as total_documents
           FROM documents GROUP BY agent_id
         ) d ON a.id = d.agent_id
         WHERE a.owner_id = ? AND a.is_active = 1
         ORDER BY a.created_at DESC`
      )
      .bind(session.userId)
      .all<MyAgentRow>();

    const agents = result.results.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      type: row.type,
      icon: row.icon,
      slug: row.slug,
      template: row.template,
      pricingType: row.pricing_type,
      isActive: row.is_active === 1,
      createdAt: row.created_at,
      stats: {
        totalSessions: row.total_sessions,
        totalDocuments: row.total_documents,
        uniqueUsers: row.unique_users,
      },
    }));

    return NextResponse.json({ agents });
  } catch (error) {
    console.error("Failed to fetch user agents:", error);
    return NextResponse.json(
      { error: "Failed to fetch agents" },
      { status: 500 }
    );
  }
}
