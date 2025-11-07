-- Add indexes to improve dashboard query performance
-- These indexes help with the dashboard-summary query that filters by user_id
-- and then checks outcome, intent, sentiment, and recording_url

-- Index on outcome for qualified leads count
CREATE INDEX IF NOT EXISTS idx_webhook_calls_user_outcome ON webhook_calls(user_id, outcome);

-- Index on intent for appointment detection
CREATE INDEX IF NOT EXISTS idx_webhook_calls_user_intent ON webhook_calls(user_id, intent);

-- Index on sentiment for sentiment analysis
CREATE INDEX IF NOT EXISTS idx_webhook_calls_user_sentiment ON webhook_calls(user_id, sentiment);

-- Index on recording_url for answered calls count (IS NOT NULL checks)
-- Note: SQLite can use this index for IS NOT NULL checks on user_id filtered results
CREATE INDEX IF NOT EXISTS idx_webhook_calls_user_recording ON webhook_calls(user_id, recording_url);

-- Composite index for common dashboard queries (user_id + created_at for sorting)
-- This helps with queries that filter by user and order by created_at
CREATE INDEX IF NOT EXISTS idx_webhook_calls_user_created ON webhook_calls(user_id, created_at DESC);

