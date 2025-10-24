-- Addons System Tables

-- User Addons Configuration (which addons are enabled for each user)
CREATE TABLE IF NOT EXISTS user_addons (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  addon_type TEXT NOT NULL,  -- 'enhanced_data', 'sentiment_analysis', etc.
  is_enabled INTEGER DEFAULT 0,  -- 1 = enabled, 0 = disabled
  settings TEXT,  -- JSON settings for the addon
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_addons_user_addon ON user_addons(user_id, addon_type);
CREATE INDEX IF NOT EXISTS idx_user_addons_user_id ON user_addons(user_id);
CREATE INDEX IF NOT EXISTS idx_user_addons_enabled ON user_addons(is_enabled);

-- Addon Results (store results from addon executions)
CREATE TABLE IF NOT EXISTS addon_results (
  id TEXT PRIMARY KEY,
  call_id TEXT NOT NULL,  -- Reference to webhook_calls.id
  user_id TEXT NOT NULL,
  addon_type TEXT NOT NULL,
  status TEXT NOT NULL,  -- 'success', 'failed', 'processing'
  result_data TEXT,  -- JSON result from addon
  error_message TEXT,
  execution_time_ms INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (call_id) REFERENCES webhook_calls(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_addon_results_call_id ON addon_results(call_id);
CREATE INDEX IF NOT EXISTS idx_addon_results_user_id ON addon_results(user_id);
CREATE INDEX IF NOT EXISTS idx_addon_results_addon_type ON addon_results(addon_type);
CREATE INDEX IF NOT EXISTS idx_addon_results_status ON addon_results(status);
CREATE INDEX IF NOT EXISTS idx_addon_results_created_at ON addon_results(created_at DESC);
