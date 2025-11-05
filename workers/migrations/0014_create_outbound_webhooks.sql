-- Migration: Create Outbound Webhooks Table
-- Description: Stores user-configured outbound webhook endpoints for real-time call notifications
-- Created: 2025-11-05

-- Outbound Webhooks Table (user-configured webhook destinations)
CREATE TABLE IF NOT EXISTS outbound_webhooks (
  id TEXT PRIMARY KEY,                    -- Unique ID (e.g., obwh_abc123xyz)
  user_id TEXT NOT NULL,                  -- Owner of the webhook
  workspace_id TEXT,                      -- Optional workspace association
  name TEXT NOT NULL,                     -- User-friendly name (e.g., "CRM Integration")
  destination_url TEXT NOT NULL,          -- User's webhook URL to POST to
  is_active INTEGER DEFAULT 1,            -- 1 = active, 0 = disabled
  events TEXT NOT NULL DEFAULT 'call.ended', -- Comma-separated events: 'call.started,call.ended'
  created_at INTEGER NOT NULL,            -- Unix timestamp
  updated_at INTEGER NOT NULL,            -- Unix timestamp
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_outbound_webhooks_user_id ON outbound_webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_outbound_webhooks_workspace_id ON outbound_webhooks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_outbound_webhooks_is_active ON outbound_webhooks(is_active);

-- Outbound Webhook Delivery Logs (audit trail of webhook dispatches)
CREATE TABLE IF NOT EXISTS outbound_webhook_logs (
  id TEXT PRIMARY KEY,                    -- Unique log ID
  outbound_webhook_id TEXT NOT NULL,      -- Reference to outbound webhook
  event_type TEXT NOT NULL,               -- 'call.started' or 'call.ended'
  call_id TEXT,                           -- VAPI call ID
  status TEXT NOT NULL,                   -- 'success' | 'failed' | 'timeout'
  http_status INTEGER,                    -- HTTP response code
  response_body TEXT,                     -- Response from destination URL
  error_message TEXT,                     -- Error details if failed
  retry_count INTEGER DEFAULT 0,          -- Number of retry attempts
  created_at INTEGER NOT NULL,            -- Unix timestamp
  FOREIGN KEY (outbound_webhook_id) REFERENCES outbound_webhooks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_outbound_webhook_logs_webhook_id ON outbound_webhook_logs(outbound_webhook_id);
CREATE INDEX IF NOT EXISTS idx_outbound_webhook_logs_status ON outbound_webhook_logs(status);
CREATE INDEX IF NOT EXISTS idx_outbound_webhook_logs_created_at ON outbound_webhook_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outbound_webhook_logs_call_id ON outbound_webhook_logs(call_id);
