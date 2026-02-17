-- Migration 008: MCP Server Support
-- Adds MCP (Model Context Protocol) server configurations for agents.
-- MCP-discovered tools sync to agent_tools with tool_type='mcp'.

CREATE TABLE IF NOT EXISTS mcp_servers (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  server_url TEXT NOT NULL,
  transport_type TEXT NOT NULL DEFAULT 'streamable-http',
  auth_headers TEXT,
  tool_filter TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_discovered_at TEXT,
  cached_tools TEXT,
  discovery_error TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mcp_servers_agent ON mcp_servers(agent_id, is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mcp_servers_name ON mcp_servers(agent_id, name);

-- Link MCP-discovered tools back to their server
ALTER TABLE agent_tools ADD COLUMN mcp_server_id TEXT;
