-- Migration 010: BSC Testnet multi-chain support
-- Backfill existing agents with Arbitrum Sepolia chain_id
-- The chain_id column already exists from the initial schema

UPDATE agents SET chain_id = 421614 WHERE chain_id IS NULL;
