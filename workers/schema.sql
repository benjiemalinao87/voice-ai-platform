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

