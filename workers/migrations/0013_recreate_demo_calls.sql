-- Recreate demo calls for vic@channelautomation.com with proper webhook reference
-- This uses the demo_webhook_vic webhook created in 0012_fix_demo_webhook.sql

-- Demo Call 1: Scheduling - Positive
INSERT INTO webhook_calls (
  id, webhook_id, user_id, vapi_call_id, phone_number, customer_number,
  recording_url, ended_reason, summary, intent, sentiment, outcome,
  analysis_completed, analyzed_at, customer_name, customer_email,
  appointment_date, appointment_time, appointment_type,
  structured_data, raw_payload, created_at
)
SELECT
  'demo_call_001',
  'wh_6b43e1cc-4c53-434a-a2fd-f9f0bd80a1c2',
  (SELECT id FROM users WHERE email = 'vic@channelautomation.com'),
  'vapi_demo_001',
  '+14155551234',
  '+14155551234',
  'https://recordings.vapi.ai/demo/001.mp3',
  'customer-ended-call',
  'Customer called to schedule a window replacement consultation. Showed strong interest in energy-efficient options and requested an appointment for next Tuesday at 2 PM.',
  'Scheduling',
  'Positive',
  'Successful',
  1,
  unixepoch('now') - 86400,
  'Sarah Johnson',
  'sarah.j@email.com',
  date('now', '+5 days'),
  '2:00 PM',
  'Consultation',
  '{}',
  '{"message":{"call":{"startedAt":"2025-01-15T14:30:00Z","endedAt":"2025-01-15T14:33:00Z"},"artifact":{"transcript":"Thank you for calling Home Project Partners. This is Sarah. How can I help you?"}}}',
  unixepoch('now') - 86400
WHERE (SELECT id FROM users WHERE email = 'vic@channelautomation.com') IS NOT NULL;

-- Demo Call 2: Information - Neutral
INSERT INTO webhook_calls (
  id, webhook_id, user_id, vapi_call_id, phone_number, customer_number,
  recording_url, ended_reason, summary, intent, sentiment, outcome,
  analysis_completed, analyzed_at, customer_name,
  structured_data, raw_payload, created_at
)
SELECT
  'demo_call_002',
  'wh_6b43e1cc-4c53-434a-a2fd-f9f0bd80a1c2',
  (SELECT id FROM users WHERE email = 'vic@channelautomation.com'),
  'vapi_demo_002',
  '+15035559876',
  '+15035559876',
  'https://recordings.vapi.ai/demo/002.mp3',
  'customer-ended-call',
  'Customer inquired about pricing for services. Asked several questions about installation timeline and options.',
  'Information',
  'Neutral',
  'Follow-up Required',
  1,
  unixepoch('now') - 172800,
  'Michael Rodriguez',
  '{}',
  '{"message":{"call":{"startedAt":"2025-01-14T16:45:00Z","endedAt":"2025-01-14T16:52:00Z"},"artifact":{"transcript":"Hello, I am interested in learning more about your services. Can you tell me about pricing?"}}}',
  unixepoch('now') - 172800
WHERE (SELECT id FROM users WHERE email = 'vic@channelautomation.com') IS NOT NULL;

-- Demo Call 3: Scheduling - Positive
INSERT INTO webhook_calls (
  id, webhook_id, user_id, vapi_call_id, phone_number, customer_number,
  recording_url, ended_reason, summary, intent, sentiment, outcome,
  analysis_completed, analyzed_at, customer_name,
  appointment_date, appointment_time, appointment_type,
  structured_data, raw_payload, created_at
)
SELECT
  'demo_call_003',
  'wh_6b43e1cc-4c53-434a-a2fd-f9f0bd80a1c2',
  (SELECT id FROM users WHERE email = 'vic@channelautomation.com'),
  'vapi_demo_003',
  '+12065557890',
  '+12065557890',
  'https://recordings.vapi.ai/demo/003.mp3',
  'customer-ended-call',
  'Existing customer called to schedule installation. Very satisfied with previous service.',
  'Scheduling',
  'Positive',
  'Successful',
  1,
  unixepoch('now') - 259200,
  'Jennifer Chen',
  date('now', '+3 days'),
  '10:00 AM',
  'Installation',
  '{}',
  '{"message":{"call":{"startedAt":"2025-01-13T13:10:00Z","endedAt":"2025-01-13T13:16:20Z"},"artifact":{"transcript":"Hi, I would like to schedule an installation for my previous order."}}}',
  unixepoch('now') - 259200
WHERE (SELECT id FROM users WHERE email = 'vic@channelautomation.com') IS NOT NULL;

