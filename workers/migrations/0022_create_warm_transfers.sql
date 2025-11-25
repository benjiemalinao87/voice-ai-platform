-- Warm Transfers Table
-- Tracks warm transfer state for calls being transferred to human agents

CREATE TABLE IF NOT EXISTS warm_transfers (
  id TEXT PRIMARY KEY,
  vapi_call_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  conference_sid TEXT,
  agent_number TEXT NOT NULL,
  agent_call_sid TEXT,
  status TEXT DEFAULT 'initiated', -- initiated, dialing_agent, agent_answered, connected, failed, cancelled
  announcement TEXT,
  error_message TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_warm_transfers_vapi_call_id ON warm_transfers(vapi_call_id);
CREATE INDEX IF NOT EXISTS idx_warm_transfers_user_id ON warm_transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_warm_transfers_status ON warm_transfers(status);
CREATE INDEX IF NOT EXISTS idx_warm_transfers_created_at ON warm_transfers(created_at DESC);

