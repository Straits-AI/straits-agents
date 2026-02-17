/**
 * Agent Memory System
 * Persistent observational memory for agents to remember users across sessions.
 * Uses async extraction via ctx.waitUntil() for zero chat latency impact.
 * KV-cached reads for ~1ms memory loading.
 */

import { getDB, getKV, getEnv } from "./db";

// ─── Types ──────────────────────────────────────────────────────────────────

export type MemoryType = "preference" | "fact" | "context" | "decision" | "interaction";
export type MemoryPriority = "red" | "yellow" | "green";

export interface Memory {
  id: string;
  userId: string;
  agentId: string;
  memoryType: MemoryType;
  priority: MemoryPriority;
  content: string;
  contentSummary: string | null;
  observedAt: string;
  referencedAt: string | null;
  sourceSessionId: string | null;
  supersedesId: string | null;
  isActive: boolean;
  confidence: number;
  accessCount: number;
  lastAccessedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MemoryRow {
  id: string;
  user_id: string;
  agent_id: string;
  memory_type: string;
  priority: string;
  content: string;
  content_summary: string | null;
  observed_at: string;
  referenced_at: string | null;
  source_session_id: string | null;
  supersedes_id: string | null;
  is_active: number;
  confidence: number;
  access_count: number;
  last_accessed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemoryConfig {
  agentId: string;
  memory_enabled: boolean;
  extraction_instructions: string | null;
  max_memories_per_user: number;
  retention_days: number;
}

interface ExtractedMemory {
  content: string;
  type: MemoryType;
  priority: MemoryPriority;
  referenced_date: string | null;
  conflicts_with: string | null;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const KV_MEMORY_PREFIX = "mem:";
const KV_CONFIG_PREFIX = "memcfg:";
const KV_MEMORY_TTL = 300; // 5 minutes
const KV_CONFIG_TTL = 300; // 5 minutes
const DEFAULT_MAX_TOKENS = 800;
const DEFAULT_MAX_MEMORIES = 100;
const DEFAULT_RETENTION_DAYS = 90;

// Approximate token count (rough: 4 chars per token)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ─── Row Mapper ─────────────────────────────────────────────────────────────

function rowToMemory(row: MemoryRow): Memory {
  return {
    id: row.id,
    userId: row.user_id,
    agentId: row.agent_id,
    memoryType: row.memory_type as MemoryType,
    priority: row.priority as MemoryPriority,
    content: row.content,
    contentSummary: row.content_summary,
    observedAt: row.observed_at,
    referencedAt: row.referenced_at,
    sourceSessionId: row.source_session_id,
    supersedesId: row.supersedes_id,
    isActive: row.is_active === 1,
    confidence: row.confidence,
    accessCount: row.access_count,
    lastAccessedAt: row.last_accessed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Memory Config ──────────────────────────────────────────────────────────

export async function getMemoryConfig(agentId: string): Promise<MemoryConfig> {
  const kv = await getKV();
  const cacheKey = `${KV_CONFIG_PREFIX}${agentId}`;

  // Try KV cache first
  const cached = await kv.get(cacheKey, "json");
  if (cached) return cached as MemoryConfig;

  const db = await getDB();
  const row = await db
    .prepare("SELECT * FROM agent_memory_config WHERE agent_id = ?")
    .bind(agentId)
    .first<{
      agent_id: string;
      memory_enabled: number;
      extraction_instructions: string | null;
      max_memories_per_user: number;
      retention_days: number;
    }>();

  const config: MemoryConfig = {
    agentId,
    memory_enabled: row ? row.memory_enabled === 1 : true, // Default: enabled
    extraction_instructions: row?.extraction_instructions ?? null,
    max_memories_per_user: row?.max_memories_per_user ?? DEFAULT_MAX_MEMORIES,
    retention_days: row?.retention_days ?? DEFAULT_RETENTION_DAYS,
  };

  await kv.put(cacheKey, JSON.stringify(config), { expirationTtl: KV_CONFIG_TTL });
  return config;
}

export async function updateMemoryConfig(
  agentId: string,
  updates: {
    memoryEnabled?: boolean;
    extractionInstructions?: string | null;
    maxMemoriesPerUser?: number;
    retentionDays?: number;
  }
): Promise<void> {
  const db = await getDB();
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO agent_memory_config (agent_id, memory_enabled, extraction_instructions, max_memories_per_user, retention_days, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(agent_id) DO UPDATE SET
         memory_enabled = COALESCE(?, memory_enabled),
         extraction_instructions = COALESCE(?, extraction_instructions),
         max_memories_per_user = COALESCE(?, max_memories_per_user),
         retention_days = COALESCE(?, retention_days),
         updated_at = ?`
    )
    .bind(
      agentId,
      updates.memoryEnabled !== undefined ? (updates.memoryEnabled ? 1 : 0) : 1,
      updates.extractionInstructions ?? null,
      updates.maxMemoriesPerUser ?? DEFAULT_MAX_MEMORIES,
      updates.retentionDays ?? DEFAULT_RETENTION_DAYS,
      now,
      updates.memoryEnabled !== undefined ? (updates.memoryEnabled ? 1 : 0) : null,
      updates.extractionInstructions !== undefined ? updates.extractionInstructions : null,
      updates.maxMemoriesPerUser ?? null,
      updates.retentionDays ?? null,
      now
    )
    .run();

  // Invalidate config cache
  const kv = await getKV();
  await kv.delete(`${KV_CONFIG_PREFIX}${agentId}`);
}

// ─── Memory Loading ─────────────────────────────────────────────────────────

/**
 * Load memory context for a user-agent pair, formatted for system prompt injection.
 * Reads from KV cache first, falls back to D1.
 */
export async function loadMemoryContext(
  userId: string,
  agentId: string,
  options: { maxTokens?: number } = {}
): Promise<string> {
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  const kv = await getKV();
  const cacheKey = `${KV_MEMORY_PREFIX}${userId}:${agentId}`;

  // Try KV cache
  const cached = await kv.get(cacheKey, "json");
  if (cached) {
    const memories = cached as Memory[];
    if (memories.length === 0) return "";
    // Update access counts in background (fire-and-forget)
    updateAccessCounts(memories.map((m) => m.id)).catch(() => {});
    return buildContextString(memories, maxTokens);
  }

  // Fall back to D1
  const db = await getDB();
  const result = await db
    .prepare(
      `SELECT * FROM memories
       WHERE user_id = ? AND agent_id = ? AND is_active = 1
       ORDER BY
         CASE priority WHEN 'red' THEN 0 WHEN 'yellow' THEN 1 WHEN 'green' THEN 2 END,
         updated_at DESC
       LIMIT 150`
    )
    .bind(userId, agentId)
    .all<MemoryRow>();

  const memories = result.results.map(rowToMemory);

  // Cache in KV
  await kv.put(cacheKey, JSON.stringify(memories), { expirationTtl: KV_MEMORY_TTL });

  if (memories.length === 0) return "";

  // Update access counts
  updateAccessCounts(memories.map((m) => m.id)).catch(() => {});

  return buildContextString(memories, maxTokens);
}

/**
 * Build a token-budget-aware context string from memories.
 * Priority order: RED first, then YELLOW, then GREEN.
 * Uses content_summary (L0) for GREEN when budget is tight.
 */
export function buildContextString(memories: Memory[], maxTokens: number): string {
  if (memories.length === 0) return "";

  const lines: string[] = [];
  let usedTokens = 0;

  // Header
  const header = `## What You Remember About This User\n[Memory updated: ${new Date().toISOString().split("T")[0]}]`;
  usedTokens += estimateTokens(header);
  lines.push(header);

  // Sort by priority
  const red = memories.filter((m) => m.priority === "red");
  const yellow = memories.filter((m) => m.priority === "yellow");
  const green = memories.filter((m) => m.priority === "green");

  // RED: always included (critical constraints)
  for (const m of red) {
    const line = `- [!] ${m.content}`;
    const tokens = estimateTokens(line);
    if (usedTokens + tokens > maxTokens) break;
    lines.push(line);
    usedTokens += tokens;
  }

  // YELLOW: included if budget allows
  for (const m of yellow) {
    const line = `- [*] ${m.content}`;
    const tokens = estimateTokens(line);
    if (usedTokens + tokens > maxTokens) break;
    lines.push(line);
    usedTokens += tokens;
  }

  // GREEN: use summary if tight, skip if no budget
  for (const m of green) {
    const text = (usedTokens > maxTokens * 0.7 && m.contentSummary) ? m.contentSummary : m.content;
    const line = `- ${text}`;
    const tokens = estimateTokens(line);
    if (usedTokens + tokens > maxTokens) break;
    lines.push(line);
    usedTokens += tokens;
  }

  // Only return if we have actual memories (not just the header)
  return lines.length > 1 ? lines.join("\n") : "";
}

async function updateAccessCounts(memoryIds: string[]): Promise<void> {
  if (memoryIds.length === 0) return;
  const db = await getDB();
  const now = new Date().toISOString();
  // Batch update (D1 doesn't support WHERE IN with bind, so chunk it)
  const chunks = [];
  for (let i = 0; i < memoryIds.length; i += 20) {
    chunks.push(memoryIds.slice(i, i + 20));
  }
  for (const chunk of chunks) {
    const placeholders = chunk.map(() => "?").join(",");
    await db
      .prepare(
        `UPDATE memories SET access_count = access_count + 1, last_accessed_at = ? WHERE id IN (${placeholders})`
      )
      .bind(now, ...chunk)
      .run();
  }
}

// ─── Memory Extraction (Observer) ───────────────────────────────────────────

/**
 * Extract memories from recent conversation messages.
 * Called asynchronously via ctx.waitUntil() — zero impact on chat latency.
 */
export async function extractMemories(
  sessionId: string,
  agentId: string,
  userId: string
): Promise<void> {
  const db = await getDB();
  const env = await getEnv();
  const jobId = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    // Check if memory is enabled for this agent
    const config = await getMemoryConfig(agentId);
    if (!config.memory_enabled) return;

    // Check for recent extraction job to avoid duplicates
    const recentJob = await db
      .prepare(
        `SELECT id FROM memory_extraction_jobs
         WHERE session_id = ? AND status IN ('pending', 'processing')
         AND created_at > datetime('now', '-2 minutes')`
      )
      .bind(sessionId)
      .first();

    if (recentJob) return;

    // Create extraction job
    await db
      .prepare(
        `INSERT INTO memory_extraction_jobs (id, session_id, agent_id, user_id, status, created_at)
         VALUES (?, ?, ?, ?, 'processing', ?)`
      )
      .bind(jobId, sessionId, agentId, userId, now)
      .run();

    // Fetch recent messages from session
    const messagesResult = await db
      .prepare(
        `SELECT role, content FROM messages
         WHERE session_id = ?
         ORDER BY created_at DESC
         LIMIT 20`
      )
      .bind(sessionId)
      .all<{ role: string; content: string }>();

    const messages = messagesResult.results.reverse();
    if (messages.length < 2) {
      await completeJob(db, jobId, 0, messages.length);
      return;
    }

    // Load existing memories for conflict detection
    const existingResult = await db
      .prepare(
        `SELECT content, id FROM memories
         WHERE user_id = ? AND agent_id = ? AND is_active = 1
         ORDER BY updated_at DESC LIMIT 50`
      )
      .bind(userId, agentId)
      .all<{ content: string; id: string }>();

    const existingMemories = existingResult.results;
    const existingText = existingMemories.length > 0
      ? existingMemories.map((m) => `- ${m.content}`).join("\n")
      : "None";

    // Format conversation for extraction
    const conversationText = messages
      .map((m) => `${m.role === "user" ? "User" : "Agent"}: ${m.content}`)
      .join("\n");

    // Call LLM for extraction (use platform OpenRouter key with a fast model)
    const extractionPrompt = buildExtractionPrompt(
      existingText,
      config.extraction_instructions,
      conversationText
    );

    const apiKey = env.OPENROUTER_API_KEY;
    if (!apiKey) {
      await failJob(db, jobId, "No platform API key configured");
      return;
    }

    const llmResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://straits-agents-web.mystraits-ai.workers.dev",
        "X-Title": "Straits Agents Memory Extraction",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        messages: [
          { role: "system", content: "You are a memory extraction agent. Output ONLY valid JSON arrays, no markdown, no explanation." },
          { role: "user", content: extractionPrompt },
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    if (!llmResponse.ok) {
      await failJob(db, jobId, `LLM API error: ${llmResponse.status}`);
      return;
    }

    const llmData = await llmResponse.json() as {
      choices: Array<{ message: { content: string } }>;
    };
    const responseText = llmData.choices?.[0]?.message?.content?.trim();

    if (!responseText) {
      await completeJob(db, jobId, 0, messages.length);
      return;
    }

    // Parse extracted memories
    const extracted = parseExtractedMemories(responseText);

    if (extracted.length === 0) {
      await completeJob(db, jobId, 0, messages.length);
      return;
    }

    // Store extracted memories
    let stored = 0;
    for (const mem of extracted) {
      // Handle conflicts: deactivate superseded memory
      let supersedesId: string | null = null;
      if (mem.conflicts_with) {
        const conflicting = existingMemories.find((e) =>
          e.content.toLowerCase().includes(mem.conflicts_with!.toLowerCase())
        );
        if (conflicting) {
          supersedesId = conflicting.id;
          await db
            .prepare("UPDATE memories SET is_active = 0, updated_at = ? WHERE id = ?")
            .bind(now, conflicting.id)
            .run();
        }
      }

      // Check memory count limit
      const countResult = await db
        .prepare("SELECT COUNT(*) as cnt FROM memories WHERE user_id = ? AND agent_id = ? AND is_active = 1")
        .bind(userId, agentId)
        .first<{ cnt: number }>();

      if (countResult && countResult.cnt >= config.max_memories_per_user) {
        // Deactivate oldest green memory to make room
        await db
          .prepare(
            `UPDATE memories SET is_active = 0, updated_at = ?
             WHERE id = (
               SELECT id FROM memories
               WHERE user_id = ? AND agent_id = ? AND is_active = 1 AND priority = 'green'
               ORDER BY last_accessed_at ASC, updated_at ASC
               LIMIT 1
             )`
          )
          .bind(now, userId, agentId)
          .run();
      }

      const memId = crypto.randomUUID();
      await db
        .prepare(
          `INSERT INTO memories (id, user_id, agent_id, memory_type, priority, content, observed_at, referenced_at, source_session_id, supersedes_id, is_active, confidence)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1.0)`
        )
        .bind(
          memId,
          userId,
          agentId,
          mem.type,
          mem.priority,
          mem.content,
          now,
          mem.referenced_date,
          sessionId,
          supersedesId
        )
        .run();
      stored++;
    }

    await completeJob(db, jobId, stored, messages.length);

    // Invalidate KV cache
    await invalidateMemoryCache(userId, agentId);
  } catch (error) {
    console.error("Memory extraction failed:", error);
    await failJob(db, jobId, error instanceof Error ? error.message : "Unknown error");
  }
}

function buildExtractionPrompt(
  existingMemories: string,
  extractionInstructions: string | null,
  conversation: string
): string {
  let prompt = `Analyze this conversation and extract key facts, preferences, and context about the USER.

Rules:
1. Only extract info about the USER, not general knowledge
2. Priority: RED = critical constraints (allergies, hard requirements), YELLOW = notable preferences, GREEN = background context
3. Types: preference, fact, context, decision, interaction
4. Be specific and concise — one observation per memory
5. Note conflicts with existing memories in the "conflicts_with" field (use a keyword from the conflicting memory)
6. Do NOT re-extract information already in existing memories unless it has changed

Existing memories:
${existingMemories}
`;

  if (extractionInstructions) {
    prompt += `\nAgent-specific extraction hints: ${extractionInstructions}\n`;
  }

  prompt += `
Conversation:
${conversation}

Output a JSON array (or empty array [] if nothing worth remembering):
[{"content":"...","type":"preference|fact|context|decision|interaction","priority":"red|yellow|green","referenced_date":null,"conflicts_with":null}]`;

  return prompt;
}

function parseExtractedMemories(text: string): ExtractedMemory[] {
  try {
    // Strip markdown code fences if present
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    }

    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (m: Record<string, unknown>) =>
          m && typeof m.content === "string" && m.content.trim().length > 0
      )
      .map((m: Record<string, unknown>) => ({
        content: String(m.content).trim(),
        type: (["preference", "fact", "context", "decision", "interaction"].includes(
          String(m.type)
        )
          ? String(m.type)
          : "fact") as MemoryType,
        priority: (["red", "yellow", "green"].includes(String(m.priority))
          ? String(m.priority)
          : "yellow") as MemoryPriority,
        referenced_date: m.referenced_date ? String(m.referenced_date) : null,
        conflicts_with: m.conflicts_with ? String(m.conflicts_with) : null,
      }));
  } catch {
    console.error("Failed to parse extracted memories:", text);
    return [];
  }
}

async function completeJob(
  db: Awaited<ReturnType<typeof getDB>>,
  jobId: string,
  memoriesExtracted: number,
  messageCount: number
): Promise<void> {
  await db
    .prepare(
      `UPDATE memory_extraction_jobs SET status = 'completed', memories_extracted = ?, message_count = ?, completed_at = ? WHERE id = ?`
    )
    .bind(memoriesExtracted, messageCount, new Date().toISOString(), jobId)
    .run();
}

async function failJob(
  db: Awaited<ReturnType<typeof getDB>>,
  jobId: string,
  error: string
): Promise<void> {
  await db
    .prepare(
      `UPDATE memory_extraction_jobs SET status = 'failed', error = ?, completed_at = ? WHERE id = ?`
    )
    .bind(error, new Date().toISOString(), jobId)
    .run();
}

// ─── Explicit Memory Storage ────────────────────────────────────────────────

/**
 * Detect if a user message is an explicit "remember this" command.
 */
export function isRememberCommand(content: string): boolean {
  return /\b(remember|note|save|don't forget)\b/i.test(content);
}

/**
 * Store an explicit memory from a user's "remember X" command.
 * Uses a quick LLM call to extract the fact to remember.
 */
export async function storeExplicitMemory(
  userId: string,
  agentId: string,
  content: string,
  sessionId: string
): Promise<void> {
  try {
    const env = await getEnv();
    const apiKey = env.OPENROUTER_API_KEY;
    if (!apiKey) return;

    // Quick LLM call to extract the fact
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://straits-agents-web.mystraits-ai.workers.dev",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        messages: [
          {
            role: "system",
            content: "Extract the key fact the user wants remembered. Output ONLY the fact as a single concise sentence. No JSON, no explanation.",
          },
          { role: "user", content },
        ],
        temperature: 0,
        max_tokens: 200,
      }),
    });

    if (!response.ok) return;

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };
    const fact = data.choices?.[0]?.message?.content?.trim();
    if (!fact) return;

