-- Tool Call Logs Table
-- Tracks all CustomerConnect API calls for debugging and monitoring

CREATE TABLE IF NOT EXISTS tool_call_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  workspace_id TEXT,
  vapi_call_id TEXT,
  tool_name TEXT NOT NULL,
  phone_number TEXT,
  status TEXT NOT NULL, -- 'success', 'not_found', 'error', 'not_configured'
  request_timestamp INTEGER NOT NULL,
  response_timestamp INTEGER,
  response_time_ms INTEGER,
  customer_name TEXT,
  appointment_date TEXT,
  appointment_time TEXT,
  household TEXT,
  error_message TEXT,
  raw_response TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tool_call_logs_user_id ON tool_call_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_tool_call_logs_created_at ON tool_call_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_call_logs_status ON tool_call_logs(status);
CREATE INDEX IF NOT EXISTS idx_tool_call_logs_phone ON tool_call_logs(phone_number);

