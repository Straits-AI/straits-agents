-- Migration 007: Agent Skills (SKILL.md Standard)
-- Stores portable skill definitions for agents

CREATE TABLE IF NOT EXISTS agent_skills (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  version TEXT DEFAULT '1.0.0',
  instructions TEXT NOT NULL,
  author TEXT,
  tags TEXT,
  allowed_tools TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_agent_skills_agent ON agent_skills(agent_id, is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_skills_name ON agent_skills(agent_id, name);
