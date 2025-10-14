/*
  # Voice AI Platform Database Schema

  ## Overview
  This migration creates the database structure for a Voice AI platform dashboard.
  It includes tables for storing call metrics, agent configurations, and performance data.

  ## New Tables

  ### 1. `agents`
  Stores voice AI agent configurations and settings.
  - `id` (uuid, primary key) - Unique agent identifier
  - `name` (text) - Agent display name
  - `voice_id` (text) - Selected voice identifier
  - `voice_name` (text) - Human-readable voice name
  - `system_prompt` (text) - System-level instructions
  - `conversation_prompt` (text) - Conversation flow instructions
  - `tone` (text) - Response tone (professional, friendly, casual)
  - `response_style` (text) - Response style (concise, detailed, adaptive)
  - `api_key` (text) - API access key
  - `is_active` (boolean) - Whether agent is active
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 2. `calls`
  Stores individual call records and metadata.
  - `id` (uuid, primary key) - Unique call identifier
  - `agent_id` (uuid, foreign key) - Associated agent
  - `call_date` (timestamptz) - When call occurred
  - `duration_seconds` (integer) - Call duration
  - `language` (text) - Detected language (en/es)
  - `was_answered` (boolean) - Whether call was answered
  - `sentiment_score` (numeric) - Overall sentiment (-1 to 1)
  - `summary` (text) - AI-generated summary
  - `summary_length` (integer) - Summary character count
  - `is_qualified_lead` (boolean) - Sales qualification result
  - `has_appointment_intent` (boolean) - Appointment detection result
  - `crm_lead_created` (boolean) - Whether lead was created in CRM
  - `crm_sync_status` (text) - CRM sync status (success/error/pending)
  - `transcript` (text) - Full call transcript
  - `created_at` (timestamptz) - Record creation timestamp

  ### 3. `call_keywords`
  Stores detected keywords from calls for trend analysis.
  - `id` (uuid, primary key) - Unique keyword record identifier
  - `call_id` (uuid, foreign key) - Associated call
  - `keyword` (text) - Detected keyword
  - `frequency` (integer) - Occurrences in call
  - `created_at` (timestamptz) - Record creation timestamp

  ### 4. `metrics_summary`
  Stores pre-aggregated metrics for performance dashboard.
  - `id` (uuid, primary key) - Unique metrics record identifier
  - `agent_id` (uuid, foreign key) - Associated agent
  - `date` (date) - Metrics date
  - `total_calls` (integer) - Total calls for the day
  - `answered_calls` (integer) - Answered calls count
  - `spanish_calls` (integer) - Spanish language calls
  - `english_calls` (integer) - English language calls
  - `avg_duration_seconds` (numeric) - Average call duration
  - `avg_sentiment` (numeric) - Average sentiment score
  - `qualified_leads` (integer) - Number of qualified leads
  - `appointments_detected` (integer) - Calls with appointment intent
  - `crm_leads_created` (integer) - Successful CRM integrations
  - `created_at` (timestamptz) - Record creation timestamp

  ## Security
  - Enable RLS on all tables
  - Add policies for authenticated users to read data
  - Add policies for authenticated users to manage agents
  - Public read access for demo purposes (can be restricted later)

  ## Important Notes
  1. All tables use RLS for security
  2. Timestamps use timestamptz for timezone awareness
  3. Foreign key constraints ensure data integrity
  4. Indexes added for performance on frequently queried columns
*/

-- Create agents table
CREATE TABLE IF NOT EXISTS agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  voice_id text DEFAULT 'en-US-neural-1',
  voice_name text DEFAULT 'Professional Voice',
  system_prompt text DEFAULT 'You are a helpful AI assistant.',
  conversation_prompt text DEFAULT 'Engage professionally with callers.',
  tone text DEFAULT 'professional',
  response_style text DEFAULT 'adaptive',
  api_key text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create calls table
