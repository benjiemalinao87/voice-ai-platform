-- Migration: Add assistants_cache table for caching assistant data
-- Created: 2025-11-02

-- Assistants Cache Table (cached assistant data from Vapi)
CREATE TABLE IF NOT EXISTS assistants_cache (
  id TEXT PRIMARY KEY,                    -- Vapi assistant ID
  user_id TEXT NOT NULL,                  -- Owner of the assistant (via their API key)
  vapi_data TEXT NOT NULL,                -- JSON blob of full assistant data from Vapi
  cached_at INTEGER NOT NULL,             -- Unix timestamp when cached
  updated_at INTEGER NOT NULL,            -- Unix timestamp when assistant was last updated in Vapi
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assistants_cache_user_id ON assistants_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_assistants_cache_cached_at ON assistants_cache(cached_at DESC);

