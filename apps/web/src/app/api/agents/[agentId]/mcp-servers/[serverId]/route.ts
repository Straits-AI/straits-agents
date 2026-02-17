import { getDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { NextResponse } from "next/server";
import { encryptAuthHeaders, McpServerRow } from "@/lib/mcp-client";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ agentId: string; serverId: string }> }
) {
  try {
    const { agentId, serverId } = await params;
    const db = await getDB();

    // Resolve agent
    const agent = await db
      .prepare("SELECT id FROM agents WHERE (id = ? OR slug = ?) AND is_active = 1")
      .bind(agentId, agentId)
      .first<{ id: string }>();

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const server = await db
      .prepare("SELECT * FROM mcp_servers WHERE id = ? AND agent_id = ? AND is_active = 1")
      .bind(serverId, agent.id)
      .first<McpServerRow>();

    if (!server) {
      return NextResponse.json({ error: "MCP server not found" }, { status: 404 });
    }

    // Get discovered tools count
    const toolCount = await db
      .prepare("SELECT COUNT(*) as cnt FROM agent_tools WHERE mcp_server_id = ? AND is_active = 1")
      .bind(serverId)
      .first<{ cnt: number }>();

    return NextResponse.json({
      id: server.id,
      name: server.name,
      displayName: server.display_name,
      serverUrl: server.server_url,
      transportType: server.transport_type,
      isActive: server.is_active === 1,
      lastDiscoveredAt: server.last_discovered_at,
      cachedTools: server.cached_tools ? JSON.parse(server.cached_tools) : [],
      discoveryError: server.discovery_error,
      toolCount: toolCount?.cnt || 0,
      sortOrder: server.sort_order,
      createdAt: server.created_at,
      updatedAt: server.updated_at,
    });
  } catch (error) {
    console.error("Failed to fetch MCP server:", error);
    return NextResponse.json({ error: "Failed to fetch MCP server" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ agentId: string; serverId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { agentId, serverId } = await params;
    const db = await getDB();

    // Verify ownership
    const agent = await db
      .prepare("SELECT id, owner_id FROM agents WHERE id = ? AND is_active = 1")
      .bind(agentId)
      .first<{ id: string; owner_id: string }>();

    if (!agent || agent.owner_id !== session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const server = await db
      .prepare("SELECT id FROM mcp_servers WHERE id = ? AND agent_id = ? AND is_active = 1")
      .bind(serverId, agentId)
      .first<{ id: string }>();

    if (!server) {
      return NextResponse.json({ error: "MCP server not found" }, { status: 404 });
    }

    const body = await request.json();
    const { displayName, serverUrl, transportType, authHeaders, toolFilter } = body;

    const updates: string[] = [];
    const values: unknown[] = [];

    if (displayName !== undefined) {
      updates.push("display_name = ?");
      values.push(displayName.trim());
    }
    if (serverUrl !== undefined) {
      try {
        const parsed = new URL(serverUrl);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          return NextResponse.json({ error: "serverUrl must use http or https" }, { status: 400 });
        }
      } catch {
        return NextResponse.json({ error: "Invalid serverUrl" }, { status: 400 });
      }
      updates.push("server_url = ?");
      values.push(serverUrl.trim());
    }
    if (transportType !== undefined) {
      updates.push("transport_type = ?");
      values.push(transportType);
    }
    if (authHeaders !== undefined) {
      if (authHeaders && typeof authHeaders === "object" && Object.keys(authHeaders).length > 0) {
        const encrypted = await encryptAuthHeaders(authHeaders);
        updates.push("auth_headers = ?");
        values.push(encrypted);
      } else {
        updates.push("auth_headers = NULL");
      }
    }
    if (toolFilter !== undefined) {
      updates.push("tool_filter = ?");
      values.push(toolFilter && toolFilter.length > 0 ? JSON.stringify(toolFilter) : null);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    updates.push("updated_at = datetime('now')");
    values.push(serverId);

    await db
      .prepare(`UPDATE mcp_servers SET ${updates.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update MCP server:", error);
    return NextResponse.json({ error: "Failed to update MCP server" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ agentId: string; serverId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { agentId, serverId } = await params;
    const db = await getDB();

    // Verify ownership
    const agent = await db
      .prepare("SELECT id, owner_id FROM agents WHERE id = ? AND is_active = 1")
      .bind(agentId)
      .first<{ id: string; owner_id: string }>();

    if (!agent || agent.owner_id !== session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Soft-delete server
    await db
      .prepare("UPDATE mcp_servers SET is_active = 0, updated_at = datetime('now') WHERE id = ? AND agent_id = ?")
      .bind(serverId, agentId)
      .run();

    // Soft-delete associated MCP tools
    await db
      .prepare("UPDATE agent_tools SET is_active = 0, updated_at = datetime('now') WHERE mcp_server_id = ? AND agent_id = ?")
      .bind(serverId, agentId)
      .run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete MCP server:", error);
    return NextResponse.json({ error: "Failed to delete MCP server" }, { status: 500 });
  }
}