    const db = await getDB();
    const now = new Date().toISOString();
    const memId = crypto.randomUUID();

    await db
      .prepare(
        `INSERT INTO memories (id, user_id, agent_id, memory_type, priority, content, observed_at, source_session_id, is_active, confidence)
         VALUES (?, ?, ?, 'fact', 'red', ?, ?, ?, 1, 1.0)`
      )
      .bind(memId, userId, agentId, fact, now, sessionId)
      .run();

    await invalidateMemoryCache(userId, agentId);
  } catch (error) {
    console.error("Failed to store explicit memory:", error);
  }
}

// ─── Memory CRUD ────────────────────────────────────────────────────────────

/**
 * List active memories for a user-agent pair.
 */
export async function listMemories(userId: string, agentId: string): Promise<Memory[]> {
  const db = await getDB();
  const result = await db
    .prepare(
      `SELECT * FROM memories
       WHERE user_id = ? AND agent_id = ? AND is_active = 1
       ORDER BY
         CASE priority WHEN 'red' THEN 0 WHEN 'yellow' THEN 1 WHEN 'green' THEN 2 END,
         updated_at DESC`
    )
    .bind(userId, agentId)
    .all<MemoryRow>();

  return result.results.map(rowToMemory);
}

/**
 * Delete a single memory (soft-delete: set is_active = 0).
 */
