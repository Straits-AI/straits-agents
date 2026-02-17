import { getDB, getEnv } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { NextResponse } from "next/server";
import { encrypt } from "@/lib/encryption";

const VALID_TOOL_TYPES = ["webhook", "builtin", "mcp"];
const VALID_BUILTIN_REFS = ["search_documents", "get_user_memory", "think", "call_agent", "discover_agents"];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;
    const db = await getDB();

    // Resolve agent by id or slug
    const agent = await db
      .prepare("SELECT id FROM agents WHERE (id = ? OR slug = ?) AND is_active = 1")
      .bind(agentId, agentId)
      .first<{ id: string }>();

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const result = await db
      .prepare(
        `SELECT id, name, display_name, description, tool_type, webhook_url, webhook_method, parameters_schema, builtin_ref, builtin_config, timeout_ms, rate_limit_per_min, requires_approval, sort_order, is_active, created_at, updated_at
         FROM agent_tools WHERE agent_id = ? AND is_active = 1 ORDER BY sort_order ASC`
      )
      .bind(agent.id)
      .all();

    const tools = result.results.map((row: Record<string, unknown>) => ({
      id: row.id,
      name: row.name,
      displayName: row.display_name,
      description: row.description,
      toolType: row.tool_type,
      webhookUrl: row.webhook_url,
      webhookMethod: row.webhook_method,
      parametersSchema: row.parameters_schema ? JSON.parse(row.parameters_schema as string) : {},
      builtinRef: row.builtin_ref,
      builtinConfig: row.builtin_config ? JSON.parse(row.builtin_config as string) : null,
      timeoutMs: row.timeout_ms,
      rateLimitPerMin: row.rate_limit_per_min,
      requiresApproval: row.requires_approval === 1,
      sortOrder: row.sort_order,
      isActive: row.is_active === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json({ tools });
  } catch (error) {
    console.error("Failed to fetch tools:", error);
    return NextResponse.json({ error: "Failed to fetch tools" }, { status: 500 });
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

    // Verify ownership
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
    const { name, displayName, description, toolType, webhookUrl, webhookMethod, webhookHeaders, parametersSchema, builtinRef, builtinConfig, timeoutMs, rateLimitPerMin, requiresApproval, sortOrder } = body;

    // Validate required fields
    if (!name || typeof name !== "string" || !/^[a-z_][a-z0-9_]{1,48}$/.test(name)) {
      return NextResponse.json({ error: "name must be 2-50 lowercase alphanumeric + underscore" }, { status: 400 });
    }
    if (!displayName || typeof displayName !== "string") {
      return NextResponse.json({ error: "displayName is required" }, { status: 400 });
    }
    if (!description || typeof description !== "string") {
      return NextResponse.json({ error: "description is required" }, { status: 400 });
    }
    if (!VALID_TOOL_TYPES.includes(toolType)) {
      return NextResponse.json({ error: "toolType must be one of: webhook, builtin" }, { status: 400 });
    }

    // Type-specific validation
    if (toolType === "webhook") {
      if (!webhookUrl || typeof webhookUrl !== "string") {
        return NextResponse.json({ error: "webhookUrl is required for webhook tools" }, { status: 400 });
      }
      try {
        const parsed = new URL(webhookUrl);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          return NextResponse.json({ error: "webhookUrl must use http or https" }, { status: 400 });
        }
      } catch {
        return NextResponse.json({ error: "Invalid webhookUrl" }, { status: 400 });
      }
    }

    if (toolType === "builtin") {
      if (!builtinRef || !VALID_BUILTIN_REFS.includes(builtinRef)) {
        return NextResponse.json({ error: `builtinRef must be one of: ${VALID_BUILTIN_REFS.join(", ")}` }, { status: 400 });
      }
    }

    if (toolType === "mcp") {
      if (!body.mcpServerId || typeof body.mcpServerId !== "string") {
        return NextResponse.json({ error: "mcpServerId is required for MCP tools" }, { status: 400 });
      }
    }

    // Encrypt webhook headers if present
    let encryptedHeaders: string | null = null;
    if (webhookHeaders && typeof webhookHeaders === "object" && Object.keys(webhookHeaders).length > 0) {
      const env = await getEnv();
      encryptedHeaders = await encrypt(JSON.stringify(webhookHeaders), env.EMBEDDED_WALLET_SECRET, "webhook");
    }

    const schemaStr = parametersSchema ? JSON.stringify(parametersSchema) : '{"type":"object","properties":{}}';
    const id = crypto.randomUUID();

    await db
      .prepare(
        `INSERT INTO agent_tools (id, agent_id, name, display_name, description, tool_type, webhook_url, webhook_method, webhook_headers, parameters_schema, builtin_ref, builtin_config, timeout_ms, rate_limit_per_min, requires_approval, sort_order, mcp_server_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        agentId,
        name,
        displayName.trim(),
        description.trim(),
        toolType,
        webhookUrl || null,
        webhookMethod || "POST",
        encryptedHeaders,
        schemaStr,
        builtinRef || null,
        builtinConfig ? JSON.stringify(builtinConfig) : null,
        timeoutMs || 10000,
        rateLimitPerMin || 30,
        requiresApproval ? 1 : 0,
        sortOrder || 0,
        body.mcpServerId || null
      )
      .run();

    return NextResponse.json({ id, name }, { status: 201 });
  } catch (error) {
    console.error("Failed to create tool:", error);
    if (error instanceof Error && error.message.includes("UNIQUE constraint")) {
      return NextResponse.json({ error: "A tool with this name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create tool" }, { status: 500 });
  }
}
