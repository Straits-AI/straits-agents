-- Migration 009: Security hardening
-- Prevents double-spend via duplicate transaction hashes

-- Add UNIQUE constraint on transaction_hash to prevent replay attacks
-- D1 doesn't support ALTER TABLE ADD CONSTRAINT, so we create a unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_hash_unique
  ON transactions(transaction_hash)
  WHERE transaction_hash IS NOT NULL;

-- Add UNIQUE constraint on x402_payment_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_payment_id_unique
  ON transactions(x402_payment_id)
  WHERE x402_payment_id IS NOT NULL;
