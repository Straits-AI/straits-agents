import { getDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { agentId } = await request.json();

    if (!agentId) {
      return NextResponse.json(
        { error: "agentId is required" },
        { status: 400 }
      );
    }

    const db = await getDB();

    // Check if agent exists (resolve by id or slug)
    const agent = await db
      .prepare("SELECT id FROM agents WHERE (id = ? OR slug = ?) AND is_active = 1")
      .bind(agentId, agentId)
      .first<{ id: string }>();

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Use the resolved UUID for the session
    const resolvedAgentId = agent.id;

    // Get user session if authenticated
    const userSession = await getSession();
    const userId = userSession?.userId || null;

    // Create session
    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

    await db
      .prepare(
        `INSERT INTO sessions (id, agent_id, user_id, queries_used, payment_status, created_at, updated_at, expires_at)
         VALUES (?, ?, ?, 0, 'free', ?, ?, ?)`
      )
      .bind(sessionId, resolvedAgentId, userId, now, now, expiresAt)
      .run();

    return NextResponse.json({
      sessionId,
      agentId: resolvedAgentId,
      expiresAt,
    });
  } catch (error) {
    console.error("Failed to create session:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const userSession = await getSession();
    if (!userSession) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDB();
    const url = new URL(request.url);
    const agentId = url.searchParams.get("agentId");

    let query = `
      SELECT s.id, s.agent_id, s.queries_used, s.created_at, a.name as agent_name, a.icon as agent_icon
      FROM sessions s
      JOIN agents a ON s.agent_id = a.id
      WHERE s.user_id = ? AND s.expires_at > datetime('now')
    `;
    const params: string[] = [userSession.userId];

    if (agentId) {
      query += " AND s.agent_id = ?";
      params.push(agentId);
    }

    query += " ORDER BY s.updated_at DESC LIMIT 50";

    const result = await db
      .prepare(query)
      .bind(...params)
      .all();

    return NextResponse.json({ sessions: result.results });
  } catch (error) {
    console.error("Failed to fetch sessions:", error);
    return NextResponse.json(
      { error: "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}