CREATE TABLE IF NOT EXISTS calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES agents(id) ON DELETE CASCADE,
  call_date timestamptz DEFAULT now(),
  duration_seconds integer DEFAULT 0,
  language text DEFAULT 'en',
  was_answered boolean DEFAULT false,
  sentiment_score numeric(3, 2) DEFAULT 0.0,
  summary text,
  summary_length integer DEFAULT 0,
  is_qualified_lead boolean DEFAULT false,
  has_appointment_intent boolean DEFAULT false,
  crm_lead_created boolean DEFAULT false,
  crm_sync_status text DEFAULT 'pending',
  transcript text,
  created_at timestamptz DEFAULT now()
);

-- Create call_keywords table
CREATE TABLE IF NOT EXISTS call_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid REFERENCES calls(id) ON DELETE CASCADE,
  keyword text NOT NULL,
  frequency integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- Create metrics_summary table
CREATE TABLE IF NOT EXISTS metrics_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES agents(id) ON DELETE CASCADE,
  date date NOT NULL,
  total_calls integer DEFAULT 0,
  answered_calls integer DEFAULT 0,
  spanish_calls integer DEFAULT 0,
  english_calls integer DEFAULT 0,
  avg_duration_seconds numeric(10, 2) DEFAULT 0.0,
  avg_sentiment numeric(3, 2) DEFAULT 0.0,
  qualified_leads integer DEFAULT 0,
  appointments_detected integer DEFAULT 0,
  crm_leads_created integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(agent_id, date)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_calls_agent_id ON calls(agent_id);
CREATE INDEX IF NOT EXISTS idx_calls_date ON calls(call_date);
CREATE INDEX IF NOT EXISTS idx_call_keywords_call_id ON call_keywords(call_id);
CREATE INDEX IF NOT EXISTS idx_metrics_summary_agent_date ON metrics_summary(agent_id, date);

-- Enable Row Level Security
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics_summary ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (demo mode)
-- In production, restrict to authenticated users only
CREATE POLICY "Allow public read access to agents"
  ON agents FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public read access to calls"
  ON calls FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public read access to call_keywords"
  ON call_keywords FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public read access to metrics_summary"
  ON metrics_summary FOR SELECT
  TO public
  USING (true);

-- Create policies for authenticated write access
CREATE POLICY "Allow authenticated users to insert agents"
  ON agents FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update agents"
  ON agents FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete agents"
  ON agents FOR DELETE
  TO authenticated
  USING (true);

-- Insert sample data for demonstration
INSERT INTO agents (name, voice_id, voice_name, system_prompt, conversation_prompt, tone, response_style, is_active)
VALUES 
  (
    'Sales Agent',
    'en-US-neural-pro-1',
    'Professional Female Voice',
    'You are a professional sales representative for a technology company. Your goal is to qualify leads, understand their needs, and schedule appointments.',
    'Start by greeting the caller warmly. Ask open-ended questions to understand their business needs. Listen for buying signals and appointment scheduling opportunities.',
    'professional',
    'adaptive',
    true
  ),
  (
    'Support Agent',
    'en-US-neural-casual-2',
    'Friendly Male Voice',
    'You are a helpful customer support agent. Your goal is to resolve customer issues quickly and professionally.',
    'Greet the customer and ask how you can help. Be empathetic and solution-focused. Summarize the resolution at the end.',
    'friendly',
    'detailed',
    true
  )
ON CONFLICT DO NOTHING;

-- Insert sample call data
INSERT INTO calls (agent_id, call_date, duration_seconds, language, was_answered, sentiment_score, summary, summary_length, is_qualified_lead, has_appointment_intent, crm_lead_created, crm_sync_status, transcript)
SELECT 
  a.id,
  now() - (random() * interval '30 days'),
  (random() * 600 + 60)::integer,
  CASE WHEN random() > 0.3 THEN 'en' ELSE 'es' END,
  random() > 0.2,
  (random() * 2 - 1)::numeric(3,2),
  'Customer called regarding product inquiry. Discussed features and pricing.',
  75,
  random() > 0.6,
  random() > 0.7,
  random() > 0.8,
  CASE WHEN random() > 0.9 THEN 'error' ELSE 'success' END,
  'Caller: Hi, I am interested in your services. Agent: Thank you for calling! I would be happy to help you...'
FROM agents a, generate_series(1, 100) g
ON CONFLICT DO NOTHING;