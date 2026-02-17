import { getDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ agentId: string; skillId: string }> }
) {
  try {
    const { agentId, skillId } = await params;
    const db = await getDB();

    const skill = await db
      .prepare(
        `SELECT s.* FROM agent_skills s
         JOIN agents a ON s.agent_id = a.id
         WHERE s.id = ? AND (a.id = ? OR a.slug = ?) AND s.is_active = 1`
      )
      .bind(skillId, agentId, agentId)
      .first();

    if (!skill) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: skill.id,
      name: skill.name,
      displayName: skill.display_name,
      description: skill.description,
      version: skill.version,
      instructions: skill.instructions,
      author: skill.author,
      tags: skill.tags ? JSON.parse(skill.tags as string) : [],
      allowedTools: skill.allowed_tools ? JSON.parse(skill.allowed_tools as string) : [],
      isActive: (skill.is_active as number) === 1,
      sortOrder: skill.sort_order,
      createdAt: skill.created_at,
      updatedAt: skill.updated_at,
    });
  } catch (error) {
    console.error("Failed to fetch skill:", error);
    return NextResponse.json({ error: "Failed to fetch skill" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ agentId: string; skillId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { agentId, skillId } = await params;
    const db = await getDB();

    const agent = await db
      .prepare("SELECT id, owner_id FROM agents WHERE id = ? AND is_active = 1")
      .bind(agentId)
      .first<{ id: string; owner_id: string }>();

    if (!agent || agent.owner_id !== session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const existing = await db
      .prepare("SELECT id FROM agent_skills WHERE id = ? AND agent_id = ? AND is_active = 1")
      .bind(skillId, agentId)
      .first();

    if (!existing) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    const body = await request.json();
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (body.displayName !== undefined) {
      updates.push("display_name = ?");
      values.push(body.displayName.trim());
    }
    if (body.description !== undefined) {
      updates.push("description = ?");
      values.push(body.description.trim());
    }
    if (body.version !== undefined) {
      updates.push("version = ?");
      values.push(body.version);
    }
    if (body.instructions !== undefined) {
      updates.push("instructions = ?");
      values.push(body.instructions);
    }
    if (body.author !== undefined) {
      updates.push("author = ?");
      values.push(body.author || null);
    }
    if (body.tags !== undefined) {
      updates.push("tags = ?");
      values.push(body.tags ? JSON.stringify(body.tags) : null);
    }
    if (body.allowedTools !== undefined) {
      updates.push("allowed_tools = ?");
      values.push(body.allowedTools ? JSON.stringify(body.allowedTools) : null);
    }
    if (body.sortOrder !== undefined) {
      updates.push("sort_order = ?");
      values.push(body.sortOrder);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    updates.push("updated_at = datetime('now')");
    values.push(skillId, agentId);

    await db
      .prepare(`UPDATE agent_skills SET ${updates.join(", ")} WHERE id = ? AND agent_id = ?`)
      .bind(...values)
      .run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update skill:", error);
    return NextResponse.json({ error: "Failed to update skill" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ agentId: string; skillId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { agentId, skillId } = await params;
    const db = await getDB();

    const agent = await db
      .prepare("SELECT id, owner_id FROM agents WHERE id = ? AND is_active = 1")
      .bind(agentId)
      .first<{ id: string; owner_id: string }>();

    if (!agent || agent.owner_id !== session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await db
      .prepare("UPDATE agent_skills SET is_active = 0, updated_at = datetime('now') WHERE id = ? AND agent_id = ?")
      .bind(skillId, agentId)
      .run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete skill:", error);
    return NextResponse.json({ error: "Failed to delete skill" }, { status: 500 });
  }
}
