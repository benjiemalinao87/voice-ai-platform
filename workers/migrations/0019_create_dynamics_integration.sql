-- Migration: Microsoft Dynamics 365 Integration
-- Description: Adds Dynamics 365 OAuth columns to workspace_settings and creates sync logs table
-- Date: 2025-11-11

-- ============================================
-- 1. Add Dynamics 365 OAuth columns to workspace_settings
-- ============================================

-- Dynamics 365 instance URL (e.g., https://orgname.crm.dynamics.com)
ALTER TABLE workspace_settings ADD COLUMN dynamics_instance_url TEXT;

-- OAuth access token for Dynamics 365 API
ALTER TABLE workspace_settings ADD COLUMN dynamics_access_token TEXT;

-- OAuth refresh token for renewing access token
ALTER TABLE workspace_settings ADD COLUMN dynamics_refresh_token TEXT;

-- Unix timestamp when access token expires
ALTER TABLE workspace_settings ADD COLUMN dynamics_token_expires_at INTEGER;

-- ============================================
-- 2. Create Dynamics 365 sync logs table
-- ============================================

CREATE TABLE IF NOT EXISTS dynamics_sync_logs (
  -- Unique log entry ID
  id TEXT PRIMARY KEY,

  -- Which workspace this sync belongs to
  workspace_id TEXT NOT NULL,

  -- The call ID from our system
  call_id TEXT NOT NULL,

  -- The Dynamics 365 Lead or Contact ID (GUID)
  dynamics_record_id TEXT,

  -- The Phone Call activity ID created in Dynamics 365 (GUID)
  dynamics_activity_id TEXT,

  -- The Appointment activity ID created in Dynamics 365 if appointment was scheduled (GUID)
  dynamics_appointment_id TEXT,

  -- Whether an appointment was created (0 = no, 1 = yes)
  appointment_created INTEGER DEFAULT 0,

  -- Sync status: 'success', 'error', 'skipped'
  status TEXT NOT NULL CHECK(status IN ('success', 'error', 'skipped')),

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
CREATE INDEX IF NOT EXISTS idx_dynamics_sync_logs_workspace_id ON dynamics_sync_logs(workspace_id);

-- Create index on call_id for faster lookups by call
CREATE INDEX IF NOT EXISTS idx_dynamics_sync_logs_call_id ON dynamics_sync_logs(call_id);

-- Create index on created_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_dynamics_sync_logs_created_at ON dynamics_sync_logs(created_at);

-- Create index on status for filtering by sync status
CREATE INDEX IF NOT EXISTS idx_dynamics_sync_logs_status ON dynamics_sync_logs(status);
