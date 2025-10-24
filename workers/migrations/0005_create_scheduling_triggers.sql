-- Create scheduling_triggers table for appointment webhook destinations
CREATE TABLE IF NOT EXISTS scheduling_triggers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,                     -- User-friendly name for the trigger
  destination_url TEXT NOT NULL,          -- Webhook URL to send appointment data
  is_active INTEGER DEFAULT 1,            -- 1 = active, 0 = disabled
  send_enhanced_data INTEGER DEFAULT 1,   -- 1 = include enhanced data if available, 0 = exclude
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scheduling_triggers_user_id ON scheduling_triggers(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduling_triggers_is_active ON scheduling_triggers(is_active);

-- Create scheduling_trigger_logs table to track webhook deliveries
CREATE TABLE IF NOT EXISTS scheduling_trigger_logs (
  id TEXT PRIMARY KEY,
  trigger_id TEXT NOT NULL,
  call_id TEXT NOT NULL,                  -- Reference to webhook_calls
  status TEXT NOT NULL,                   -- 'success' | 'error'
  http_status INTEGER,                    -- HTTP status code returned
  response_body TEXT,                     -- Response from destination webhook
  error_message TEXT,                     -- Error details if failed
  payload_sent TEXT,                      -- JSON payload that was sent
  created_at INTEGER NOT NULL,
  FOREIGN KEY (trigger_id) REFERENCES scheduling_triggers(id) ON DELETE CASCADE,
  FOREIGN KEY (call_id) REFERENCES webhook_calls(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scheduling_trigger_logs_trigger_id ON scheduling_trigger_logs(trigger_id);
CREATE INDEX IF NOT EXISTS idx_scheduling_trigger_logs_call_id ON scheduling_trigger_logs(call_id);
CREATE INDEX IF NOT EXISTS idx_scheduling_trigger_logs_created_at ON scheduling_trigger_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scheduling_trigger_logs_status ON scheduling_trigger_logs(status);
