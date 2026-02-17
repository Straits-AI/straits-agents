import { getSession } from "@/lib/auth";
import { listMemories, clearMemories, getMemoryCount } from "@/lib/memory";
import { NextResponse } from "next/server";

/**
 * GET /api/memory?agentId={id} — List authenticated user's memories with an agent
 */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const agentId = url.searchParams.get("agentId");
    if (!agentId) {
      return NextResponse.json({ error: "agentId is required" }, { status: 400 });
    }

    const memories = await listMemories(session.userId, agentId);
    const count = await getMemoryCount(session.userId, agentId);

    return NextResponse.json({ memories, count });
  } catch (error) {
    console.error("Failed to fetch memories:", error);
    return NextResponse.json({ error: "Failed to fetch memories" }, { status: 500 });
  }
}

/**
 * DELETE /api/memory?agentId={id} — Clear all memories with an agent
 */
export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const agentId = url.searchParams.get("agentId");
    if (!agentId) {
      return NextResponse.json({ error: "agentId is required" }, { status: 400 });
    }

    const deleted = await clearMemories(session.userId, agentId);
    return NextResponse.json({ deleted });
  } catch (error) {
    console.error("Failed to clear memories:", error);
    return NextResponse.json({ error: "Failed to clear memories" }, { status: 500 });
  }
}
