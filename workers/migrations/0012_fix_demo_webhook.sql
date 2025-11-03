-- Fix demo webhook for vic@channelautomation.com
-- This creates a demo webhook and ensures demo calls reference it properly

-- First, delete any existing demo webhook to avoid conflicts
DELETE FROM webhooks
WHERE user_id = (SELECT id FROM users WHERE email = 'vic@channelautomation.com')
AND webhook_url LIKE '%demo%';

-- Create demo webhook for vic@channelautomation.com
INSERT OR IGNORE INTO webhooks (
  id,
  user_id,
  webhook_url,
  is_active,
  created_at
)
SELECT
  'demo_webhook_vic',
  id,
  'https://api.voice-config.channelautomation.com/webhook/demo_6b43e1cc-4c53-434a-a2fd-f9f0bd80a1c2',
  1,
  unixepoch('now')
FROM users
WHERE email = 'vic@channelautomation.com';

-- Update all demo calls to reference the demo webhook
UPDATE webhook_calls
SET webhook_id = 'demo_webhook_vic'
WHERE user_id = (SELECT id FROM users WHERE email = 'vic@channelautomation.com')
AND id LIKE 'demo_call_%';

-- Verify the demo calls are properly linked
-- This will show the count of demo calls that should now have the correct webhook_id
SELECT COUNT(*) as demo_calls_count
FROM webhook_calls
WHERE webhook_id = 'demo_webhook_vic';
