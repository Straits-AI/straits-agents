import { getSession } from "@/lib/auth";
import { runReflector } from "@/lib/memory";
import { NextResponse } from "next/server";

/**
 * POST /api/memory/gc — Run memory reflector (garbage collection)
 * Body: { agentId }
 * Could also be triggered by a cron job.
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { agentId } = await request.json();
    if (!agentId) {
      return NextResponse.json({ error: "agentId is required" }, { status: 400 });
    }

    const result = await runReflector(session.userId, agentId);
    return NextResponse.json({
      success: true,
      expired: result.expired,
      compacted: result.compacted,
    });
  } catch (error) {
    console.error("Failed to run memory GC:", error);
    return NextResponse.json({ error: "Failed to run memory GC" }, { status: 500 });
  }
}
