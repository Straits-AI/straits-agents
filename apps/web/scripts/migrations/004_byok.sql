-- BYOK (Bring Your Own Key) for Agent Builders
-- Allows agent creators to provide their own LLM API key instead of using platform's OpenRouter key

ALTER TABLE agents ADD COLUMN llm_provider TEXT;
ALTER TABLE agents ADD COLUMN encrypted_llm_api_key TEXT;
ALTER TABLE agents ADD COLUMN llm_model TEXT;
ALTER TABLE agents ADD COLUMN llm_base_url TEXT;
