-- Demo Keywords for vic@channelautomation.com
-- Extracted from the 10 demo call transcripts with sentiment

-- User ID: 52c28d30-1085-4def-bcd7-d0642bf5568a

-- Positive keywords (from positive calls)
INSERT INTO call_keywords (id, user_id, keyword, count, positive_count, neutral_count, negative_count, avg_sentiment, created_at, last_detected_at)
VALUES
('kw_windows_001', '52c28d30-1085-4def-bcd7-d0642bf5568a', 'windows', 8, 5, 2, 1, 0.5, 1729641600000, 1730419200000),
('kw_schedule_002', '52c28d30-1085-4def-bcd7-d0642bf5568a', 'schedule', 5, 4, 1, 0, 0.8, 1729641600000, 1730419200000),
('kw_consultation_003', '52c28d30-1085-4def-bcd7-d0642bf5568a', 'consultation', 4, 3, 1, 0, 0.75, 1729641600000, 1730419200000),
('kw_interested_004', '52c28d30-1085-4def-bcd7-d0642bf5568a', 'interested', 4, 3, 1, 0, 0.75, 1729641600000, 1730419200000),
('kw_energy_005', '52c28d30-1085-4def-bcd7-d0642bf5568a', 'energy-efficient', 2, 2, 0, 0, 1.0, 1730419200000, 1730419200000),
('kw_doors_006', '52c28d30-1085-4def-bcd7-d0642bf5568a', 'doors', 6, 3, 2, 1, 0.33, 1729728000000, 1730419200000),
('kw_installation_007', '52c28d30-1085-4def-bcd7-d0642bf5568a', 'installation', 4, 2, 1, 1, 0.25, 1729814400000, 1730246400000),
('kw_pricing_008', '52c28d30-1085-4def-bcd7-d0642bf5568a', 'pricing', 3, 1, 2, 0, 0.33, 1729814400000, 1730332800000),
('kw_appointment_009', '52c28d30-1085-4def-bcd7-d0642bf5568a', 'appointment', 3, 2, 1, 0, 0.67, 1729987200000, 1730419200000),
('kw_replacement_010', '52c28d30-1085-4def-bcd7-d0642bf5568a', 'replacement', 4, 3, 0, 1, 0.5, 1729641600000, 1730419200000),
('kw_estimate_011', '52c28d30-1085-4def-bcd7-d0642bf5568a', 'estimate', 2, 2, 0, 0, 1.0, 1730073600000, 1730073600000),
('kw_french_012', '52c28d30-1085-4def-bcd7-d0642bf5568a', 'french doors', 2, 2, 0, 0, 1.0, 1730073600000, 1730073600000),
('kw_satisfied_013', '52c28d30-1085-4def-bcd7-d0642bf5568a', 'satisfied', 2, 2, 0, 0, 1.0, 1729728000000, 1730246400000),
('kw_ready_014', '52c28d30-1085-4def-bcd7-d0642bf5568a', 'ready', 2, 2, 0, 0, 1.0, 1729641600000, 1729900800000),
('kw_deposit_015', '52c28d30-1085-4def-bcd7-d0642bf5568a', 'deposit', 1, 1, 0, 0, 1.0, 1729900800000, 1729900800000),
('kw_purchase_016', '52c28d30-1085-4def-bcd7-d0642bf5568a', 'purchase', 1, 1, 0, 0, 1.0, 1729900800000, 1729900800000),
('kw_investment_017', '52c28d30-1085-4def-bcd7-d0642bf5568a', 'investment', 1, 1, 0, 0, 1.0, 1729900800000, 1729900800000);

-- Neutral keywords
INSERT INTO call_keywords (id, user_id, keyword, count, positive_count, neutral_count, negative_count, avg_sentiment, created_at, last_detected_at)
VALUES
('kw_timeline_018', '52c28d30-1085-4def-bcd7-d0642bf5568a', 'timeline', 2, 0, 2, 0, 0.0, 1729987200000, 1730332800000),
('kw_warranty_019', '52c28d30-1085-4def-bcd7-d0642bf5568a', 'warranty', 2, 0, 1, 1, -0.5, 1730160000000, 1730332800000),
('kw_brands_020', '52c28d30-1085-4def-bcd7-d0642bf5568a', 'brands', 1, 0, 1, 0, 0.0, 1729814400000, 1729814400000),
('kw_quotes_021', '52c28d30-1085-4def-bcd7-d0642bf5568a', 'quotes', 1, 0, 1, 0, 0.0, 1729814400000, 1729814400000),
('kw_comparing_022', '52c28d30-1085-4def-bcd7-d0642bf5568a', 'comparing', 1, 0, 1, 0, 0.0, 1729814400000, 1729814400000);

-- Negative keywords (from negative calls)
INSERT INTO call_keywords (id, user_id, keyword, count, positive_count, neutral_count, negative_count, avg_sentiment, created_at, last_detected_at)
VALUES
('kw_condensation_023', '52c28d30-1085-4def-bcd7-d0642bf5568a', 'condensation', 1, 0, 0, 1, -1.0, 1730160000000, 1730160000000),
('kw_seal_024', '52c28d30-1085-4def-bcd7-d0642bf5568a', 'seal failure', 1, 0, 0, 1, -1.0, 1730160000000, 1730160000000),
('kw_problem_025', '52c28d30-1085-4def-bcd7-d0642bf5568a', 'problem', 1, 0, 0, 1, -1.0, 1730160000000, 1730160000000),
('kw_covered_026', '52c28d30-1085-4def-bcd7-d0642bf5568a', 'covered', 1, 1, 0, 0, 1.0, 1730160000000, 1730160000000);

-- General high-frequency keywords
INSERT INTO call_keywords (id, user_id, keyword, count, positive_count, neutral_count, negative_count, avg_sentiment, created_at, last_detected_at)
VALUES
('kw_customer_027', '52c28d30-1085-4def-bcd7-d0642bf5568a', 'customer', 10, 6, 3, 1, 0.5, 1729641600000, 1730419200000),
('kw_service_028', '52c28d30-1085-4def-bcd7-d0642bf5568a', 'service', 3, 2, 1, 0, 0.67, 1729728000000, 1730246400000),
('kw_help_029', '52c28d30-1085-4def-bcd7-d0642bf5568a', 'help', 5, 3, 2, 0, 0.6, 1729641600000, 1730419200000),
('kw_thank_030', '52c28d30-1085-4def-bcd7-d0642bf5568a', 'thank you', 10, 6, 3, 1, 0.5, 1729641600000, 1730419200000);
