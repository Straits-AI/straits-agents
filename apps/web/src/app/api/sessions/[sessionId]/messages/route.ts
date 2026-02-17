import { getDB, getCtx } from "@/lib/db";
import { NextResponse } from "next/server";
import { extractMemories } from "@/lib/memory";
import { getSession } from "@/lib/auth";

interface MessageRow {
  id: string;
  role: string;
  content: string;
  citations: string | null;
  created_at: string;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const db = await getDB();

    // Check if session exists and get owner
    const session = await db
      .prepare("SELECT id, user_id FROM sessions WHERE id = ?")
      .bind(sessionId)
      .first<{ id: string; user_id: string | null }>();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Auth: if session has a user, require authentication and ownership
    if (session.user_id) {
      const authSession = await getSession();
      if (!authSession || authSession.userId !== session.user_id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const result = await db
      .prepare(
        `SELECT id, role, content, citations, created_at
         FROM messages WHERE session_id = ? ORDER BY created_at ASC`
      )
      .bind(sessionId)
      .all<MessageRow>();

    const messages = result.results.map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      citations: row.citations ? JSON.parse(row.citations) : undefined,
      createdAt: row.created_at,
    }));

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Failed to fetch messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const { role, content, citations } = await request.json();

    if (!role || !content) {
      return NextResponse.json(
        { error: "role and content are required" },
        { status: 400 }
      );
    }

    const db = await getDB();

    // Check if session exists
    const session = await db
      .prepare("SELECT id, queries_used, agent_id, user_id FROM sessions WHERE id = ?")
      .bind(sessionId)
      .first<{ id: string; queries_used: number; agent_id: string; user_id: string | null }>();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Auth: if session has a user, require authentication and ownership
    if (session.user_id) {
      const authSession = await getSession();
      if (!authSession || authSession.userId !== session.user_id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // Insert message
    const messageId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db
      .prepare(
        `INSERT INTO messages (id, session_id, role, content, citations, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        messageId,
        sessionId,
        role,
        content,
        citations ? JSON.stringify(citations) : null,
        now
      )
      .run();

    // Update session
    let newQueriesUsed = session.queries_used;
    if (role === "user") {
      newQueriesUsed++;
    }

    await db
      .prepare(
        `UPDATE sessions SET queries_used = ?, updated_at = ? WHERE id = ?`
      )
      .bind(newQueriesUsed, now, sessionId)
      .run();

    // Trigger memory extraction every 4 user messages (async, zero latency impact)
    if (role === "assistant" && session.user_id && session.agent_id) {
      const queriesUsed = newQueriesUsed;
      if (queriesUsed > 0 && queriesUsed % 4 === 0) {
        try {
          const ctx = await getCtx();
          ctx.waitUntil(extractMemories(sessionId, session.agent_id, session.user_id));
        } catch (error) {
          console.error("Failed to trigger memory extraction:", error);
        }
      }
    }

    return NextResponse.json({
      messageId,
      queriesUsed: newQueriesUsed,
    });
  } catch (error) {
    console.error("Failed to save message:", error);
    return NextResponse.json(
      { error: "Failed to save message" },
      { status: 500 }
    );
  }
}
