-- Create workspace_invitations table for pending team member invitations
-- This allows inviting users who don't have accounts yet

CREATE TABLE IF NOT EXISTS workspace_invitations (
  id TEXT PRIMARY KEY,                    -- Invitation ID (e.g., inv_abc123)
  workspace_id TEXT NOT NULL,             -- Workspace being invited to
  email TEXT NOT NULL,                    -- Email of invitee
  role TEXT NOT NULL DEFAULT 'member',    -- Role: 'member' or 'admin'
  status TEXT NOT NULL DEFAULT 'pending', -- Status: 'pending', 'accepted', 'expired', 'cancelled'
  invited_by_user_id TEXT NOT NULL,       -- User who sent the invitation
  token TEXT NOT NULL UNIQUE,             -- Unique token for invitation link
  expires_at INTEGER NOT NULL,            -- When invitation expires
  created_at INTEGER NOT NULL,            -- When invitation was created
  accepted_at INTEGER,                    -- When invitation was accepted (if accepted)
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_by_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_workspace_id ON workspace_invitations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_email ON workspace_invitations(email);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_token ON workspace_invitations(token);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_status ON workspace_invitations(status);

-- Ensure workspace tables exist
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS workspace_members (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',    -- 'owner', 'admin', 'member'
  status TEXT NOT NULL DEFAULT 'active',  -- 'active', 'pending', 'inactive'
  invited_by_user_id TEXT,
  invited_at INTEGER,
  joined_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_status ON workspace_members(status);
