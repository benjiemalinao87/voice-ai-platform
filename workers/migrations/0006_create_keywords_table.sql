-- Create keywords tracking table
CREATE TABLE IF NOT EXISTS call_keywords (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  count INTEGER DEFAULT 1,
  last_detected_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_call_keywords_user_id ON call_keywords(user_id);

-- Index for keyword + user_id for quick updates
CREATE INDEX IF NOT EXISTS idx_call_keywords_user_keyword ON call_keywords(user_id, keyword);

-- Index for sorting by count (most popular keywords)
CREATE INDEX IF NOT EXISTS idx_call_keywords_count ON call_keywords(count DESC);

-- Index for recent keywords
CREATE INDEX IF NOT EXISTS idx_call_keywords_last_detected ON call_keywords(last_detected_at DESC);
