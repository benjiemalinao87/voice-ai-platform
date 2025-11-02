-- Demo Data for vic@channelautomation.com
-- Run these SQL statements in Cloudflare D1 Studio

-- Step 1: Create webhook for vic
INSERT INTO webhooks (id, user_id, webhook_url, name, is_active, created_at, updated_at)
VALUES (
  'webhook_vic_demo_001',
  '52c28d30-1085-4def-bcd7-d0642bf5568a',
  'https://api.voice-config.channelautomation.com/webhooks/webhook_vic_demo_001',
  'Demo Webhook',
  1,
  1730505600000,
  1730505600000
);

-- Step 2: Insert 10 demo calls
-- Call 1: Sarah Johnson - Scheduling (Positive)
INSERT INTO webhook_calls (
  id, webhook_id, user_id, vapi_call_id, phone_number, customer_number,
  recording_url, ended_reason, summary, intent, sentiment, outcome,
  analysis_completed, analyzed_at, customer_name, customer_email,
  appointment_date, appointment_time, appointment_type,
  structured_data, raw_payload, created_at
) VALUES (
  'demo_call_001',
  'webhook_vic_demo_001',
  '52c28d30-1085-4def-bcd7-d0642bf5568a',
  'demo_call_001',
  '+18005551234',
  '+14155551234',
  'https://recordings.vapi.ai/demo.mp3',
  'customer-ended-call',
  'Customer called to schedule a window replacement consultation. Showed strong interest in energy-efficient options.',
  'Scheduling',
  'Positive',
  'Successful',
  1,
  1730419200,
  'Sarah Johnson',
  NULL,
  '2025-11-07',
  '2:00 PM',
  NULL,
  NULL,
  '{"message":{"artifact":{"transcript":"AI: Thank you for calling EcoView Windows and Doors. This is James. Customer: Hi, this is Sarah Johnson. I am interested in getting some windows replaced. AI: Great! Are you looking for a consultation? Customer: Yes, I am particularly interested in energy-efficient windows. AI: Perfect! Let me schedule that for you."}}}',
  1730419200000
);

-- Call 2: Michael Rodriguez - Information (Neutral)
INSERT INTO webhook_calls (
  id, webhook_id, user_id, vapi_call_id, phone_number, customer_number,
  recording_url, ended_reason, summary, intent, sentiment, outcome,
  analysis_completed, analyzed_at, customer_name, customer_email,
  appointment_date, appointment_time, appointment_type,
  structured_data, raw_payload, created_at
) VALUES (
  'demo_call_002',
  'webhook_vic_demo_001',
  '52c28d30-1085-4def-bcd7-d0642bf5568a',
  'demo_call_002',
  '+18005551234',
  '+15035559876',
  'https://recordings.vapi.ai/demo.mp3',
  'customer-ended-call',
  'Customer inquired about pricing for sliding glass doors. Asked about installation timeline and warranty.',
  'Information',
  'Neutral',
  'Follow-up Required',
  1,
  1730332800,
  'Michael Rodriguez',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '{"message":{"artifact":{"transcript":"AI: Thank you for calling EcoView. This is Alex. Customer: Hi, I am interested in learning about sliding glass doors. Can you tell me about pricing? AI: Our doors range from $2,500 to $8,000. Customer: How long does installation take? AI: Usually one full day. Customer: I need to think about it."}}}',
  1730332800000
);

-- Call 3: Jennifer Chen - Scheduling (Positive)
INSERT INTO webhook_calls (
  id, webhook_id, user_id, vapi_call_id, phone_number, customer_number,
  recording_url, ended_reason, summary, intent, sentiment, outcome,
  analysis_completed, analyzed_at, customer_name, customer_email,
  appointment_date, appointment_time, appointment_type,
  structured_data, raw_payload, created_at
) VALUES (
  'demo_call_003',
  'webhook_vic_demo_001',
  '52c28d30-1085-4def-bcd7-d0642bf5568a',
  'demo_call_003',
  '+18005551234',
  '+12065557890',
  'https://recordings.vapi.ai/demo.mp3',
  'customer-ended-call',
  'Existing customer scheduling installation of bay window. Very satisfied with previous service.',
  'Scheduling',
  'Positive',
  'Successful',
  1,
  1730246400,
  'Jennifer Chen',
  NULL,
  '2025-11-05',
  '10:00 AM',
  NULL,
  NULL,
  '{"message":{"artifact":{"transcript":"AI: Thank you for calling EcoView. This is Maria. Customer: Hi Maria, this is Jennifer Chen. I ordered a bay window last month and want to schedule installation. AI: Of course! When works for you? Customer: Thursday morning around 10 AM. AI: Perfect! You are all set."}}}',
  1730246400000
);