-- Demo Call 4: Support - Negative
INSERT INTO webhook_calls (
  id, webhook_id, user_id, vapi_call_id, phone_number, customer_number,
  recording_url, ended_reason, summary, intent, sentiment, outcome,
  analysis_completed, analyzed_at, customer_name,
  structured_data, raw_payload, created_at
)
SELECT
  'demo_call_004',
  'wh_6b43e1cc-4c53-434a-a2fd-f9f0bd80a1c2',
  (SELECT id FROM users WHERE email = 'vic@channelautomation.com'),
  'vapi_demo_004',
  '+13105554321',
  '+13105554321',
  'https://recordings.vapi.ai/demo/004.mp3',
  'customer-ended-call',
  'Customer reported an issue with a recent service. Issue escalated to support department.',
  'Support',
  'Negative',
  'Follow-up Required',
  1,
  unixepoch('now') - 345600,
  'Robert Martinez',
  '{}',
  '{"message":{"call":{"startedAt":"2025-01-11T11:20:00Z","endedAt":"2025-01-11T11:25:20Z"},"artifact":{"transcript":"I am having an issue with a recent service. Is this covered under warranty?"}}}',
  unixepoch('now') - 345600
WHERE (SELECT id FROM users WHERE email = 'vic@channelautomation.com') IS NOT NULL;

-- Demo Call 5: Information - Positive
INSERT INTO webhook_calls (
  id, webhook_id, user_id, vapi_call_id, phone_number, customer_number,
  recording_url, ended_reason, summary, intent, sentiment, outcome,
  analysis_completed, analyzed_at, customer_name,
  structured_data, raw_payload, created_at
)
SELECT
  'demo_call_005',
  'wh_6b43e1cc-4c53-434a-a2fd-f9f0bd80a1c2',
  (SELECT id FROM users WHERE email = 'vic@channelautomation.com'),
  'vapi_demo_005',
  '+14085556789',
  '+14085556789',
  'https://recordings.vapi.ai/demo/005.mp3',
  'customer-ended-call',
  'Customer asking about options and requesting information. Interested and engaged.',
  'Information',
  'Positive',
  'Successful',
  1,
  unixepoch('now') - 432000,
  'Amanda Foster',
  '{}',
  '{"message":{"call":{"startedAt":"2025-01-10T09:15:00Z","endedAt":"2025-01-10T09:19:00Z"},"artifact":{"transcript":"I am looking to get more information about your services. Do you offer consultations?"}}}',
  unixepoch('now') - 432000
WHERE (SELECT id FROM users WHERE email = 'vic@channelautomation.com') IS NOT NULL;

-- Demo Call 6: Scheduling - Neutral
INSERT INTO webhook_calls (
  id, webhook_id, user_id, vapi_call_id, phone_number, customer_number,
  recording_url, ended_reason, summary, intent, sentiment, outcome,
  analysis_completed, analyzed_at, customer_name,
  appointment_date, appointment_time, appointment_type,
  structured_data, raw_payload, created_at
)
SELECT
  'demo_call_006',
  'wh_6b43e1cc-4c53-434a-a2fd-f9f0bd80a1c2',
  (SELECT id FROM users WHERE email = 'vic@channelautomation.com'),
  'vapi_demo_006',
  '+16195553456',
  '+16195553456',
  'https://recordings.vapi.ai/demo/006.mp3',
  'customer-ended-call',
  'Customer needs to reschedule appointment due to conflict. Moved to Friday afternoon.',
  'Scheduling',
  'Neutral',
  'Successful',
  1,
  unixepoch('now') - 518400,
  'David Thompson',
  date('now', '+7 days'),
  '3:30 PM',
  'Consultation',
  '{}',
  '{"message":{"call":{"startedAt":"2025-01-08T11:00:00Z","endedAt":"2025-01-08T11:03:00Z"},"artifact":{"transcript":"I need to reschedule my appointment. Can we move it to Friday?"}}}',
  unixepoch('now') - 518400
WHERE (SELECT id FROM users WHERE email = 'vic@channelautomation.com') IS NOT NULL;

-- Demo Call 7: Purchase - Positive
INSERT INTO webhook_calls (
  id, webhook_id, user_id, vapi_call_id, phone_number, customer_number,
  recording_url, ended_reason, summary, intent, sentiment, outcome,
  analysis_completed, analyzed_at, customer_name,
  structured_data, raw_payload, created_at
)
SELECT
  'demo_call_007',
  'wh_6b43e1cc-4c53-434a-a2fd-f9f0bd80a1c2',
  (SELECT id FROM users WHERE email = 'vic@channelautomation.com'),
  'vapi_demo_007',
  '+14155557777',
  '+14155557777',
  'https://recordings.vapi.ai/demo/007.mp3',
  'customer-ended-call',
  'Customer ready to move forward. Placing order and scheduling installation.',
  'Purchase',
  'Positive',
  'Successful',
  1,
  unixepoch('now') - 604800,
  'Lisa Anderson',
  '{}',
  '{"message":{"call":{"startedAt":"2025-01-07T14:30:00Z","endedAt":"2025-01-07T14:34:00Z"},"artifact":{"transcript":"I received the quote and I am ready to move forward with the order."}}}',
  unixepoch('now') - 604800
