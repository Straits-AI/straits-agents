-- Phase 2 Database Migrations
-- Run with: wrangler d1 execute straits-agents-db --file=./scripts/migrate-phase2.sql

-- Add featured columns to agents table
ALTER TABLE agents ADD COLUMN is_featured INTEGER DEFAULT 0;
ALTER TABLE agents ADD COLUMN featured_order INTEGER DEFAULT 0;

-- Create user_favorites table
CREATE TABLE IF NOT EXISTS user_favorites (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_agent ON user_favorites(agent_id);

-- Mark some demo agents as featured (optional, run manually)
-- UPDATE agents SET is_featured = 1, featured_order = 1 WHERE id = 'prd-generator';
-- UPDATE agents SET is_featured = 1, featured_order = 2 WHERE id = 'retail';
-- UPDATE agents SET is_featured = 1, featured_order = 3 WHERE id = 'support';