-- Call 4: Robert Martinez - Support (Negative)
INSERT INTO webhook_calls (
  id, webhook_id, user_id, vapi_call_id, phone_number, customer_number,
  recording_url, ended_reason, summary, intent, sentiment, outcome,
  analysis_completed, analyzed_at, customer_name, customer_email,
  appointment_date, appointment_time, appointment_type,
  structured_data, raw_payload, created_at
) VALUES (
  'demo_call_004',
  'webhook_vic_demo_001',
  '52c28d30-1085-4def-bcd7-d0642bf5568a',
  'demo_call_004',
  '+18005551234',
  '+13105554321',
  'https://recordings.vapi.ai/demo.mp3',
  'customer-ended-call',
  'Customer reported condensation between window panes. Escalated to warranty department.',
  'Support',
  'Negative',
  'Follow-up Required',
  1,
  1730160000,
  'Robert Martinez',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '{"message":{"artifact":{"transcript":"AI: EcoView support. This is Tom. Customer: I have condensation between my window panes. AI: That indicates a seal failure. When were they installed? Customer: About 3 years ago. Is this covered? AI: Yes, fully covered. We will replace at no cost."}}}',
  1730160000000
);

-- Call 5: Amanda Foster - Information (Positive)
INSERT INTO webhook_calls (
  id, webhook_id, user_id, vapi_call_id, phone_number, customer_number,
  recording_url, ended_reason, summary, intent, sentiment, outcome,
  analysis_completed, analyzed_at, customer_name, customer_email,
  appointment_date, appointment_time, appointment_type,
  structured_data, raw_payload, created_at
) VALUES (
  'demo_call_005',
  'webhook_vic_demo_001',
  '52c28d30-1085-4def-bcd7-d0642bf5568a',
  'demo_call_005',
  '+18005551234',
  '+14085556789',
  'https://recordings.vapi.ai/demo.mp3',
  'customer-ended-call',
  'Customer asking about French doors. Requested free estimate.',
  'Information',
  'Positive',
  'Successful',
  1,
  1730073600,
  'Amanda Foster',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '{"message":{"artifact":{"transcript":"AI: Good afternoon! This is Jessica. Customer: Hi! I am looking to replace my patio door with French doors. AI: Yes we offer those! Are you looking for inswing or outswing? Customer: What do you recommend? AI: For patios, outswing is better. Customer: How do I get an estimate? AI: We can schedule a free consultation."}}}',
  1730073600000
);

-- Call 6: David Thompson - Scheduling (Neutral)
INSERT INTO webhook_calls (
  id, webhook_id, user_id, vapi_call_id, phone_number, customer_number,
  recording_url, ended_reason, summary, intent, sentiment, outcome,
  analysis_completed, analyzed_at, customer_name, customer_email,
  appointment_date, appointment_time, appointment_type,
  structured_data, raw_payload, created_at
) VALUES (
  'demo_call_006',
  'webhook_vic_demo_001',
  '52c28d30-1085-4def-bcd7-d0642bf5568a',
  'demo_call_006',
  '+18005551234',
  '+16195553456',
  'https://recordings.vapi.ai/demo.mp3',
  'customer-ended-call',
  'Customer rescheduling consultation due to work conflict.',
  'Scheduling',
  'Neutral',
  'Successful',
  1,
  1729987200,
  'David Thompson',
  NULL,
  '2025-11-09',
  '3:30 PM',
  NULL,
  NULL,
  '{"message":{"artifact":{"transcript":"AI: Scheduling department. This is Rachel. Customer: I need to reschedule my Wednesday appointment. AI: No problem! When works better? Customer: Friday afternoon around 3:30? AI: Perfect! You are all set for Friday at 3:30."}}}',
  1729987200000
);

