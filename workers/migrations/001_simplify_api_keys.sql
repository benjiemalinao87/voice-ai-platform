-- Migration: Remove encryption complexity, use plain API keys
-- This simplifies the user experience by removing password-based encryption

-- Step 1: Add new columns for plain keys
ALTER TABLE user_settings ADD COLUMN private_key TEXT;
ALTER TABLE user_settings ADD COLUMN public_key TEXT;

-- Step 2: The old encrypted columns will remain for now to avoid data loss
-- Users will need to re-enter their API keys in the Settings page
-- After all users have migrated, we can drop the old columns in a future migration

-- Note: encryption_salt and selected_org_id columns already exist