export async function deleteMemory(memoryId: string, userId: string): Promise<boolean> {
  const db = await getDB();
  const now = new Date().toISOString();
  const result = await db
    .prepare("UPDATE memories SET is_active = 0, updated_at = ? WHERE id = ? AND user_id = ?")
    .bind(now, memoryId, userId)
    .run();

  if (result.meta.changed_db) {
    // Get agentId to invalidate cache
    const mem = await db
      .prepare("SELECT agent_id FROM memories WHERE id = ?")
      .bind(memoryId)
      .first<{ agent_id: string }>();
    if (mem) {
      await invalidateMemoryCache(userId, mem.agent_id);
    }
  }

  return !!result.meta.changed_db;
}

/**
 * Clear all memories for a user-agent pair.
 */
export async function clearMemories(userId: string, agentId: string): Promise<number> {
  const db = await getDB();
  const now = new Date().toISOString();
  const result = await db
    .prepare("UPDATE memories SET is_active = 0, updated_at = ? WHERE user_id = ? AND agent_id = ? AND is_active = 1")
    .bind(now, userId, agentId)
    .run();

  await invalidateMemoryCache(userId, agentId);
  return result.meta.changes ?? 0;
}

/**
 * Get memory count for a user-agent pair.
 */
export async function getMemoryCount(userId: string, agentId: string): Promise<number> {
  const db = await getDB();
  const result = await db
    .prepare("SELECT COUNT(*) as cnt FROM memories WHERE user_id = ? AND agent_id = ? AND is_active = 1")
    .bind(userId, agentId)
    .first<{ cnt: number }>();
  return result?.cnt ?? 0;
}

