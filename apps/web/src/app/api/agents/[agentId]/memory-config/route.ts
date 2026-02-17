import { getSession } from "@/lib/auth";
import { getDB } from "@/lib/db";
import { getMemoryConfig, updateMemoryConfig } from "@/lib/memory";
import { NextResponse } from "next/server";

/**
 * GET /api/agents/{agentId}/memory-config — Fetch memory config
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { agentId } = await params;

    // Verify ownership
    const db = await getDB();
    const agent = await db
      .prepare("SELECT id, owner_id FROM agents WHERE (id = ? OR slug = ?) AND is_active = 1")
      .bind(agentId, agentId)
      .first<{ id: string; owner_id: string | null }>();

    if (!agent || agent.owner_id !== session.userId) {
      return NextResponse.json({ error: "Agent not found or not owned" }, { status: 404 });
    }

    const config = await getMemoryConfig(agent.id);
    return NextResponse.json(config);
  } catch (error) {
    console.error("Failed to fetch memory config:", error);
    return NextResponse.json({ error: "Failed to fetch memory config" }, { status: 500 });
  }
}

/**
 * PUT /api/agents/{agentId}/memory-config — Update memory config (owner only)
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { agentId } = await params;

    // Verify ownership
    const db = await getDB();
    const agent = await db
      .prepare("SELECT id, owner_id FROM agents WHERE (id = ? OR slug = ?) AND is_active = 1")
      .bind(agentId, agentId)
      .first<{ id: string; owner_id: string | null }>();

    if (!agent || agent.owner_id !== session.userId) {
      return NextResponse.json({ error: "Agent not found or not owned" }, { status: 404 });
    }

    const body = await request.json();
    const { memoryEnabled, extractionInstructions, maxMemoriesPerUser, retentionDays } = body;

    await updateMemoryConfig(agent.id, {
      memoryEnabled,
      extractionInstructions,
      maxMemoriesPerUser,
      retentionDays,
    });

    const updated = await getMemoryConfig(agent.id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update memory config:", error);
    return NextResponse.json({ error: "Failed to update memory config" }, { status: 500 });
  }
}
