-- Campaigns Table
-- Stores outbound calling campaigns that use VAPI to make AI-powered calls

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  assistant_id TEXT NOT NULL,
  phone_number_id TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  scheduled_at INTEGER,
  started_at INTEGER,
  completed_at INTEGER,
  total_leads INTEGER DEFAULT 0,
  calls_completed INTEGER DEFAULT 0,
  calls_answered INTEGER DEFAULT 0,
  calls_failed INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_campaigns_workspace_id ON campaigns(workspace_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled_at ON campaigns(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at DESC);

-- Campaign Leads Junction Table
-- Links leads to campaigns and tracks call status for each lead

CREATE TABLE IF NOT EXISTS campaign_leads (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  call_status TEXT DEFAULT 'pending',
  vapi_call_id TEXT,
  call_duration INTEGER,
  call_outcome TEXT,
  call_summary TEXT,
  called_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  UNIQUE(campaign_id, lead_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign_id ON campaign_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_lead_id ON campaign_leads(lead_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_call_status ON campaign_leads(call_status);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_vapi_call_id ON campaign_leads(vapi_call_id);
