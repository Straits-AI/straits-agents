/**
 * MCP Client Library
 * Lightweight Streamable HTTP / SSE client for Model Context Protocol servers.
 * Uses fetch() directly (no @modelcontextprotocol/sdk) for Cloudflare Workers compatibility.
 */

import { getDB, getEnv } from "./db";
import { encrypt, decrypt } from "./encryption";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface McpServerRow {
  id: string;
  agent_id: string;
  name: string;
  display_name: string;
  server_url: string;
  transport_type: string;
  auth_headers: string | null;
  tool_filter: string | null;
  is_active: number;
  last_discovered_at: string | null;
  cached_tools: string | null;
  discovery_error: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

// ─── Constants ──────────────────────────────────────────────────────────────

const MCP_TIMEOUT_MS = 10000;
const KV_CACHE_TTL = 300; // 5 minutes

const SSRF_BLOCKED_PATTERNS = [
  /^https?:\/\/localhost/i,
  /^https?:\/\/127\./,
  /^https?:\/\/0\./,
  /^https?:\/\/0+\./,       // Octal/zero-padded IPs
  /^https?:\/\/10\./,
  /^https?:\/\/172\.(1[6-9]|2\d|3[0-1])\./,
  /^https?:\/\/192\.168\./,
  /^https?:\/\/169\.254\./,
  /^https?:\/\/\[::1\]/,
  /^https?:\/\/\[0*:0*:0*:0*:0*:0*:0*:0*1?\]/, // Expanded IPv6 loopback
  /^https?:\/\/\[::ffff:/i,  // IPv4-mapped IPv6
  /^https?:\/\/\[fc/i,
  /^https?:\/\/\[fd/i,
  /^https?:\/\/\[fe80/i,
  /^file:/i,
  /^ftp:/i,
  /^data:/i,
];

// ─── SSRF Protection ─────────────────────────────────────────────────────────

function isUrlSafe(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === "0.0.0.0" || hostname === "[::0]" || hostname === "[::1]") return false;
    for (const pattern of SSRF_BLOCKED_PATTERNS) {
      if (pattern.test(url)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

// ─── JSON-RPC Helpers ────────────────────────────────────────────────────────

let rpcIdCounter = 1;

function createJsonRpcRequest(method: string, params?: Record<string, unknown>): JsonRpcRequest {
  return {
    jsonrpc: "2.0",
    id: rpcIdCounter++,
    method,
    params,
  };
}

async function sendJsonRpc(
  url: string,
  method: string,
  params: Record<string, unknown> | undefined,
  headers: Record<string, string>
): Promise<JsonRpcResponse> {
  const body = createJsonRpcRequest(method, params);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MCP_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      redirect: "manual", // Prevent SSRF via redirect to internal IPs
    });

    // Reject redirects to unsafe URLs
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || !isUrlSafe(new URL(location, url).href)) {
        throw new Error("MCP server redirected to blocked URL");
      }
      // Follow one safe redirect
      const redirectResponse = await fetch(new URL(location, url).href, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", ...headers },
        body: JSON.stringify(body),
        signal: controller.signal,
        redirect: "error",
      });
      if (!redirectResponse.ok) {
        throw new Error(`MCP server returned HTTP ${redirectResponse.status}: ${redirectResponse.statusText}`);
      }
      const redirectCt = redirectResponse.headers.get("content-type") || "";
      if (redirectCt.includes("text/event-stream")) {
        return parseSSEResponse(redirectResponse);
      }
      return await redirectResponse.json() as JsonRpcResponse;
    }

    if (!response.ok) {
      throw new Error(`MCP server returned HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "";

    // Streamable HTTP may return SSE-style response
    if (contentType.includes("text/event-stream")) {
      return parseSSEResponse(response);
    }

    const result = await response.json() as JsonRpcResponse;
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

async function parseSSEResponse(response: Response): Promise<JsonRpcResponse> {
  const text = await response.text();
  const lines = text.split("\n");
  let lastData = "";

  for (const line of lines) {
    if (line.startsWith("data: ")) {
      lastData = line.slice(6);
    }
  }

  if (!lastData) {
    throw new Error("No data in SSE response");
  }

  return JSON.parse(lastData) as JsonRpcResponse;
}

// ─── Auth Header Helpers ─────────────────────────────────────────────────────

async function decryptAuthHeaders(
  encryptedHeaders: string | null
): Promise<Record<string, string>> {
  if (!encryptedHeaders) return {};

  try {
    const env = await getEnv();
    const decrypted = await decrypt(encryptedHeaders, env.EMBEDDED_WALLET_SECRET, "mcp");
    return JSON.parse(decrypted);
  } catch {
    console.error("Failed to decrypt MCP auth headers");
    return {};
  }
}

export async function encryptAuthHeaders(
  headers: Record<string, string>
): Promise<string> {
  const env = await getEnv();
  return encrypt(JSON.stringify(headers), env.EMBEDDED_WALLET_SECRET, "mcp");
}

// ─── Discovery ───────────────────────────────────────────────────────────────

/**
 * Connect to an MCP server and discover available tools via tools/list.
 */
export async function discoverMcpTools(
  server: McpServerRow
): Promise<McpToolDefinition[]> {
  if (!isUrlSafe(server.server_url)) {
    throw new Error("MCP server URL is blocked for security reasons");
  }

  const authHeaders = await decryptAuthHeaders(server.auth_headers);

  // For SSE transport, we need to first connect to get the messages endpoint
  if (server.transport_type === "sse") {
    return discoverViaSse(server.server_url, authHeaders, server.tool_filter);
  }

  // Streamable HTTP: send JSON-RPC directly
  // Initialize the connection first
  try {
    await sendJsonRpc(server.server_url, "initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "straits-agents", version: "1.0.0" },
    }, authHeaders);
  } catch {
    // Some servers don't require initialization — try tools/list directly
  }

  const response = await sendJsonRpc(
    server.server_url,
    "tools/list",
    {},
    authHeaders
  );

  if (response.error) {
    throw new Error(`MCP tools/list error: ${response.error.message}`);
  }

  const result = response.result as { tools?: McpToolDefinition[] };
  let tools = result.tools || [];

  // Apply tool filter if configured
  if (server.tool_filter) {
    const filter = JSON.parse(server.tool_filter) as string[];
    if (filter.length > 0) {
      tools = tools.filter((t) => filter.includes(t.name));
    }
  }

  return tools;
}

async function discoverViaSse(
  url: string,
  authHeaders: Record<string, string>,
  toolFilterJson: string | null
): Promise<McpToolDefinition[]> {
  // For SSE, send JSON-RPC to the same URL (many SSE servers accept POST)
  try {
    await sendJsonRpc(url, "initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "straits-agents", version: "1.0.0" },
    }, authHeaders);
  } catch {
    // Non-critical
  }

  const response = await sendJsonRpc(url, "tools/list", {}, authHeaders);

  if (response.error) {
    throw new Error(`MCP tools/list error: ${response.error.message}`);
  }

  const result = response.result as { tools?: McpToolDefinition[] };
  let tools = result.tools || [];

  if (toolFilterJson) {
    const filter = JSON.parse(toolFilterJson) as string[];
    if (filter.length > 0) {
      tools = tools.filter((t) => filter.includes(t.name));
    }
  }

  return tools;
}

// ─── Tool Calling ────────────────────────────────────────────────────────────

/**
 * Call a single MCP tool and return the result.
 */
export async function callMcpTool(
  server: McpServerRow,
  toolName: string,
  params: unknown
): Promise<string> {
  if (!isUrlSafe(server.server_url)) {
    throw new Error("MCP server URL is blocked for security reasons");
  }

  const authHeaders = await decryptAuthHeaders(server.auth_headers);

  const response = await sendJsonRpc(
    server.server_url,
    "tools/call",
    {
      name: toolName,
      arguments: params || {},
    },
    authHeaders
  );

  if (response.error) {
    throw new Error(`MCP tool call error: ${response.error.message}`);
  }

  // MCP tool results come as content array
  const result = response.result as {
    content?: Array<{ type: string; text?: string }>;
    isError?: boolean;
  };

  if (result.isError) {
    const errorText = result.content
      ?.filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n") || "MCP tool returned an error";
    throw new Error(errorText);
  }

  const textParts = result.content
    ?.filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n");

  return textParts || JSON.stringify(result);
}

// ─── Sync Discovered Tools to agent_tools ────────────────────────────────────

/**
 * Sync discovered MCP tools into the agent_tools table.
 * Creates new rows, deactivates removed tools, updates existing ones.
 */
export async function syncDiscoveredTools(
  serverId: string,
  agentId: string,
  tools: McpToolDefinition[]
): Promise<{ created: number; updated: number; deactivated: number }> {
  const db = await getDB();

  // Get existing MCP tools for this server
  const existing = await db
    .prepare(
      `SELECT id, name, is_active FROM agent_tools
       WHERE agent_id = ? AND mcp_server_id = ?`
    )
    .bind(agentId, serverId)
    .all<{ id: string; name: string; is_active: number }>();

  const existingMap = new Map(existing.results.map((r) => [r.name, r]));
  const discoveredNames = new Set(tools.map((t) => t.name));

  let created = 0;
  let updated = 0;
  let deactivated = 0;

  // Create or update discovered tools
  for (const tool of tools) {
    const ex = existingMap.get(tool.name);

    if (ex) {
      // Update existing
      await db
        .prepare(
          `UPDATE agent_tools
           SET display_name = ?, description = ?, parameters_schema = ?, is_active = 1, updated_at = datetime('now')
           WHERE id = ?`
        )
        .bind(
          tool.name,
          tool.description || "",
          JSON.stringify(tool.inputSchema || { type: "object", properties: {} }),
          ex.id
        )
        .run();
      updated++;
    } else {
      // Create new
      await db
        .prepare(
          `INSERT INTO agent_tools (id, agent_id, name, display_name, description, tool_type, parameters_schema, mcp_server_id, sort_order)
           VALUES (?, ?, ?, ?, ?, 'mcp', ?, ?, 0)`
        )
        .bind(
          crypto.randomUUID(),
          agentId,
          tool.name,
          tool.name,
          tool.description || "",
          JSON.stringify(tool.inputSchema || { type: "object", properties: {} }),
          serverId
        )
        .run();
      created++;
    }
  }

  // Deactivate tools that were removed from server
  for (const [name, row] of existingMap) {
    if (!discoveredNames.has(name) && row.is_active === 1) {
      await db
        .prepare("UPDATE agent_tools SET is_active = 0, updated_at = datetime('now') WHERE id = ?")
        .bind(row.id)
        .run();
      deactivated++;
    }
  }

  // Update server cache and discovery timestamp
  await db
    .prepare(
      `UPDATE mcp_servers
       SET cached_tools = ?, last_discovered_at = datetime('now'), discovery_error = NULL, updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(JSON.stringify(tools), serverId)
    .run();

  return { created, updated, deactivated };
}

// ─── Server Queries ──────────────────────────────────────────────────────────

/**
 * Get an MCP server by ID.
 */
export async function getMcpServer(serverId: string): Promise<McpServerRow | null> {
  const db = await getDB();
  return db
    .prepare("SELECT * FROM mcp_servers WHERE id = ? AND is_active = 1")
    .bind(serverId)
    .first<McpServerRow>();
}

/**
 * Get all active MCP servers for an agent.
 */
export async function getAgentMcpServers(agentId: string): Promise<McpServerRow[]> {
  const db = await getDB();
  const result = await db
    .prepare("SELECT * FROM mcp_servers WHERE agent_id = ? AND is_active = 1 ORDER BY sort_order ASC")
    .bind(agentId)
    .all<McpServerRow>();
  return result.results;
}
