/*
  # Agent Knowledge Base Files Table
  
  ## Overview
  Tracks files uploaded to VAPI's Knowledge Base for each agent.
  Files are stored in VAPI's cloud, but we maintain references for UI display.

  ## New Table
  
  ### `agent_knowledge_files`
  Stores references to knowledge base files uploaded to VAPI.
  - `id` (uuid, primary key) - Database record identifier
  - `agent_id` (uuid, foreign key) - Associated agent
  - `vapi_file_id` (text) - VAPI's file identifier
  - `file_name` (text) - Original filename
  - `file_size` (integer) - File size in bytes
  - `status` (text) - Upload status (uploading/processing/ready/error)
  - `created_at` (timestamptz) - Upload timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ## Security
  - Enable RLS
  - Allow public read access
  - Allow authenticated users to manage files
*/

-- Create agent_knowledge_files table
CREATE TABLE IF NOT EXISTS agent_knowledge_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES agents(id) ON DELETE CASCADE,
  vapi_file_id text NOT NULL,
  file_name text NOT NULL,
  file_size integer DEFAULT 0,
  status text DEFAULT 'ready',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(vapi_file_id)
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_files_agent_id ON agent_knowledge_files(agent_id);

-- Enable Row Level Security
ALTER TABLE agent_knowledge_files ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Allow public read access to agent_knowledge_files"
  ON agent_knowledge_files FOR SELECT
  TO public
  USING (true);

-- Create policies for authenticated write access
CREATE POLICY "Allow authenticated users to insert agent_knowledge_files"
  ON agent_knowledge_files FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update agent_knowledge_files"
  ON agent_knowledge_files FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete agent_knowledge_files"
  ON agent_knowledge_files FOR DELETE
  TO authenticated
  USING (true);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_agent_knowledge_files_updated_at
  BEFORE UPDATE ON agent_knowledge_files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