// ─── Cache Invalidation ────────────────────────────────────────────────────

export async function invalidateMemoryCache(userId: string, agentId: string): Promise<void> {
  const kv = await getKV();
  await kv.delete(`${KV_MEMORY_PREFIX}${userId}:${agentId}`);
}

// ─── Reflector (Garbage Collection) ─────────────────────────────────────────

/**
 * Run memory reflector: expire old green memories and compact when over limit.
 * Can be triggered via cron or piggybacked on extraction.
 */
export async function runReflector(userId: string, agentId: string): Promise<{ expired: number; compacted: number }> {
  const db = await getDB();
  const config = await getMemoryConfig(agentId);
  const now = new Date().toISOString();
  let expired = 0;
  let compacted = 0;

  // 1. Time-based expiry: deactivate green memories not accessed in retention_days
  const expiryResult = await db
    .prepare(
      `UPDATE memories SET is_active = 0, updated_at = ?
       WHERE user_id = ? AND agent_id = ? AND is_active = 1
       AND priority = 'green'
       AND (last_accessed_at IS NULL OR last_accessed_at < datetime('now', '-' || ? || ' days'))
       AND updated_at < datetime('now', '-' || ? || ' days')`
    )
    .bind(now, userId, agentId, config.retention_days, config.retention_days)
    .run();
  expired = expiryResult.meta.changes ?? 0;

  // 2. Count-based compaction: if still over limit, deactivate oldest green memories
  const countResult = await db
    .prepare("SELECT COUNT(*) as cnt FROM memories WHERE user_id = ? AND agent_id = ? AND is_active = 1")
    .bind(userId, agentId)
    .first<{ cnt: number }>();

  const currentCount = countResult?.cnt ?? 0;
  if (currentCount > config.max_memories_per_user) {
    const toRemove = currentCount - config.max_memories_per_user;
    const compactResult = await db
      .prepare(
        `UPDATE memories SET is_active = 0, updated_at = ?
         WHERE id IN (
           SELECT id FROM memories
           WHERE user_id = ? AND agent_id = ? AND is_active = 1 AND priority = 'green'
           ORDER BY access_count ASC, last_accessed_at ASC, updated_at ASC
           LIMIT ?
         )`
      )
      .bind(now, userId, agentId, toRemove)
      .run();
    compacted = compactResult.meta.changes ?? 0;
  }

  if (expired > 0 || compacted > 0) {
    await invalidateMemoryCache(userId, agentId);
  }

  return { expired, compacted };
}
