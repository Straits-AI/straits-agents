import { getDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { NextResponse } from "next/server";

const SLUG_REGEX = /^[a-z][a-z0-9-]{1,48}[a-z0-9]$/;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;
    const db = await getDB();

    const agent = await db
      .prepare("SELECT id FROM agents WHERE (id = ? OR slug = ?) AND is_active = 1")
      .bind(agentId, agentId)
      .first<{ id: string }>();

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const result = await db
      .prepare(
        `SELECT id, name, display_name, description, version, instructions, author, tags, allowed_tools, is_active, sort_order, created_at, updated_at
         FROM agent_skills WHERE agent_id = ? AND is_active = 1 ORDER BY sort_order ASC`
      )
      .bind(agent.id)
      .all();

    const skills = result.results.map((row: Record<string, unknown>) => ({
      id: row.id,
      name: row.name,
      displayName: row.display_name,
      description: row.description,
      version: row.version,
      instructions: row.instructions,
      author: row.author,
      tags: row.tags ? JSON.parse(row.tags as string) : [],
      allowedTools: row.allowed_tools ? JSON.parse(row.allowed_tools as string) : [],
      isActive: row.is_active === 1,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json({ skills });
  } catch (error) {
    console.error("Failed to fetch skills:", error);
    return NextResponse.json({ error: "Failed to fetch skills" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { agentId } = await params;
    const db = await getDB();

    const agent = await db
      .prepare("SELECT id, owner_id FROM agents WHERE id = ? AND is_active = 1")
      .bind(agentId)
      .first<{ id: string; owner_id: string }>();

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    if (agent.owner_id !== session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { name, displayName, description, version, instructions, author, tags, allowedTools, sortOrder } = body;

    if (!name || typeof name !== "string" || !SLUG_REGEX.test(name)) {
      return NextResponse.json({ error: "name must be 3-50 lowercase alphanumeric + hyphens" }, { status: 400 });
    }
    if (!displayName || typeof displayName !== "string") {
      return NextResponse.json({ error: "displayName is required" }, { status: 400 });
    }
    if (!description || typeof description !== "string") {
      return NextResponse.json({ error: "description is required" }, { status: 400 });
    }
    if (!instructions || typeof instructions !== "string") {
      return NextResponse.json({ error: "instructions are required" }, { status: 400 });
    }

    const id = crypto.randomUUID();

    await db
      .prepare(
        `INSERT INTO agent_skills (id, agent_id, name, display_name, description, version, instructions, author, tags, allowed_tools, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        agentId,
        name,
        displayName.trim(),
        description.trim(),
        version || "1.0.0",
        instructions,
        author || null,
        tags ? JSON.stringify(tags) : null,
        allowedTools ? JSON.stringify(allowedTools) : null,
        sortOrder || 0
      )
      .run();

    return NextResponse.json({ id, name }, { status: 201 });
  } catch (error) {
    console.error("Failed to create skill:", error);
    if (error instanceof Error && error.message.includes("UNIQUE constraint")) {
      return NextResponse.json({ error: "A skill with this name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create skill" }, { status: 500 });
  }
}
