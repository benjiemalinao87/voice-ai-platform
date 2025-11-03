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

-- Assistants Cache Table (cached assistant data from Vapi)
CREATE TABLE IF NOT EXISTS assistants_cache (
  id TEXT PRIMARY KEY,                    -- Vapi assistant ID
  user_id TEXT NOT NULL,                  -- Owner of the assistant (via their API key)
  vapi_data TEXT NOT NULL,                -- JSON blob of full assistant data from Vapi
  cached_at INTEGER NOT NULL,             -- Unix timestamp when cached
  updated_at INTEGER NOT NULL,            -- Unix timestamp when assistant was last updated in Vapi
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assistants_cache_user_id ON assistants_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_assistants_cache_cached_at ON assistants_cache(cached_at DESC);

-- Workspaces Table (team/organization management)
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_user_id);

-- Workspace Members Table (users in a workspace)
CREATE TABLE IF NOT EXISTS workspace_members (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',    -- 'owner', 'admin', 'member'
  status TEXT NOT NULL DEFAULT 'active',  -- 'active', 'pending', 'inactive'
  invited_by_user_id TEXT,
  invited_at INTEGER,
  joined_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_status ON workspace_members(status);

-- Workspace Invitations Table (pending invitations for non-existing users)
CREATE TABLE IF NOT EXISTS workspace_invitations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'pending',
  invited_by_user_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  accepted_at INTEGER,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_by_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workspace_invitations_workspace_id ON workspace_invitations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_email ON workspace_invitations(email);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_token ON workspace_invitations(token);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_status ON workspace_invitations(status);

-- Workspace Settings Table (shared API keys and configuration)
-- Plaintext storage - security via UI access control (members can't see Settings tabs)
CREATE TABLE IF NOT EXISTS workspace_settings (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL UNIQUE,
  private_key TEXT,                    -- VAPI Private Key
  public_key TEXT,                     -- VAPI Public Key
  openai_api_key TEXT,                 -- OpenAI API Key
  twilio_account_sid TEXT,             -- Twilio Account SID
  twilio_auth_token TEXT,              -- Twilio Auth Token
  transfer_phone_number TEXT,          -- Transfer phone number
  selected_assistant_id TEXT,          -- Selected assistant
  selected_phone_id TEXT,              -- Selected phone number
  selected_org_id TEXT,                -- Selected organization
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workspace_settings_workspace_id ON workspace_settings(workspace_id);

