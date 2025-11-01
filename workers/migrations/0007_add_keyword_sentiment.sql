-- Add sentiment tracking to keywords table
ALTER TABLE call_keywords ADD COLUMN positive_count INTEGER DEFAULT 0;
ALTER TABLE call_keywords ADD COLUMN neutral_count INTEGER DEFAULT 0;
ALTER TABLE call_keywords ADD COLUMN negative_count INTEGER DEFAULT 0;
ALTER TABLE call_keywords ADD COLUMN avg_sentiment REAL DEFAULT 0;
