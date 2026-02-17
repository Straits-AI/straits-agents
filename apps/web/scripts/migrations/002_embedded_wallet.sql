-- Migration: Add embedded wallet support to users table
-- Run: npx wrangler d1 execute straits-agents-db --remote --file scripts/migrations/002_embedded_wallet.sql

ALTER TABLE users ADD COLUMN embedded_wallet_address TEXT;
ALTER TABLE users ADD COLUMN encrypted_private_key TEXT;
ALTER TABLE users ADD COLUMN wallet_type TEXT DEFAULT 'none';
ALTER TABLE users ADD COLUMN embedded_balance INTEGER DEFAULT 0;
