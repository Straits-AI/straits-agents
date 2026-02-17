-- Migration 003: Agent Builder
-- Adds slug, template, brand_color, and business_info columns to agents table
-- for self-service agent creation with branded chat URLs

ALTER TABLE agents ADD COLUMN slug TEXT;
ALTER TABLE agents ADD COLUMN template TEXT;
ALTER TABLE agents ADD COLUMN brand_color TEXT;
ALTER TABLE agents ADD COLUMN business_info TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_slug ON agents(slug);