WHERE (SELECT id FROM users WHERE email = 'vic@channelautomation.com') IS NOT NULL;

-- Demo Call 8: Information - Neutral
INSERT INTO webhook_calls (
  id, webhook_id, user_id, vapi_call_id, phone_number, customer_number,
  recording_url, ended_reason, summary, intent, sentiment, outcome,
  analysis_completed, analyzed_at, customer_name,
  structured_data, raw_payload, created_at
)
SELECT
  'demo_call_008',
  'wh_6b43e1cc-4c53-434a-a2fd-f9f0bd80a1c2',
  (SELECT id FROM users WHERE email = 'vic@channelautomation.com'),
  'vapi_demo_008',
  '+15035558888',
  '+15035558888',
  'https://recordings.vapi.ai/demo/008.mp3',
  'customer-ended-call',
  'Customer comparing options and researching. Taking time to evaluate.',
  'Information',
  'Neutral',
  'Follow-up Required',
  1,
  unixepoch('now') - 691200,
  'James Wilson',
  '{}',
  '{"message":{"call":{"startedAt":"2025-01-05T10:00:00Z","endedAt":"2025-01-05T10:05:30Z"},"artifact":{"transcript":"I am getting quotes from several companies. Can you tell me what options you have?"}}}',
  unixepoch('now') - 691200
WHERE (SELECT id FROM users WHERE email = 'vic@channelautomation.com') IS NOT NULL;

-- Demo Call 9: Support - Positive
INSERT INTO webhook_calls (
  id, webhook_id, user_id, vapi_call_id, phone_number, customer_number,
  recording_url, ended_reason, summary, intent, sentiment, outcome,
  analysis_completed, analyzed_at, customer_name,
  structured_data, raw_payload, created_at
)
SELECT
  'demo_call_009',
  'wh_6b43e1cc-4c53-434a-a2fd-f9f0bd80a1c2',
  (SELECT id FROM users WHERE email = 'vic@channelautomation.com'),
  'vapi_demo_009',
  '+14085559999',
  '+14085559999',
  'https://recordings.vapi.ai/demo/009.mp3',
  'customer-ended-call',
  'Customer inquiring about routine maintenance. Provided care instructions.',
  'Support',
  'Positive',
  'Successful',
  1,
  unixepoch('now') - 777600,
  'Patricia Lee',
  '{}',
  '{"message":{"call":{"startedAt":"2025-01-03T09:20:00Z","endedAt":"2025-01-03T09:26:40Z"},"artifact":{"transcript":"I want to make sure I am taking care of everything properly. What maintenance do you recommend?"}}}',
  unixepoch('now') - 777600
WHERE (SELECT id FROM users WHERE email = 'vic@channelautomation.com') IS NOT NULL;

-- Demo Call 10: Scheduling - Positive
INSERT INTO webhook_calls (
  id, webhook_id, user_id, vapi_call_id, phone_number, customer_number,
  recording_url, ended_reason, summary, intent, sentiment, outcome,
  analysis_completed, analyzed_at, customer_name,
  appointment_date, appointment_time, appointment_type,
  structured_data, raw_payload, created_at
)
SELECT
  'demo_call_010',
  'wh_6b43e1cc-4c53-434a-a2fd-f9f0bd80a1c2',
  (SELECT id FROM users WHERE email = 'vic@channelautomation.com'),
  'vapi_demo_010',
  '+16195551111',
  '+16195551111',
  'https://recordings.vapi.ai/demo/010.mp3',
  'customer-ended-call',
  'New customer wants consultation. Very motivated buyer with budget ready.',
  'Scheduling',
  'Positive',
  'Successful',
  1,
  unixepoch('now') - 864000,
  'Christopher Brown',
  date('now', '+2 days'),
  '11:00 AM',
  'Consultation',
  '{}',
  '{"message":{"call":{"startedAt":"2025-01-02T14:45:00Z","endedAt":"2025-01-02T14:49:00Z"},"artifact":{"transcript":"I just purchased a new property and want to schedule a consultation as soon as possible."}}}',
  unixepoch('now') - 864000
WHERE (SELECT id FROM users WHERE email = 'vic@channelautomation.com') IS NOT NULL;
