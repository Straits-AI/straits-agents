import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSession } from "@/lib/auth";

interface UsageStats {
  period: string;
  apiCalls: number;
  sessions: number;
  totalSpend: number;
  queriesByAgent: { agentId: string; agentName: string; count: number }[];
  dailyUsage: { date: string; calls: number; spend: number }[];
}

// GET usage statistics for current user
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "30d"; // 7d, 30d, 90d

    const db = await getDB();

    // Calculate date range
    const now = new Date();
    let daysBack = 30;
    if (period === "7d") daysBack = 7;
    else if (period === "90d") daysBack = 90;

    const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
    const startDateStr = startDate.toISOString();

    // Get total sessions count
    const sessionsResult = await db
      .prepare(
        `SELECT COUNT(*) as count FROM sessions
         WHERE user_id = ? AND created_at >= ?`
      )
      .bind(session.userId, startDateStr)
      .first<{ count: number }>();

    // Get total queries (approximated by sum of queries_used)
    const queriesResult = await db
      .prepare(
        `SELECT COALESCE(SUM(queries_used), 0) as count FROM sessions
         WHERE user_id = ? AND created_at >= ?`
      )
      .bind(session.userId, startDateStr)
      .first<{ count: number }>();

    // Get total spend from payments
    const spendResult = await db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) as total FROM payments
         WHERE user_id = ? AND created_at >= ? AND status = 'completed'`
      )
      .bind(session.userId, startDateStr)
      .first<{ total: number }>();

    // Get queries by agent
    const agentUsage = await db
      .prepare(
        `SELECT s.agent_id, a.name as agent_name, SUM(s.queries_used) as count
         FROM sessions s
         LEFT JOIN agents a ON s.agent_id = a.id
         WHERE s.user_id = ? AND s.created_at >= ?
         GROUP BY s.agent_id
         ORDER BY count DESC
         LIMIT 10`
      )
      .bind(session.userId, startDateStr)
      .all<{ agent_id: string; agent_name: string | null; count: number }>();

    // Get daily usage for chart
    const dailyUsage = await db
      .prepare(
        `SELECT
           DATE(created_at) as date,
           SUM(queries_used) as calls
         FROM sessions
         WHERE user_id = ? AND created_at >= ?
         GROUP BY DATE(created_at)
         ORDER BY date ASC`
      )
      .bind(session.userId, startDateStr)
      .all<{ date: string; calls: number }>();

    // Get daily spend
    const dailySpend = await db
      .prepare(
        `SELECT
           DATE(created_at) as date,
           SUM(amount) as spend
         FROM payments
         WHERE user_id = ? AND created_at >= ? AND status = 'completed'
         GROUP BY DATE(created_at)
         ORDER BY date ASC`
      )
      .bind(session.userId, startDateStr)
      .all<{ date: string; spend: number }>();

    // Merge daily usage and spend
    const dailyMap = new Map<string, { calls: number; spend: number }>();

    for (const row of dailyUsage.results) {
      dailyMap.set(row.date, { calls: row.calls, spend: 0 });
    }

    for (const row of dailySpend.results) {
      const existing = dailyMap.get(row.date);
      if (existing) {
        existing.spend = row.spend;
      } else {
        dailyMap.set(row.date, { calls: 0, spend: row.spend });
      }
    }

    const dailyData = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const stats: UsageStats = {
      period,
      apiCalls: queriesResult?.count || 0,
      sessions: sessionsResult?.count || 0,
      totalSpend: spendResult?.total || 0,
      queriesByAgent: agentUsage.results.map((r) => ({
        agentId: r.agent_id,
        agentName: r.agent_name || "Unknown",
        count: r.count,
      })),
      dailyUsage: dailyData,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Failed to fetch usage stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch usage statistics" },
      { status: 500 }
    );
  }
}
