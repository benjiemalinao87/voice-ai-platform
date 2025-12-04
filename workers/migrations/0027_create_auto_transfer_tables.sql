-- Auto Warm Transfer Tables
-- Enables AI assistants to automatically transfer calls to human agents

-- Table 1: Agent phone list per assistant
CREATE TABLE IF NOT EXISTS assistant_transfer_agents (
  id TEXT PRIMARY KEY,
  assistant_id TEXT NOT NULL,           -- VAPI assistant ID
  user_id TEXT NOT NULL,                -- Owner (for access control)
  phone_number TEXT NOT NULL,           -- Agent phone (E.164 format)
  agent_name TEXT,                      -- Display name (e.g., "Tom - Sales")
  priority INTEGER DEFAULT 0,           -- Dial order (lower = first)
  is_active INTEGER DEFAULT 1,          -- Enable/disable without deleting
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Indexes for assistant_transfer_agents
CREATE INDEX IF NOT EXISTS idx_transfer_agents_assistant_id 
  ON assistant_transfer_agents(assistant_id);
CREATE INDEX IF NOT EXISTS idx_transfer_agents_user_id 
  ON assistant_transfer_agents(user_id);
CREATE INDEX IF NOT EXISTS idx_transfer_agents_priority 
  ON assistant_transfer_agents(assistant_id, priority);

-- Table 2: Transfer settings per assistant
CREATE TABLE IF NOT EXISTS assistant_transfer_settings (
  id TEXT PRIMARY KEY,
  assistant_id TEXT NOT NULL UNIQUE,    -- One settings record per assistant
  user_id TEXT NOT NULL,                -- Owner (for access control)
  ring_timeout_seconds INTEGER DEFAULT 30,  -- How long to ring each agent
  max_attempts INTEGER DEFAULT 3,           -- Max agents to try before fallback
  enabled INTEGER DEFAULT 0,                -- Feature toggle (0=off, 1=on)
  announcement_message TEXT,                -- Custom message for agent
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Indexes for assistant_transfer_settings
CREATE INDEX IF NOT EXISTS idx_transfer_settings_assistant_id 
  ON assistant_transfer_settings(assistant_id);
CREATE INDEX IF NOT EXISTS idx_transfer_settings_user_id 
  ON assistant_transfer_settings(user_id);

-- Table 3: Auto transfer attempt logs
CREATE TABLE IF NOT EXISTS auto_transfer_logs (
  id TEXT PRIMARY KEY,
  transfer_id TEXT NOT NULL,            -- Groups attempts for one transfer
  vapi_call_id TEXT NOT NULL,           -- Original customer call
  assistant_id TEXT NOT NULL,           -- Which assistant triggered this
  user_id TEXT NOT NULL,                -- Owner (for filtering)
  agent_phone TEXT NOT NULL,            -- Which agent we tried
  agent_name TEXT,                      -- Agent name at time of attempt
  attempt_number INTEGER NOT NULL,      -- 1st, 2nd, 3rd attempt
  status TEXT NOT NULL,                 -- 'dialing', 'answered', 'no_answer', 'busy', 'failed'
  twilio_call_sid TEXT,                 -- Twilio call SID for tracking
  reason TEXT,                          -- Reason for transfer (from AI)
  error_message TEXT,                   -- Error details if failed
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  duration_seconds INTEGER
);

-- Indexes for auto_transfer_logs
CREATE INDEX IF NOT EXISTS idx_auto_transfer_logs_transfer_id 
  ON auto_transfer_logs(transfer_id);
CREATE INDEX IF NOT EXISTS idx_auto_transfer_logs_vapi_call_id 
  ON auto_transfer_logs(vapi_call_id);
CREATE INDEX IF NOT EXISTS idx_auto_transfer_logs_assistant_id 
  ON auto_transfer_logs(assistant_id);
CREATE INDEX IF NOT EXISTS idx_auto_transfer_logs_user_id 
  ON auto_transfer_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_transfer_logs_started_at 
  ON auto_transfer_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_auto_transfer_logs_status 
  ON auto_transfer_logs(status);

