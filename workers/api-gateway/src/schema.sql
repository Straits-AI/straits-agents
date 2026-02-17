-- Straits Agents Database Schema
-- Run with: wrangler d1 execute straits-agents-db --file=./src/schema.sql

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  wallet_address TEXT UNIQUE,
  name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'developer', 'admin')),
  total_queries INTEGER DEFAULT 0,
  total_spent INTEGER DEFAULT 0,
  monthly_queries INTEGER DEFAULT 0,
  monthly_spent INTEGER DEFAULT 0,
  last_active DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);

-- Auth providers table
CREATE TABLE IF NOT EXISTS auth_providers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('email', 'wallet', 'google', 'github')),
  provider_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, provider)
);

-- API keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  name TEXT NOT NULL,
  scopes TEXT, -- JSON array
  last_used DATETIME,
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  nft_token_id TEXT,
  chain_id INTEGER,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('customer-facing', 'productivity')),
  type TEXT NOT NULL,
  capabilities TEXT, -- JSON array
  agent_wallet TEXT,
  pricing_type TEXT DEFAULT 'free' CHECK (pricing_type IN ('free', 'per-query', 'subscription', 'tiered')),
  price_per_query INTEGER DEFAULT 0,
  free_queries INTEGER DEFAULT 5,
  owner_id TEXT NOT NULL REFERENCES users(id),
  system_prompt TEXT,
  welcome_message TEXT,
  icon TEXT,
  metadata TEXT, -- JSON object
  is_active INTEGER DEFAULT 1,
  is_featured INTEGER DEFAULT 0, -- Manually marked as featured
  featured_order INTEGER DEFAULT 0, -- Order for featured display
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agents_owner ON agents(owner_id);
CREATE INDEX IF NOT EXISTS idx_agents_category ON agents(category);
CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(type);
CREATE INDEX IF NOT EXISTS idx_agents_chain ON agents(chain_id);

-- Sessions table (for persistence beyond Durable Objects)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  user_id TEXT REFERENCES users(id),
  session_token TEXT UNIQUE,
  queries_used INTEGER DEFAULT 0,
  payment_status TEXT DEFAULT 'free' CHECK (payment_status IN ('free', 'prepaid', 'pay-as-you-go', 'exhausted')),
  artifact_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_sessions_agent ON sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  x402_payment_id TEXT,
  payer_address TEXT NOT NULL,
  payee_address TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'USDC',
  chain_id INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'settled', 'failed', 'refunded')),
  transaction_hash TEXT,
  block_number INTEGER,
  session_id TEXT REFERENCES sessions(id),
  agent_id TEXT NOT NULL REFERENCES agents(id),
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transactions_payer ON transactions(payer_address);
CREATE INDEX IF NOT EXISTS idx_transactions_payee ON transactions(payee_address);
CREATE INDEX IF NOT EXISTS idx_transactions_session ON transactions(session_id);
CREATE INDEX IF NOT EXISTS idx_transactions_agent ON transactions(agent_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

-- Feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  reviewer_address TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  comment_hash TEXT, -- On-chain hash
  transaction_hash TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_feedback_agent ON feedback(agent_id);
CREATE INDEX IF NOT EXISTS idx_feedback_reviewer ON feedback(reviewer_address);

-- Documents table (for RAG knowledge base)
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  title TEXT NOT NULL,
  content TEXT,
  content_type TEXT DEFAULT 'text/plain',
  source_url TEXT,
  metadata TEXT, -- JSON object
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_documents_agent ON documents(agent_id);

-- Artifacts table
CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  format TEXT DEFAULT 'markdown' CHECK (format IN ('markdown', 'json', 'html')),
  data TEXT, -- JSON object
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_artifacts_session ON artifacts(session_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_type ON artifacts(type);

-- User favorites table
CREATE TABLE IF NOT EXISTS user_favorites (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_agent ON user_favorites(agent_id);

-- Trigger to update timestamps
CREATE TRIGGER IF NOT EXISTS update_users_timestamp
  AFTER UPDATE ON users
  BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS update_agents_timestamp
  AFTER UPDATE ON agents
  BEGIN
    UPDATE agents SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS update_sessions_timestamp
  AFTER UPDATE ON sessions
  BEGIN
    UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS update_transactions_timestamp
  AFTER UPDATE ON transactions
  BEGIN
    UPDATE transactions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;
