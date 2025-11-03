-- Simplify workspace_settings to use plaintext keys (no encryption)
-- Members simply won't have access to the Settings tabs

DROP TABLE IF EXISTS workspace_settings;

CREATE TABLE workspace_settings (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL UNIQUE,
  private_key TEXT,                    -- VAPI Private Key (plaintext)
  public_key TEXT,                     -- VAPI Public Key (plaintext)
  openai_api_key TEXT,                 -- OpenAI API Key (plaintext)
  twilio_account_sid TEXT,             -- Twilio Account SID (plaintext)
  twilio_auth_token TEXT,              -- Twilio Auth Token (plaintext)
  transfer_phone_number TEXT,          -- Transfer phone number
  selected_assistant_id TEXT,          -- Selected assistant
  selected_phone_id TEXT,              -- Selected phone number
  selected_org_id TEXT,                -- Selected organization
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workspace_settings_workspace_id ON workspace_settings(workspace_id);
