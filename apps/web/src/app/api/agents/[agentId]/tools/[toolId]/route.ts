import { getDB, getEnv } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { NextResponse } from "next/server";
import { encrypt } from "@/lib/encryption";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ agentId: string; toolId: string }> }
) {
  try {
    const { agentId, toolId } = await params;
    const db = await getDB();

    const tool = await db
      .prepare(
        `SELECT t.id, t.name, t.display_name, t.description, t.tool_type, t.webhook_url, t.webhook_method, t.parameters_schema, t.builtin_ref, t.builtin_config, t.timeout_ms, t.rate_limit_per_min, t.requires_approval, t.sort_order, t.is_active, t.created_at, t.updated_at
         FROM agent_tools t
         JOIN agents a ON t.agent_id = a.id
         WHERE t.id = ? AND (a.id = ? OR a.slug = ?) AND t.is_active = 1`
      )
      .bind(toolId, agentId, agentId)
      .first();

    if (!tool) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: tool.id,
      name: tool.name,
      displayName: tool.display_name,
      description: tool.description,
      toolType: tool.tool_type,
      webhookUrl: tool.webhook_url,
      webhookMethod: tool.webhook_method,
      parametersSchema: tool.parameters_schema ? JSON.parse(tool.parameters_schema as string) : {},
      builtinRef: tool.builtin_ref,
      builtinConfig: tool.builtin_config ? JSON.parse(tool.builtin_config as string) : null,
      timeoutMs: tool.timeout_ms,
      rateLimitPerMin: tool.rate_limit_per_min,
      requiresApproval: (tool.requires_approval as number) === 1,
      sortOrder: tool.sort_order,
      isActive: (tool.is_active as number) === 1,
      createdAt: tool.created_at,
      updatedAt: tool.updated_at,
    });
  } catch (error) {
    console.error("Failed to fetch tool:", error);
    return NextResponse.json({ error: "Failed to fetch tool" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ agentId: string; toolId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { agentId, toolId } = await params;
    const db = await getDB();

    // Verify ownership
    const agent = await db
      .prepare("SELECT id, owner_id FROM agents WHERE id = ? AND is_active = 1")
      .bind(agentId)
      .first<{ id: string; owner_id: string }>();

    if (!agent || agent.owner_id !== session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Check tool exists for this agent
    const existing = await db
      .prepare("SELECT id FROM agent_tools WHERE id = ? AND agent_id = ? AND is_active = 1")
      .bind(toolId, agentId)
      .first();

    if (!existing) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
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
    if (body.webhookUrl !== undefined) {
      updates.push("webhook_url = ?");
      values.push(body.webhookUrl || null);
    }
    if (body.webhookMethod !== undefined) {
      updates.push("webhook_method = ?");
      values.push(body.webhookMethod || "POST");
    }
    if (body.webhookHeaders !== undefined) {
      if (body.webhookHeaders && typeof body.webhookHeaders === "object" && Object.keys(body.webhookHeaders).length > 0) {
        const env = await getEnv();
        const encrypted = await encrypt(JSON.stringify(body.webhookHeaders), env.EMBEDDED_WALLET_SECRET, "webhook");
        updates.push("webhook_headers = ?");
        values.push(encrypted);
      } else {
        updates.push("webhook_headers = ?");
        values.push(null);
      }
    }
    if (body.parametersSchema !== undefined) {
      updates.push("parameters_schema = ?");
      values.push(JSON.stringify(body.parametersSchema));
    }
    if (body.timeoutMs !== undefined) {
      updates.push("timeout_ms = ?");
      values.push(body.timeoutMs);
    }
    if (body.rateLimitPerMin !== undefined) {
      updates.push("rate_limit_per_min = ?");
      values.push(body.rateLimitPerMin);
    }
    if (body.requiresApproval !== undefined) {
      updates.push("requires_approval = ?");
      values.push(body.requiresApproval ? 1 : 0);
    }
    if (body.sortOrder !== undefined) {
      updates.push("sort_order = ?");
      values.push(body.sortOrder);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    updates.push("updated_at = datetime('now')");
    values.push(toolId, agentId);

    await db
      .prepare(`UPDATE agent_tools SET ${updates.join(", ")} WHERE id = ? AND agent_id = ?`)
      .bind(...values)
      .run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update tool:", error);
    return NextResponse.json({ error: "Failed to update tool" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ agentId: string; toolId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { agentId, toolId } = await params;
    const db = await getDB();

    const agent = await db
      .prepare("SELECT id, owner_id FROM agents WHERE id = ? AND is_active = 1")
      .bind(agentId)
      .first<{ id: string; owner_id: string }>();

    if (!agent || agent.owner_id !== session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await db
      .prepare("UPDATE agent_tools SET is_active = 0, updated_at = datetime('now') WHERE id = ? AND agent_id = ?")
      .bind(toolId, agentId)
      .run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete tool:", error);
    return NextResponse.json({ error: "Failed to delete tool" }, { status: 500 });
  }
}
