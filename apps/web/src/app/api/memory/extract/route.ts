import { getSession } from "@/lib/auth";
import { getCtx } from "@/lib/db";
import { extractMemories } from "@/lib/memory";
import { NextResponse } from "next/server";

/**
 * POST /api/memory/extract — Manual extraction trigger
 * Body: { sessionId, agentId }
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId, agentId } = await request.json();
    if (!sessionId || !agentId) {
      return NextResponse.json({ error: "sessionId and agentId are required" }, { status: 400 });
    }

    const ctx = await getCtx();
    ctx.waitUntil(extractMemories(sessionId, agentId, session.userId));

    return NextResponse.json({ success: true, message: "Extraction triggered" });
  } catch (error) {
    console.error("Failed to trigger extraction:", error);
    return NextResponse.json({ error: "Failed to trigger extraction" }, { status: 500 });
  }
}
