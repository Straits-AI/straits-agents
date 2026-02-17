-- Migration: Add Smart Account (ERC-4337) Fields
-- Date: 2026-02-06
-- Description: Adds smart_account_address and eoa_address columns to users table
-- Run with: wrangler d1 execute straits-agents-db --file=./migrations/001_add_smart_account_fields.sql

-- Add smart_account_address column (the counterfactual Safe address)
ALTER TABLE users ADD COLUMN smart_account_address TEXT;

-- Add eoa_address column (the EOA that controls the smart account)
ALTER TABLE users ADD COLUMN eoa_address TEXT;

-- Create index for smart account lookups
CREATE INDEX IF NOT EXISTS idx_users_smart_account ON users(smart_account_address);

-- Create index for EOA lookups
CREATE INDEX IF NOT EXISTS idx_users_eoa ON users(eoa_address);

-- Migrate existing wallet_address to eoa_address for users who don't have smart accounts yet
-- This is optional - only run if you want to treat existing wallets as EOAs
-- UPDATE users SET eoa_address = wallet_address WHERE wallet_address IS NOT NULL AND eoa_address IS NULL;

-- Add is_smart_account and user_op_hash columns to transactions table
ALTER TABLE transactions ADD COLUMN is_smart_account INTEGER DEFAULT 0;
ALTER TABLE transactions ADD COLUMN user_op_hash TEXT;

-- Create index for user_op_hash lookups
CREATE INDEX IF NOT EXISTS idx_transactions_user_op ON transactions(user_op_hash);
