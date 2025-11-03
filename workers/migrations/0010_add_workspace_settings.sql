-- Create workspace_settings table for shared API keys and settings
-- This allows all workspace members to access the same VAPI/Twilio credentials

CREATE TABLE IF NOT EXISTS workspace_settings (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL UNIQUE,
  encrypted_private_key TEXT,          -- VAPI Private Key (encrypted)
  encrypted_public_key TEXT,           -- VAPI Public Key (encrypted)
  encrypted_openai_key TEXT,           -- OpenAI API Key (encrypted)
  encrypted_twilio_sid TEXT,           -- Twilio Account SID (encrypted)
  encrypted_twilio_token TEXT,         -- Twilio Auth Token (encrypted)
  transfer_phone_number TEXT,          -- Transfer phone number
  encryption_salt TEXT NOT NULL,       -- Salt for encryption/decryption
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workspace_settings_workspace_id ON workspace_settings(workspace_id);
