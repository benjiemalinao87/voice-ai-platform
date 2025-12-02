-- Migration: Create agent_flows table for storing visual flow data
-- This allows editing agents as visual flows after creation

CREATE TABLE IF NOT EXISTS agent_flows (
  id TEXT PRIMARY KEY,                    -- UUID
  vapi_assistant_id TEXT UNIQUE NOT NULL, -- Links to VAPI assistant ID
  user_id TEXT NOT NULL,                  -- Owner of the flow
  flow_data TEXT NOT NULL,                -- JSON: { nodes: [...], edges: [...] }
  config_data TEXT NOT NULL,              -- JSON: { name, voiceId, model, ... }
  created_at INTEGER NOT NULL,            -- Unix timestamp
  updated_at INTEGER NOT NULL,            -- Unix timestamp
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_agent_flows_user_id ON agent_flows(user_id);

-- Index for fast lookups by VAPI assistant ID
CREATE INDEX IF NOT EXISTS idx_agent_flows_vapi_assistant_id ON agent_flows(vapi_assistant_id);

