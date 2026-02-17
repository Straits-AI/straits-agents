-- Migration 006: Agent Tools
-- Adds tool definitions and execution logging for agent tool use

CREATE TABLE IF NOT EXISTS agent_tools (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  tool_type TEXT NOT NULL DEFAULT 'webhook',
  webhook_url TEXT,
  webhook_method TEXT DEFAULT 'POST',
  webhook_headers TEXT,
  parameters_schema TEXT NOT NULL,
  builtin_ref TEXT,
  builtin_config TEXT,
  timeout_ms INTEGER DEFAULT 10000,
  rate_limit_per_min INTEGER DEFAULT 30,
  requires_approval INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_agent_tools_agent ON agent_tools(agent_id, is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_tools_name ON agent_tools(agent_id, name);

CREATE TABLE IF NOT EXISTS tool_executions (
  id TEXT PRIMARY KEY,
  tool_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  user_id TEXT,
  input_params TEXT,
  output_result TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  duration_ms INTEGER,
  sub_session_id TEXT,
  target_agent_id TEXT,
  payment_tx_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tool_executions_session ON tool_executions(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tool_executions_rate ON tool_executions(tool_id, user_id, created_at);
