-- Add appointment tracking fields to webhook_calls table
ALTER TABLE webhook_calls ADD COLUMN appointment_date TEXT;        -- ISO date format (YYYY-MM-DD)
ALTER TABLE webhook_calls ADD COLUMN appointment_time TEXT;        -- Time format (HH:MM AM/PM)
ALTER TABLE webhook_calls ADD COLUMN appointment_datetime INTEGER; -- Unix timestamp for easy querying
ALTER TABLE webhook_calls ADD COLUMN appointment_type TEXT;        -- e.g., "Consultation", "Service Call", "Follow-up"
ALTER TABLE webhook_calls ADD COLUMN appointment_notes TEXT;       -- Additional appointment details
ALTER TABLE webhook_calls ADD COLUMN customer_name TEXT;           -- Customer's name
ALTER TABLE webhook_calls ADD COLUMN customer_email TEXT;          -- Customer's email
