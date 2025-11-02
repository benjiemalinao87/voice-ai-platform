-- Update brand name from EcoView to Home Project Partners
-- Run these SQL statements in Cloudflare D1 Studio

-- Update all summaries
UPDATE webhook_calls
SET summary = REPLACE(summary, 'EcoView', 'Home Project Partners')
WHERE user_id = '52c28d30-1085-4def-bcd7-d0642bf5568a'
AND summary LIKE '%EcoView%';

-- Update all transcripts in raw_payload
UPDATE webhook_calls
SET raw_payload = REPLACE(raw_payload, 'EcoView Windows and Doors', 'Home Project Partners')
WHERE user_id = '52c28d30-1085-4def-bcd7-d0642bf5568a'
AND raw_payload LIKE '%EcoView%';

-- Update remaining EcoView references
UPDATE webhook_calls
SET raw_payload = REPLACE(raw_payload, 'EcoView', 'Home Project Partners')
WHERE user_id = '52c28d30-1085-4def-bcd7-d0642bf5568a'
AND raw_payload LIKE '%EcoView%';
