import { getDB, getEnv } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { NextResponse } from "next/server";
import { encryptAuthHeaders } from "@/lib/mcp-client";

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
        `SELECT id, name, display_name, server_url, transport_type, is_active,
                last_discovered_at, discovery_error, sort_order, created_at, updated_at,
                (SELECT COUNT(*) FROM agent_tools WHERE mcp_server_id = mcp_servers.id AND is_active = 1) as tool_count
         FROM mcp_servers WHERE agent_id = ? AND is_active = 1
         ORDER BY sort_order ASC`
      )
      .bind(agent.id)
      .all();

    const servers = result.results.map((row: Record<string, unknown>) => ({
      id: row.id,
      name: row.name,
      displayName: row.display_name,
      serverUrl: row.server_url,
      transportType: row.transport_type,
      isActive: row.is_active === 1,
      lastDiscoveredAt: row.last_discovered_at,
      discoveryError: row.discovery_error,
      toolCount: row.tool_count,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json({ servers });
  } catch (error) {
    console.error("Failed to fetch MCP servers:", error);
    return NextResponse.json({ error: "Failed to fetch MCP servers" }, { status: 500 });
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
    const { name, displayName, serverUrl, transportType, authHeaders, toolFilter, sortOrder } = body;

    // Validate required fields
    if (!name || typeof name !== "string" || !/^[a-z0-9_-]{2,50}$/.test(name)) {
      return NextResponse.json({ error: "name must be 2-50 lowercase alphanumeric, dash, or underscore" }, { status: 400 });
    }
    if (!displayName || typeof displayName !== "string") {
      return NextResponse.json({ error: "displayName is required" }, { status: 400 });
    }
    if (!serverUrl || typeof serverUrl !== "string") {
      return NextResponse.json({ error: "serverUrl is required" }, { status: 400 });
    }

    // Validate URL
    try {
      const parsed = new URL(serverUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return NextResponse.json({ error: "serverUrl must use http or https" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid serverUrl" }, { status: 400 });
    }

    // Validate transport type
    const validTransports = ["streamable-http", "sse"];
    if (transportType && !validTransports.includes(transportType)) {
      return NextResponse.json({ error: `transportType must be one of: ${validTransports.join(", ")}` }, { status: 400 });
    }

    // Encrypt auth headers if present
    let encryptedHeaders: string | null = null;
    if (authHeaders && typeof authHeaders === "object" && Object.keys(authHeaders).length > 0) {
      encryptedHeaders = await encryptAuthHeaders(authHeaders);
    }

    // Serialize tool filter
    const toolFilterStr = toolFilter && Array.isArray(toolFilter) && toolFilter.length > 0
      ? JSON.stringify(toolFilter)
      : null;

    const id = crypto.randomUUID();

    await db
      .prepare(
        `INSERT INTO mcp_servers (id, agent_id, name, display_name, server_url, transport_type, auth_headers, tool_filter, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        agentId,
        name,
        displayName.trim(),
        serverUrl.trim(),
        transportType || "streamable-http",
        encryptedHeaders,
        toolFilterStr,
        sortOrder || 0
      )
      .run();

    return NextResponse.json({ id, name }, { status: 201 });
  } catch (error) {
    console.error("Failed to create MCP server:", error);
    if (error instanceof Error && error.message.includes("UNIQUE constraint")) {
      return NextResponse.json({ error: "An MCP server with this name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create MCP server" }, { status: 500 });
  }
}