-- Call 7: Lisa Anderson - Purchase (Positive)
INSERT INTO webhook_calls (
  id, webhook_id, user_id, vapi_call_id, phone_number, customer_number,
  recording_url, ended_reason, summary, intent, sentiment, outcome,
  analysis_completed, analyzed_at, customer_name, customer_email,
  appointment_date, appointment_time, appointment_type,
  structured_data, raw_payload, created_at
) VALUES (
  'demo_call_007',
  'webhook_vic_demo_001',
  '52c28d30-1085-4def-bcd7-d0642bf5568a',
  'demo_call_007',
  '+18005551234',
  '+14155557777',
  'https://recordings.vapi.ai/demo.mp3',
  'customer-ended-call',
  'Customer ready for full house window replacement. Placing deposit.',
  'Purchase',
  'Positive',
  'Successful',
  1,
  1729900800,
  'Lisa Anderson',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '{"message":{"artifact":{"transcript":"AI: Good morning! This is Brandon. Customer: I received my quote last week and I am ready to move forward! AI: Fantastic! Let me process your deposit. Customer: Can I pay with credit card? AI: Absolutely. You are making a great investment!"}}}',
  1729900800000
);

-- Call 8: James Wilson - Information (Neutral)
INSERT INTO webhook_calls (
  id, webhook_id, user_id, vapi_call_id, phone_number, customer_number,
  recording_url, ended_reason, summary, intent, sentiment, outcome,
  analysis_completed, analyzed_at, customer_name, customer_email,
  appointment_date, appointment_time, appointment_type,
  structured_data, raw_payload, created_at
) VALUES (
  'demo_call_008',
  'webhook_vic_demo_001',
  '52c28d30-1085-4def-bcd7-d0642bf5568a',
  'demo_call_008',
  '+18005551234',
  '+15035558888',
  'https://recordings.vapi.ai/demo.mp3',
  'customer-ended-call',
  'Customer comparing window brands and prices.',
  'Information',
  'Neutral',
  'Follow-up Required',
  1,
  1729814400,
  'James Wilson',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '{"message":{"artifact":{"transcript":"AI: Thank you for calling EcoView. This is Sarah. Customer: I am getting quotes from several companies. What brands do you carry? AI: We install Milgard and Pella. Customer: How do your prices compare? AI: We are very competitive. Customer: I am still getting other quotes."}}}',
  1729814400000
);

-- Call 9: Patricia Lee - Support (Positive)
INSERT INTO webhook_calls (
  id, webhook_id, user_id, vapi_call_id, phone_number, customer_number,
  recording_url, ended_reason, summary, intent, sentiment, outcome,
  analysis_completed, analyzed_at, customer_name, customer_email,
  appointment_date, appointment_time, appointment_type,
  structured_data, raw_payload, created_at
) VALUES (
  'demo_call_009',
  'webhook_vic_demo_001',
  '52c28d30-1085-4def-bcd7-d0642bf5568a',
  'demo_call_009',
  '+18005551234',
  '+14085559999',
  'https://recordings.vapi.ai/demo.mp3',
  'customer-ended-call',
  'Customer asking about window maintenance. Provided care instructions.',
  'Support',
  'Positive',
  'Successful',
  1,
  1729728000,
  'Patricia Lee',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '{"message":{"artifact":{"transcript":"AI: Support team. This is Kevin. Customer: I just had windows installed and want to know how to care for them. AI: For glass, use regular cleaner quarterly. For frames, warm soapy water. Customer: What about tracks? AI: Vacuum monthly. Customer: Perfect, thank you!"}}}',
  1729728000000
);

-- Call 10: Christopher Brown - Scheduling (Positive)
INSERT INTO webhook_calls (
  id, webhook_id, user_id, vapi_call_id, phone_number, customer_number,
  recording_url, ended_reason, summary, intent, sentiment, outcome,
  analysis_completed, analyzed_at, customer_name, customer_email,
  appointment_date, appointment_time, appointment_type,
  structured_data, raw_payload, created_at
) VALUES (
  'demo_call_010',
  'webhook_vic_demo_001',
  '52c28d30-1085-4def-bcd7-d0642bf5568a',
  'demo_call_010',
  '+18005551234',
  '+16195551111',
  'https://recordings.vapi.ai/demo.mp3',
  'customer-ended-call',
  'New customer wants consultation for windows and doors. Motivated buyer.',
  'Scheduling',
  'Positive',
  'Successful',
  1,
  1729641600,
  'Christopher Brown',
  NULL,
  '2025-11-04',
  '11:00 AM',
  NULL,
  NULL,
  '{"message":{"artifact":{"transcript":"AI: Thank you for calling EcoView! This is Michelle. Customer: I just bought a house and want to replace all windows and the front door. AI: Congratulations! How many windows? Customer: About 15 windows and a nice entry door. AI: Perfect! Thursday at 11 AM work? Customer: Perfect!"}}}',
  1729641600000
);
