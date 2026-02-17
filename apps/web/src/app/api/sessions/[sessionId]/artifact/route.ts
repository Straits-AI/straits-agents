import { NextResponse } from "next/server";
import { generateArtifact, getArtifact } from "@/lib/artifacts";
import { getDB } from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET artifact for a session
export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;

    const db = await getDB();

    // Get session's artifact ID and owner
    const session = await db
      .prepare("SELECT artifact_id, user_id FROM sessions WHERE id = ?")
      .bind(sessionId)
      .first<{ artifact_id: string | null; user_id: string | null }>();

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

    if (!session.artifact_id) {
      return NextResponse.json({ artifact: null });
    }

    const artifact = await getArtifact(session.artifact_id);

    return NextResponse.json({ artifact });
  } catch (error) {
    console.error("Failed to fetch artifact:", error);
    return NextResponse.json(
      { error: "Failed to fetch artifact" },
      { status: 500 }
    );
  }
}

// POST generate artifact for a session
export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;

    const db = await getDB();

    // Verify session exists and check ownership
    const sessionRow = await db
      .prepare("SELECT id, user_id FROM sessions WHERE id = ?")
      .bind(sessionId)
      .first<{ id: string; user_id: string | null }>();

    if (!sessionRow) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (sessionRow.user_id) {
      const authSession = await getSession();
      if (!authSession || authSession.userId !== sessionRow.user_id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const { type, title, data } = await request.json();

    if (!type || !title) {
      return NextResponse.json(
        { error: "type and title are required" },
        { status: 400 }
      );
    }

    const artifact = await generateArtifact(sessionId, type, title, data || {});

    return NextResponse.json({ artifact });
  } catch (error) {
    console.error("Failed to generate artifact:", error);
    return NextResponse.json(
      { error: "Failed to generate artifact" },
      { status: 500 }
    );
  }
}
