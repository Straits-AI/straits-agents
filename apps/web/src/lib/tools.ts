/**
 * Tool Resolution Engine
 * Builds Vercel AI SDK tools from agent_tools DB rows.
 * Supports webhook tools and builtin tools (search_documents, get_user_memory, think, call_agent, discover_agents).
 */

import { tool, jsonSchema, type CoreTool } from "ai";
import { z } from "zod";
import { getDB, getEnv } from "./db";
import { searchDocuments } from "./rag";
import { loadMemoryContext } from "./memory";
import { decrypt } from "./encryption";
import { checkReputationThreshold } from "./agent-discovery";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ToolRow {
  id: string;
  agent_id: string;
  name: string;
  display_name: string;
  description: string;
  tool_type: string;
  webhook_url: string | null;
  webhook_method: string | null;
  webhook_headers: string | null;
  parameters_schema: string;
  builtin_ref: string | null;
  builtin_config: string | null;
  timeout_ms: number;
  rate_limit_per_min: number;
  requires_approval: number;
  sort_order: number;
  is_active: number;
  mcp_server_id: string | null;
}

export interface ToolContext {
  sessionId: string;
  userId: string | null;
  agentId: string;
  callDepth?: number;
  callChain?: string[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_RESPONSE_BYTES = 10240; // 10KB
const MAX_TIMEOUT_MS = 30000; // 30s hard cap for webhook/MCP timeouts
const SSRF_BLOCKED_PATTERNS = [
  /^https?:\/\/localhost/i,
  /^https?:\/\/127\./,
  /^https?:\/\/0\./,
  /^https?:\/\/0+\./,       // Octal/zero-padded IPs (e.g., 0177.0.0.1)
  /^https?:\/\/10\./,
  /^https?:\/\/172\.(1[6-9]|2\d|3[0-1])\./,
  /^https?:\/\/192\.168\./,
  /^https?:\/\/169\.254\./,
  /^https?:\/\/\[::1\]/,
  /^https?:\/\/\[0*:0*:0*:0*:0*:0*:0*:0*1?\]/, // Expanded IPv6 loopback
  /^https?:\/\/\[::ffff:/i,  // IPv4-mapped IPv6 (e.g., [::ffff:127.0.0.1])
  /^https?:\/\/\[fc/i,
  /^https?:\/\/\[fd/i,
  /^https?:\/\/\[fe80/i,
  /^file:/i,
  /^ftp:/i,
  /^data:/i,
];

// ─── Main: Resolve Agent Tools ──────────────────────────────────────────────

/**
 * Load active tools for an agent and return as Vercel AI SDK CoreTool map.
 */
export async function resolveAgentTools(
  agentId: string,
  context: ToolContext
): Promise<Record<string, CoreTool>> {
  const db = await getDB();

  const result = await db
    .prepare(
      `SELECT * FROM agent_tools WHERE agent_id = ? AND is_active = 1 ORDER BY sort_order ASC`
    )
    .bind(agentId)
    .all<ToolRow>();

  const tools: Record<string, CoreTool> = {};

  for (const row of result.results) {
    try {
      const t = buildTool(row, context, db);
      if (t) tools[row.name] = t;
    } catch (err) {
      console.error(`Failed to build tool ${row.name}:`, err);
    }
  }

  return tools;
}

/**
 * Build tool instructions for the system prompt.
 */
export function buildToolInstructions(toolRows: ToolRow[]): string {
  if (toolRows.length === 0) return "";
  const lines = toolRows.map(
    (t) => `- **${t.display_name}**: ${t.description}`
  );
  return `\n\n## Available Tools\nYou have access to tools. Use them when they would genuinely help answer the user's question.\n${lines.join("\n")}`;
}

// ─── Tool Builder ───────────────────────────────────────────────────────────

function buildTool(
  row: ToolRow,
  context: ToolContext,
  db: Awaited<ReturnType<typeof getDB>>
): CoreTool | null {
  const schema = parseJsonSchema(row.parameters_schema);

  if (row.tool_type === "builtin") {
    return buildBuiltinTool(row, context, db, schema);
  }

  if (row.tool_type === "webhook") {
    return buildWebhookTool(row, context, db, schema);
  }

  if (row.tool_type === "mcp") {
    return buildMcpTool(row, context, db, schema);
  }

  return null;
}

function parseJsonSchema(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw);
  } catch {
    return { type: "object", properties: {} };
  }
}

// ─── Builtin Tools ──────────────────────────────────────────────────────────

function buildBuiltinTool(
  row: ToolRow,
  context: ToolContext,
  db: Awaited<ReturnType<typeof getDB>>,
  schema: Record<string, unknown>
): CoreTool | null {
  switch (row.builtin_ref) {
    case "search_documents":
      return tool({
        description: row.description || "Search the agent's knowledge base for relevant information.",
        parameters: z.object({
          query: z.string().describe("The search query"),
        }),
        execute: async ({ query }) => {
          const start = Date.now();
          try {
            await checkRateLimit(db, row.id, context.userId, row.rate_limit_per_min);
            const results = await searchDocuments(context.agentId, query, 3);
            const output = results.length > 0
              ? results.map((r, i) => `[${i + 1}] ${r.title}: ${r.content}`).join("\n\n")
              : "No relevant documents found.";
            await logExecution(db, row.id, context, { query }, output, "success", Date.now() - start);
            return output;
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Search failed";
            await logExecution(db, row.id, context, { query }, null, "error", Date.now() - start, msg);
            return `Error searching documents: ${msg}`;
          }
        },
      });

    case "get_user_memory":
      return tool({
        description: row.description || "Recall what you remember about the current user.",
        parameters: z.object({}),
        execute: async () => {
          const start = Date.now();
          try {
            if (!context.userId) {
              return "No user memories available (anonymous user).";
            }
            await checkRateLimit(db, row.id, context.userId, row.rate_limit_per_min);
            const mem = await loadMemoryContext(context.userId, context.agentId, { maxTokens: 600 });
            const output = mem || "No memories stored for this user yet.";
            await logExecution(db, row.id, context, {}, output, "success", Date.now() - start);
            return output;
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Memory load failed";
            await logExecution(db, row.id, context, {}, null, "error", Date.now() - start, msg);
            return `Error loading memory: ${msg}`;
          }
        },
      });

    case "think":
      return tool({
        description: row.description || "Use this tool to think step-by-step about complex questions before answering. Your thoughts will not be shown to the user.",
        parameters: z.object({
          thought: z.string().describe("Your internal reasoning or analysis"),
        }),
        execute: async ({ thought }) => {
          await logExecution(db, row.id, context, { thought }, thought, "success", 0);
          return thought;
        },
      });

    case "call_agent":
      return tool({
        description: row.description || "Call another agent on the marketplace to help answer a question. Requires the target agent's ID or slug.",
        parameters: z.object({
          agent_id: z.string().describe("The ID or slug of the agent to call"),
          message: z.string().describe("The question or task to send to the agent"),
        }),
        execute: async ({ agent_id, message }) => {
          const start = Date.now();
          try {
            await checkRateLimit(db, row.id, context.userId, row.rate_limit_per_min);

            // Check call depth to prevent infinite recursion
            const currentDepth = context.callDepth || 0;
            if (currentDepth >= 3) {
              throw new Error("Maximum agent call depth (3) exceeded");
            }

            // Check for cycles
            const chain = context.callChain || [];
            if (chain.includes(agent_id)) {
              throw new Error(`Cycle detected: agent ${agent_id} already in call chain`);
            }

            // Resolve target agent
            const targetAgent = await db
              .prepare("SELECT id, name, pricing_type, price_per_query FROM agents WHERE (id = ? OR slug = ?) AND is_active = 1")
              .bind(agent_id, agent_id)
              .first<{ id: string; name: string; pricing_type: string; price_per_query: number }>();

            if (!targetAgent) {
              throw new Error(`Agent not found: ${agent_id}`);
            }

            // Check reputation threshold (default 30/100)
            const repCheck = await checkReputationThreshold(targetAgent.id, 30);
            if (!repCheck.passes) {
              throw new Error(`Agent ${targetAgent.name} has insufficient reputation (${repCheck.score}/100, minimum 30)`);
            }

            // Execute via chat engine (lazy import to avoid circular deps)
            const { executeChatPipeline } = await import("./chat-engine");
            const subSessionId = crypto.randomUUID();

            const result = await executeChatPipeline({
              agentId: targetAgent.id,
              messages: [{ id: `a2a-${subSessionId}`, role: "user", content: message }],
              sessionId: subSessionId,
              userId: context.userId,
              callDepth: currentDepth + 1,
              callChain: [...chain, context.agentId],
              useRag: true,
              stream: false,
            });

            const output = result.text || "No response from agent";
            const prefixed = `[${targetAgent.name}]: ${output}`;

            await logExecution(db, row.id, context, { agent_id, message }, prefixed, "success", Date.now() - start);

            // Log with sub-session and target for tracking
            try {
              await db
                .prepare(
                  `UPDATE tool_executions SET sub_session_id = ?, target_agent_id = ?
                   WHERE tool_id = ? AND session_id = ?
                   ORDER BY created_at DESC LIMIT 1`
                )
                .bind(subSessionId, targetAgent.id, row.id, context.sessionId)
                .run();
            } catch {
              // Non-critical
            }

            return prefixed;
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Call failed";
            await logExecution(db, row.id, context, { agent_id, message }, null, "error", Date.now() - start, msg);
            return `Error calling agent: ${msg}`;
          }
        },
      });

    case "discover_agents":
      return tool({
        description: row.description || "Search the marketplace for agents that can help with a specific task.",
        parameters: z.object({
          query: z.string().describe("Description of what kind of agent you need"),
        }),
        execute: async ({ query }) => {
          const start = Date.now();
          try {
            await checkRateLimit(db, row.id, context.userId, row.rate_limit_per_min);

            // Simple discovery: search agents by name/description
            // Escape SQL LIKE wildcards in user input
            const safeQuery = query.replace(/[%_\\]/g, "\\$&");
            const agents = await db
              .prepare(
                `SELECT id, name, description, slug, pricing_type, price_per_query
                 FROM agents
                 WHERE is_active = 1 AND id != ?
                   AND (name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')
                 LIMIT 5`
              )
              .bind(context.agentId, `%${safeQuery}%`, `%${safeQuery}%`)
              .all<{
                id: string;
                name: string;
                description: string;
                slug: string | null;
                pricing_type: string;
                price_per_query: number;
              }>();

            const output = agents.results.length > 0
              ? agents.results
                  .map(
                    (a) =>
                      `- **${a.name}** (${a.slug || a.id}): ${a.description} [${a.pricing_type === "free" ? "Free" : `$${a.price_per_query / 100}/query`}]`
                  )
                  .join("\n")
              : "No matching agents found.";

            await logExecution(db, row.id, context, { query }, output, "success", Date.now() - start);
            return output;
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Discovery failed";
            await logExecution(db, row.id, context, { query }, null, "error", Date.now() - start, msg);
            return `Error discovering agents: ${msg}`;
          }
        },
      });

    default:
      console.warn(`Unknown builtin_ref: ${row.builtin_ref}`);
      return null;
  }
}

// ─── Webhook Tools ──────────────────────────────────────────────────────────

function buildWebhookTool(
  row: ToolRow,
  context: ToolContext,
  db: Awaited<ReturnType<typeof getDB>>,
  schema: Record<string, unknown>
): CoreTool | null {
  if (!row.webhook_url) {
    console.warn(`Webhook tool ${row.name} has no URL`);
    return null;
  }

  return tool({
    description: row.description,
    parameters: jsonSchema(schema),
    execute: async (rawParams: unknown) => {
      const params = (rawParams || {}) as Record<string, unknown>;
      const start = Date.now();
      try {
        await checkRateLimit(db, row.id, context.userId, row.rate_limit_per_min);

        // SSRF protection
        const url = row.webhook_url!;
        if (!isUrlSafe(url)) {
          throw new Error("Webhook URL is blocked for security reasons");
        }

        // Decrypt headers if present
        let headers: Record<string, string> = { "Content-Type": "application/json" };
        if (row.webhook_headers) {
          try {
            const env = await getEnv();
            const decrypted = await decrypt(row.webhook_headers, env.EMBEDDED_WALLET_SECRET, "webhook");
            const parsed = JSON.parse(decrypted);
            headers = { ...headers, ...parsed };
          } catch {
            console.error(`Failed to decrypt headers for tool ${row.name}`);
          }
        }

        const method = (row.webhook_method || "POST").toUpperCase();
        const controller = new AbortController();
        const timeoutMs = Math.min(row.timeout_ms || 10000, MAX_TIMEOUT_MS);
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const fetchOptions: RequestInit = {
            method,
            headers,
            signal: controller.signal,
            redirect: "manual", // Prevent SSRF via redirect to internal IPs
          };

          if (method !== "GET" && method !== "HEAD") {
            fetchOptions.body = JSON.stringify(params);
          }

          let response = await fetch(url, fetchOptions);
          clearTimeout(timeout);

          // Handle redirects manually — validate target URL
          if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get("location");
            if (!location || !isUrlSafe(new URL(location, url).href)) {
              throw new Error("Redirect to blocked URL");
            }
            response = await fetch(new URL(location, url).href, {
              ...fetchOptions,
              redirect: "error", // No further redirects
            });
          }

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          let text = await response.text();
          // Truncate response
          if (text.length > MAX_RESPONSE_BYTES) {
            text = text.slice(0, MAX_RESPONSE_BYTES) + "\n[Response truncated]";
          }

          // Sanitize: strip instruction-like content
          text = sanitizeToolResponse(text);

          await logExecution(db, row.id, context, params, text, "success", Date.now() - start);
          return text;
        } finally {
          clearTimeout(timeout);
        }
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.name === "AbortError"
              ? "Request timed out"
              : err.message
            : "Webhook call failed";
        await logExecution(db, row.id, context, params, null, "error", Date.now() - start, msg);
        return `Error calling ${row.display_name}: ${msg}`;
      }
    },
  });
}

// ─── MCP Tools ───────────────────────────────────────────────────────────

function buildMcpTool(
  row: ToolRow,
  context: ToolContext,
  db: Awaited<ReturnType<typeof getDB>>,
  schema: Record<string, unknown>
): CoreTool | null {
  if (!row.mcp_server_id) {
    console.warn(`MCP tool ${row.name} has no mcp_server_id`);
    return null;
  }

  const serverId = row.mcp_server_id;

  return tool({
    description: row.description,
    parameters: jsonSchema(schema),
    execute: async (rawParams: unknown) => {
      const params = (rawParams || {}) as Record<string, unknown>;
      const start = Date.now();
      try {
        await checkRateLimit(db, row.id, context.userId, row.rate_limit_per_min);

        // Lazy import to avoid circular dependencies and keep mcp-client optional
        const { getMcpServer, callMcpTool } = await import("./mcp-client");
        const server = await getMcpServer(serverId);
        if (!server) {
          throw new Error("MCP server not found or inactive");
        }

        let result = await callMcpTool(server, row.name, params);

        // Truncate and sanitize
        if (result.length > 10240) {
          result = result.slice(0, 10240) + "\n[Response truncated]";
        }
        result = sanitizeToolResponse(result);

        await logExecution(db, row.id, context, params, result, "success", Date.now() - start);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "MCP tool call failed";
        await logExecution(db, row.id, context, params, null, "error", Date.now() - start, msg);
        return `Error calling ${row.display_name}: ${msg}`;
      }
    },
  });
}

// ─── Security ───────────────────────────────────────────────────────────────

function isUrlSafe(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    // Block 0.0.0.0 and bare-IP variants
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

function sanitizeToolResponse(text: string): string {
  // Strip common prompt injection patterns
  return text
    .replace(/\b(system|admin|override|ignore\s+(?:all\s+)?previous)\s*(prompt|instruction|directive|context)s?/gi, "[filtered]")
    .replace(/\b(you\s+are\s+now|forget\s+everything|new\s+instructions?\s*:|disregard\s+(?:all\s+)?(?:previous|prior|above))/gi, "[filtered]")
    .replace(/\b(do\s+not\s+follow|stop\s+following|ignore\s+(?:the\s+)?(?:above|previous|prior))\s*(instructions?|rules?|guidelines?|prompt)/gi, "[filtered]")
    .replace(/\b(pretend|act\s+as\s+if|assume)\s+(?:you\s+are|that\s+you)/gi, "[filtered]")
    .replace(/<\/?(?:system|instruction|prompt|context|role)>/gi, "[filtered]");
}

// ─── Rate Limiting ──────────────────────────────────────────────────────────

async function checkRateLimit(
  db: Awaited<ReturnType<typeof getDB>>,
  toolId: string,
  userId: string | null,
  limitPerMin: number
): Promise<void> {
  if (!userId || limitPerMin <= 0) return;

  const result = await db
    .prepare(
      `SELECT COUNT(*) as cnt FROM tool_executions
       WHERE tool_id = ? AND user_id = ?
       AND created_at > datetime('now', '-1 minute')`
    )
    .bind(toolId, userId)
    .first<{ cnt: number }>();

  if (result && result.cnt >= limitPerMin) {
    throw new Error(`Rate limit exceeded (${limitPerMin} calls/minute)`);
  }
}

// ─── Execution Logging ──────────────────────────────────────────────────────

async function logExecution(
  db: Awaited<ReturnType<typeof getDB>>,
  toolId: string,
  context: ToolContext,
  input: unknown,
  output: unknown,
  status: string,
  durationMs: number,
  errorMessage?: string
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO tool_executions (id, tool_id, agent_id, session_id, user_id, input_params, output_result, status, error_message, duration_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        toolId,
        context.agentId,
        context.sessionId,
        context.userId,
        JSON.stringify(input),
        output ? JSON.stringify(output) : null,
        status,
        errorMessage || null,
        durationMs
      )
      .run();
  } catch (err) {
    console.error("Failed to log tool execution:", err);
  }
}

// ─── Tool Row Fetching (for system prompt building) ─────────────────────────

export async function getToolRows(agentId: string): Promise<ToolRow[]> {
  const db = await getDB();
  const result = await db
    .prepare(
      `SELECT * FROM agent_tools WHERE agent_id = ? AND is_active = 1 ORDER BY sort_order ASC`
    )
    .bind(agentId)
    .all<ToolRow>();
  return result.results;
}
