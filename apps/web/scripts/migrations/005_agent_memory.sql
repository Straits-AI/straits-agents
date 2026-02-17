-- Migration 005: Agent Memory System
-- Persistent observational memory for agents to remember users across sessions

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  memory_type TEXT NOT NULL DEFAULT 'fact',    -- preference, fact, context, decision, interaction
  priority TEXT NOT NULL DEFAULT 'yellow',     -- red, yellow, green
  content TEXT NOT NULL,                       -- Full observation text
  content_summary TEXT,                        -- L0 compressed version (for token budget overflow)
  observed_at TEXT NOT NULL,                   -- When extracted
  referenced_at TEXT,                          -- Date the memory refers to
  source_session_id TEXT,                      -- Session it was extracted from
  supersedes_id TEXT,                          -- Memory this one replaces (conflict resolution)
  is_active INTEGER NOT NULL DEFAULT 1,
  confidence REAL DEFAULT 1.0,
  access_count INTEGER DEFAULT 0,
  last_accessed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_memories_user_agent ON memories(user_id, agent_id, is_active);
CREATE INDEX IF NOT EXISTS idx_memories_priority ON memories(user_id, agent_id, is_active, priority, updated_at);

CREATE TABLE IF NOT EXISTS agent_memory_config (
  agent_id TEXT PRIMARY KEY,
  memory_enabled INTEGER NOT NULL DEFAULT 1,
  extraction_instructions TEXT,
  max_memories_per_user INTEGER DEFAULT 100,
  retention_days INTEGER DEFAULT 90,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS memory_extraction_jobs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',   -- pending, processing, completed, failed
  message_count INTEGER DEFAULT 0,
  memories_extracted INTEGER DEFAULT 0,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_extraction_jobs_session ON memory_extraction_jobs(session_id, status);
