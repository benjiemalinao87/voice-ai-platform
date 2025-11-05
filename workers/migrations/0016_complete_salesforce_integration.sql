-- Migration: Complete Salesforce Integration Setup
-- Description: Adds missing salesforce_token_expires_at column and creates sync logs table
-- Date: 2025-11-05

-- ============================================
-- 1. Add missing salesforce_token_expires_at column
-- ============================================

-- Unix timestamp when access token expires
ALTER TABLE workspace_settings ADD COLUMN salesforce_token_expires_at INTEGER;

-- ============================================
-- 2. Create Salesforce sync logs table
-- ============================================

CREATE TABLE IF NOT EXISTS salesforce_sync_logs (
  -- Unique log entry ID
  id TEXT PRIMARY KEY,

  -- Which workspace this sync belongs to
  workspace_id TEXT NOT NULL,

  -- The call ID from our system
  call_id TEXT NOT NULL,

  -- The Salesforce Lead or Contact ID (e.g., 00Q... or 003...)
  salesforce_record_id TEXT,

  -- The Task ID created in Salesforce (e.g., 00T...)
  salesforce_task_id TEXT,

  -- The Event ID created in Salesforce if appointment was scheduled (e.g., 00U...)
  salesforce_event_id TEXT,

  -- Whether an appointment was created (0 = no, 1 = yes)
  appointment_created INTEGER DEFAULT 0,

  -- Sync status: 'success', 'error', 'skipped'
  status TEXT NOT NULL,

  -- Error message if sync failed
  error_message TEXT,

  -- The phone number that was searched
  phone_number TEXT,

  -- Unix timestamp when sync was attempted
  created_at INTEGER NOT NULL,

  -- Indexes for faster lookups
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Create index on workspace_id for faster queries by workspace
CREATE INDEX IF NOT EXISTS idx_salesforce_sync_logs_workspace_id ON salesforce_sync_logs(workspace_id);

-- Create index on call_id for faster lookups by call
CREATE INDEX IF NOT EXISTS idx_salesforce_sync_logs_call_id ON salesforce_sync_logs(call_id);

-- Create index on created_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_salesforce_sync_logs_created_at ON salesforce_sync_logs(created_at);

-- Create index on status for filtering by sync status
CREATE INDEX IF NOT EXISTS idx_salesforce_sync_logs_status ON salesforce_sync_logs(status);
