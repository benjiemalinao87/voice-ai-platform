-- D1 Database Schema for Voice AI Dashboard

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_login_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- User Settings Table (encrypted API keys and preferences)
CREATE TABLE IF NOT EXISTS user_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  encrypted_private_key TEXT,
  encrypted_public_key TEXT,
  selected_assistant_id TEXT,
  selected_phone_id TEXT,
  encryption_salt TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- Sessions Table (for JWT token management)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Agent Knowledge Base Files Table
CREATE TABLE IF NOT EXISTS agent_knowledge_files (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  vapi_file_id TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  status TEXT DEFAULT 'ready',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Index for fast lookups by agent
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_files_agent_id 
  ON agent_knowledge_files(agent_id);

-- Index for created_at for sorting
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_files_created_at
  ON agent_knowledge_files(created_at DESC);

-- Webhooks Table (stores webhook configurations for VAPI integration)
CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY,                  -- Unique webhook ID (e.g., wh_abc123xyz)
  user_id TEXT NOT NULL,                -- Owner of the webhook
  webhook_url TEXT NOT NULL UNIQUE,     -- Full webhook URL
  name TEXT,                            -- User-friendly name
  is_active INTEGER DEFAULT 1,          -- 1 = active, 0 = disabled
  created_at INTEGER NOT NULL,          -- Unix timestamp
  updated_at INTEGER NOT NULL,          -- Unix timestamp
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhooks_user_id ON webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_is_active ON webhooks(is_active);

-- Webhook Calls Table (stores call data received from VAPI webhooks)
CREATE TABLE IF NOT EXISTS webhook_calls (
  id TEXT PRIMARY KEY,                  -- Unique call record ID
  webhook_id TEXT NOT NULL,             -- Reference to webhook
  user_id TEXT NOT NULL,                -- Owner (for quick filtering)
  vapi_call_id TEXT,                    -- VAPI's internal call ID
  phone_number TEXT,                    -- Customer phone number
  customer_number TEXT,                 -- Alternative customer number
  recording_url TEXT,                   -- Audio recording URL
  ended_reason TEXT,                    -- How call ended
  summary TEXT,                         -- AI call summary
  structured_data TEXT,                 -- JSON analysis data
  raw_payload TEXT,                     -- Complete VAPI payload (for debugging)
  created_at INTEGER NOT NULL,          -- Unix timestamp
  FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhook_calls_webhook_id ON webhook_calls(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_calls_user_id ON webhook_calls(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_calls_created_at ON webhook_calls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_calls_phone_number ON webhook_calls(phone_number);

-- Webhook Logs Table (audit trail of all webhook deliveries)
CREATE TABLE IF NOT EXISTS webhook_logs (
  id TEXT PRIMARY KEY,                  -- Unique log ID
  webhook_id TEXT NOT NULL,             -- Reference to webhook
  status TEXT NOT NULL,                 -- 'success' | 'error'
  http_status INTEGER,                  -- HTTP status code returned
  payload_size INTEGER,                 -- Size of payload in bytes
  error_message TEXT,                   -- Error details if failed
  created_at INTEGER NOT NULL,          -- Unix timestamp
  FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook_id ON webhook_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON webhook_logs(status);

