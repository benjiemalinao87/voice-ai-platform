-- Add OpenAI analysis fields to webhook_calls table
ALTER TABLE webhook_calls ADD COLUMN intent TEXT;
ALTER TABLE webhook_calls ADD COLUMN sentiment TEXT;
ALTER TABLE webhook_calls ADD COLUMN outcome TEXT;
ALTER TABLE webhook_calls ADD COLUMN analysis_completed INTEGER DEFAULT 0;
ALTER TABLE webhook_calls ADD COLUMN analyzed_at INTEGER;
