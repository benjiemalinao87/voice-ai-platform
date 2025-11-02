-- Create demo calls for vic@channelautomation.com account
-- These calls will show in Intent Analysis with Enhanced Data tab

-- Get the user_id for vic@channelautomation.com
-- Note: This will only work if the user exists

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
  (SELECT id FROM webhooks WHERE user_id = (SELECT id FROM users WHERE email = 'vic@channelautomation.com') LIMIT 1),
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
  '{"message":{"artifact":{"transcript":"AI: Thank you for calling EcoView Windows and Doors. Scheduling department. This is James. Who do I have the pleasure of speaking with? Customer: Hi, this is Sarah Johnson. I\'m interested in getting some windows replaced. AI: Great! I can definitely help you with that. Are you looking for a consultation to discuss your options? Customer: Yes, exactly. I\'m particularly interested in energy-efficient windows. AI: Perfect! We specialize in energy-efficient solutions. Let me schedule that consultation for you. What day works best? Customer: How about next Tuesday? AI: Tuesday works great! What time would be convenient for you? Customer: 2 PM would be perfect. AI: Excellent! I have you scheduled for Tuesday at 2 PM. Our specialist will bring samples and discuss all your energy-efficient options. Customer: That sounds wonderful, thank you! AI: You\'re very welcome, Sarah. We look forward to seeing you on Tuesday!"}}}',
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
  (SELECT id FROM webhooks WHERE user_id = (SELECT id FROM users WHERE email = 'vic@channelautomation.com') LIMIT 1),
  (SELECT id FROM users WHERE email = 'vic@channelautomation.com'),
  'vapi_demo_002',
  '+15035559876',
  '+15035559876',
  'https://recordings.vapi.ai/demo/002.mp3',
  'customer-ended-call',
  'Customer inquired about pricing for sliding glass doors. Asked several questions about installation timeline and warranty coverage.',
  'Information',
  'Neutral',
  'Follow-up Required',
  1,
  unixepoch('now') - 172800,
  'Michael Rodriguez',
  '{}',
  '{"message":{"artifact":{"transcript":"AI: Thank you for calling EcoView Windows and Doors. This is Alex. How can I help you today? Customer: Hi, I\'m interested in learning more about your sliding glass doors. Can you tell me about pricing? AI: Absolutely! Our sliding glass doors range from $2,500 to $8,000 depending on size and features. What size opening are you working with? Customer: It\'s a standard 8-foot opening. How long does installation typically take? AI: For an 8-foot sliding door, installation usually takes one full day. We include removal of your old door and cleanup. Customer: That\'s good to know. What about warranties? AI: We offer a lifetime warranty on the frame and hardware, plus a 20-year seal warranty. Customer: Okay, I need to think about it and discuss with my wife. AI: Of course! Take your time. Would you like me to email you our brochure? Customer: That would be great, thanks."}}}',
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
  (SELECT id FROM webhooks WHERE user_id = (SELECT id FROM users WHERE email = 'vic@channelautomation.com') LIMIT 1),
  (SELECT id FROM users WHERE email = 'vic@channelautomation.com'),
  'vapi_demo_003',
  '+12065557890',
  '+12065557890',
  'https://recordings.vapi.ai/demo/003.mp3',
  'customer-ended-call',
  'Existing customer called to schedule installation of previously ordered bay window. Very satisfied with previous service.',
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
  '{"message":{"artifact":{"transcript":"AI: Thank you for calling EcoView Windows and Doors. This is Maria speaking. How may I assist you? Customer: Hi Maria, this is Jennifer Chen. I ordered a bay window from you last month and I\'d like to schedule the installation. AI: Of course, Ms. Chen! Let me pull up your order. Yes, I see it here - beautiful bay window for your living room. Customer: Yes, that\'s the one! I\'m so excited to get it installed. AI: We\'re excited too! When would be a good time for our installation team? Customer: Would next Thursday work? AI: Let me check... yes, we have availability next Thursday. Morning or afternoon? Customer: Morning would be perfect, around 10 AM if possible. AI: 10 AM Thursday it is! The installation typically takes 6-8 hours. Our team will call you the day before to confirm. Customer: That\'s perfect. You guys did such a great job on my previous windows, I have complete confidence. AI: Thank you so much for the kind words! We\'ll make sure your bay window installation is just as perfect."}}}',
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
  (SELECT id FROM webhooks WHERE user_id = (SELECT id FROM users WHERE email = 'vic@channelautomation.com') LIMIT 1),
  (SELECT id FROM users WHERE email = 'vic@channelautomation.com'),
  'vapi_demo_004',
  '+13105554321',
  '+13105554321',
  'https://recordings.vapi.ai/demo/004.mp3',
  'customer-ended-call',
  'Customer reported condensation between window panes, indicating seal failure. Issue escalated to warranty department.',
  'Support',
  'Negative',
  'Follow-up Required',
  1,
  unixepoch('now') - 345600,
  'Robert Martinez',
  '{}',
  '{"message":{"artifact":{"transcript":"AI: EcoView Windows and Doors support department. This is Tom. How can I help you? Customer: Hi, I\'m having an issue with one of my windows. There\'s condensation forming between the glass panes. AI: I\'m sorry to hear that. That usually indicates a seal failure. When were your windows installed? Customer: About 3 years ago. Is this covered under warranty? AI: Yes, our seal warranty covers this for 20 years. Can you tell me which window is affected? Customer: It\'s the large window in my master bedroom, facing the backyard. AI: I understand your frustration. Let me escalate this to our warranty department. They\'ll contact you within 24 hours to schedule a replacement. Customer: Will I have to pay anything? AI: No sir, this is fully covered. We\'ll replace the glass unit at no cost to you. Customer: Okay, that\'s better. I was worried this would be expensive. AI: Not at all. We stand behind our products. You\'ll hear from our warranty team tomorrow."}}}',
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
  (SELECT id FROM webhooks WHERE user_id = (SELECT id FROM users WHERE email = 'vic@channelautomation.com') LIMIT 1),
  (SELECT id FROM users WHERE email = 'vic@channelautomation.com'),
  'vapi_demo_005',
  '+14085556789',
  '+14085556789',
  'https://recordings.vapi.ai/demo/005.mp3',
  'customer-ended-call',
  'Customer asking about French door options for patio. Interested in both interior and exterior options. Requested free estimate.',
  'Information',
  'Positive',
  'Successful',
  1,
  unixepoch('now') - 432000,
  'Amanda Foster',
  '{}',
  '{"message":{"artifact":{"transcript":"AI: Good afternoon! Thank you for calling EcoView Windows and Doors. I\'m Jessica. How may I help you today? Customer: Hi Jessica! I\'m looking to replace my patio door with French doors. Do you offer those? AI: Yes we do! French doors are one of our most popular options. Are you looking for inswing or outswing? Customer: I hadn\'t thought about that. What do you recommend? AI: For patios, outswing is usually better as it doesn\'t take up interior space. Plus, they\'re more secure. Customer: That makes sense. What about the cost? AI: Our French doors typically range from $3,500 to $7,000 depending on size and glass options. We offer impact-resistant glass, decorative grilles, and various finishes. Customer: Those sound beautiful. How do I get an estimate? AI: We can schedule a free in-home consultation where we\'ll measure, show you samples, and provide a detailed quote. Customer: That would be perfect! AI: Wonderful! What day works best for you?"}}}',
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
  (SELECT id FROM webhooks WHERE user_id = (SELECT id FROM users WHERE email = 'vic@channelautomation.com') LIMIT 1),
  (SELECT id FROM users WHERE email = 'vic@channelautomation.com'),
  'vapi_demo_006',
  '+16195553456',
  '+16195553456',
  'https://recordings.vapi.ai/demo/006.mp3',
  'customer-ended-call',
  'Customer needs to reschedule consultation appointment due to work conflict. Moved to Friday afternoon.',
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
  '{"message":{"artifact":{"transcript":"AI: EcoView Windows and Doors, scheduling department. This is Rachel. How can I help? Customer: Hi, I need to reschedule my consultation appointment. I have it scheduled for Wednesday but something came up at work. AI: No problem at all! Let me pull up your appointment. May I have your name? Customer: David Thompson. AI: Thank you Mr. Thompson. I see you\'re scheduled for Wednesday at 10 AM. When would work better for you? Customer: Could we do Friday instead? AI: Let me check Friday... yes, we have availability. Morning or afternoon? Customer: Afternoon would be better, maybe around 3 or 3:30? AI: I can do 3:30 PM Friday. Does that work? Customer: Perfect, thank you. AI: You\'re all set! We\'ll see you Friday at 3:30."}}}',
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
  (SELECT id FROM webhooks WHERE user_id = (SELECT id FROM users WHERE email = 'vic@channelautomation.com') LIMIT 1),
  (SELECT id FROM users WHERE email = 'vic@channelautomation.com'),
  'vapi_demo_007',
  '+14155557777',
  '+14155557777',
  'https://recordings.vapi.ai/demo/007.mp3',
  'customer-ended-call',
  'Customer ready to move forward with full house window replacement. Placing deposit and scheduling installation.',
  'Purchase',
  'Positive',
  'Successful',
  1,
  unixepoch('now') - 604800,
  'Lisa Anderson',
  '{}',
  '{"message":{"artifact":{"transcript":"AI: Good morning! EcoView Windows and Doors, this is Brandon. How may I help you? Customer: Hi Brandon, I received my quote last week for replacing all the windows in my house and I\'m ready to move forward! AI: That\'s fantastic news! I\'m so glad you\'ve decided to work with us. Let me pull up your quote. Customer: Yes, it was for 12 windows total - the energy-efficient triple pane package. AI: Perfect, I have it here. That comes to $18,500 with our current promotion. To secure your spot, we typically ask for a 30% deposit. Customer: That\'s fine. Can I pay with a credit card? AI: Absolutely. And I can get you scheduled for installation in about 3 weeks. Does that timeframe work? Customer: Yes, that\'s perfect timing. AI: Wonderful! Let me process your deposit and get you on the calendar. You\'re making a great investment in your home!"}}}',
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
  (SELECT id FROM webhooks WHERE user_id = (SELECT id FROM users WHERE email = 'vic@channelautomation.com') LIMIT 1),
  (SELECT id FROM users WHERE email = 'vic@channelautomation.com'),
  'vapi_demo_008',
  '+15035558888',
  '+15035558888',
  'https://recordings.vapi.ai/demo/008.mp3',
  'customer-ended-call',
  'Customer comparing different window brands and installation costs. Taking time to research options.',
  'Information',
  'Neutral',
  'Follow-up Required',
  1,
  unixepoch('now') - 691200,
  'James Wilson',
  '{}',
  '{"message":{"artifact":{"transcript":"AI: Thank you for calling EcoView Windows and Doors. This is Sarah. How can I assist you today? Customer: Hi, I\'m getting quotes from several companies for window replacement. Can you tell me what brands you carry? AI: Of course! We primarily install Milgard and Pella windows, both top-tier manufacturers with excellent warranties. Customer: How do your prices compare to other companies? AI: We\'re very competitive. Our pricing includes professional installation, disposal of old windows, and lifetime warranty on labor. Customer: Do you offer financing? AI: Yes, we offer 12-month same-as-cash and longer terms with approved credit. Customer: Okay. I\'m still getting quotes from other companies but I\'ll keep you in mind. AI: That\'s perfectly fine. Take your time and choose what\'s best for you. Would you like me to email you our information? Customer: Sure, that would be helpful."}}}',
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
  (SELECT id FROM webhooks WHERE user_id = (SELECT id FROM users WHERE email = 'vic@channelautomation.com') LIMIT 1),
  (SELECT id FROM users WHERE email = 'vic@channelautomation.com'),
  'vapi_demo_009',
  '+14085559999',
  '+14085559999',
  'https://recordings.vapi.ai/demo/009.mp3',
  'customer-ended-call',
  'Customer inquiring about routine maintenance for recently installed windows. Provided care instructions and cleaning recommendations.',
  'Support',
  'Positive',
  'Successful',
  1,
  unixepoch('now') - 777600,
  'Patricia Lee',
  '{}',
  '{"message":{"artifact":{"transcript":"AI: EcoView Windows and Doors support team. This is Kevin. How may I help you? Customer: Hi Kevin! I just had windows installed a few weeks ago and I want to make sure I\'m taking care of them properly. AI: That\'s great that you\'re being proactive! What specifically would you like to know? Customer: Well, how often should I clean them and what should I use? AI: For the glass, regular window cleaner works fine. We recommend cleaning quarterly. For the frames, just warm soapy water. Customer: What about the tracks and seals? AI: Good question! Vacuum the tracks monthly and wipe them down. The seals don\'t need much - just keep them clean and they\'ll last for years. Customer: That\'s simpler than I thought! Anything else I should know? AI: Just check the weep holes at the bottom of the frame occasionally to make sure they\'re clear. That allows water to drain properly. Customer: Perfect! Thank you so much for the information. AI: My pleasure! Enjoy your new windows!"}}}',
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
  (SELECT id FROM webhooks WHERE user_id = (SELECT id FROM users WHERE email = 'vic@channelautomation.com') LIMIT 1),
  (SELECT id FROM users WHERE email = 'vic@channelautomation.com'),
  'vapi_demo_010',
  '+16195551111',
  '+16195551111',
  'https://recordings.vapi.ai/demo/010.mp3',
  'customer-ended-call',
  'New customer wants consultation for both windows and doors. Very motivated buyer, has budget ready.',
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
  '{"message":{"artifact":{"transcript":"AI: Thank you for calling EcoView Windows and Doors! This is Michelle speaking. How can I help you today? Customer: Hi Michelle! I just bought a house and I want to replace all the windows and the front door before we move in. AI: Congratulations on your new home! That\'s a great time to do upgrades. How many windows are we talking about? Customer: I think there are about 15 windows, and I want a really nice entry door - something that makes a statement. AI: Wonderful! We can definitely help with that. I\'d love to schedule a consultation where we can come measure, show you our door styles, and discuss your window options. Customer: Yes, the sooner the better. We close in two weeks and I want to get this done quickly. AI: I understand. We can get someone out there as early as Thursday if that works for you. Customer: Thursday would be perfect! How about 11 AM? AI: 11 AM Thursday it is! We\'ll bring our full catalog and can provide a detailed quote on the spot. Customer: Excellent! This is exactly what I needed. Thank you!"}}}',
  unixepoch('now') - 864000
WHERE (SELECT id FROM users WHERE email = 'vic@channelautomation.com') IS NOT NULL;
