-- Migration: HubSpot Integration
-- Created: 2025-01-07
-- Description: Add tables for HubSpot OAuth tokens and sync logs

-- HubSpot OAuth tokens table
CREATE TABLE IF NOT EXISTS hubspot_oauth_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(user_id, workspace_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_hubspot_tokens_user_workspace ON hubspot_oauth_tokens(user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_hubspot_tokens_expires ON hubspot_oauth_tokens(expires_at);

-- HubSpot sync logs table
CREATE TABLE IF NOT EXISTS hubspot_sync_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    call_id TEXT NOT NULL,
    contact_id TEXT,
    engagement_id TEXT,
    status TEXT NOT NULL CHECK(status IN ('success', 'error', 'skipped')),
    error_message TEXT,
    phone_number TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_hubspot_sync_user_workspace ON hubspot_sync_logs(user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_hubspot_sync_call ON hubspot_sync_logs(call_id);
CREATE INDEX IF NOT EXISTS idx_hubspot_sync_status ON hubspot_sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_hubspot_sync_created ON hubspot_sync_logs(created_at DESC);
