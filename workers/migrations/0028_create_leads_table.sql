-- Create Leads Table
-- Stores contact/lead information uploaded via CSV or webhook

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  firstname TEXT,
  lastname TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  lead_source TEXT,
  product TEXT,
  notes TEXT,
  status TEXT DEFAULT 'new',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_leads_workspace_id ON leads(workspace_id);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);

-- Lead Webhooks Table
-- Stores public webhook tokens for each workspace to receive leads from external systems

CREATE TABLE IF NOT EXISTS lead_webhooks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL UNIQUE,
  webhook_token TEXT NOT NULL UNIQUE,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lead_webhooks_workspace_id ON lead_webhooks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_lead_webhooks_token ON lead_webhooks(webhook_token);
