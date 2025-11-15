-- Create phone lookup cache to avoid redundant Twilio API calls
CREATE TABLE IF NOT EXISTS phone_lookup_cache (
  id TEXT PRIMARY KEY,
  phone_number TEXT NOT NULL UNIQUE,
  caller_name TEXT,
  caller_type TEXT,
  carrier_name TEXT,
  line_type TEXT,
  cached_at INTEGER NOT NULL,
  -- Cache expires after 90 days (phone numbers can change carriers/ownership)
  expires_at INTEGER NOT NULL
);

-- Index for quick phone number lookups
CREATE INDEX IF NOT EXISTS idx_phone_lookup_phone ON phone_lookup_cache(phone_number);

-- Index for cache expiration cleanup
CREATE INDEX IF NOT EXISTS idx_phone_lookup_expires ON phone_lookup_cache(expires_at);
