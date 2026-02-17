import { getDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { NextResponse } from "next/server";
import { discoverMcpTools, syncDiscoveredTools, McpServerRow } from "@/lib/mcp-client";

export async function POST(
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
      .prepare("SELECT * FROM mcp_servers WHERE id = ? AND agent_id = ? AND is_active = 1")
      .bind(serverId, agentId)
      .first<McpServerRow>();

    if (!server) {
      return NextResponse.json({ error: "MCP server not found" }, { status: 404 });
    }

    try {
      // Discover tools from the MCP server
      const tools = await discoverMcpTools(server);

      // Sync discovered tools to agent_tools table
      const result = await syncDiscoveredTools(serverId, agentId, tools);

      return NextResponse.json({
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
        sync: result,
      });
    } catch (err) {
      // Store discovery error on the server record
      const errorMessage = err instanceof Error ? err.message : "Discovery failed";
      await db
        .prepare(
          "UPDATE mcp_servers SET discovery_error = ?, updated_at = datetime('now') WHERE id = ?"
        )
        .bind(errorMessage, serverId)
        .run();

      return NextResponse.json(
        { error: `Discovery failed: ${errorMessage}` },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("Failed to discover MCP tools:", error);
    return NextResponse.json({ error: "Failed to discover MCP tools" }, { status: 500 });
  }
}
