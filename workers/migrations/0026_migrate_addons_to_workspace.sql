-- Migration: Migrate Addons to Workspace Level
-- Created: 2025-12-02
-- Description: Move addons from user-level to workspace-level so all workspace members share the same addon configuration

-- Create workspace_addons table (workspace-level addon configuration)
CREATE TABLE IF NOT EXISTS workspace_addons (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  addon_type TEXT NOT NULL,  -- 'enhanced_data', 'sentiment_analysis', 'embedding', etc.
  is_enabled INTEGER DEFAULT 0,  -- 1 = enabled, 0 = disabled
  settings TEXT,  -- JSON settings for the addon
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_addons_workspace_addon ON workspace_addons(workspace_id, addon_type);
CREATE INDEX IF NOT EXISTS idx_workspace_addons_workspace_id ON workspace_addons(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_addons_enabled ON workspace_addons(is_enabled);

-- Migrate existing user_addons to workspace_addons
-- Strategy: 
-- 1. First, migrate all owner's addons (preferred source of truth)
-- 2. Then, migrate member's addons only if owner doesn't have that addon type

-- Step 1: Migrate workspace owner's addons
INSERT INTO workspace_addons (id, workspace_id, addon_type, is_enabled, settings, created_at, updated_at)
SELECT 
  'wa_' || substr(hex(randomblob(16)), 1, 32) as id,
  w.id as workspace_id,
  ua.addon_type,
  ua.is_enabled,
  ua.settings,
  ua.created_at,
  ua.updated_at
FROM user_addons ua
JOIN workspaces w ON w.owner_user_id = ua.user_id
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_addons wa 
  WHERE wa.workspace_id = w.id 
  AND wa.addon_type = ua.addon_type
);

-- Step 2: Migrate member's addons only if owner doesn't have that addon type
INSERT INTO workspace_addons (id, workspace_id, addon_type, is_enabled, settings, created_at, updated_at)
SELECT 
  'wa_' || substr(hex(randomblob(16)), 1, 32) as id,
  wm.workspace_id,
  ua.addon_type,
  ua.is_enabled,
  ua.settings,
  ua.created_at,
  ua.updated_at
FROM user_addons ua
JOIN workspace_members wm ON wm.user_id = ua.user_id
WHERE wm.status = 'active'
AND NOT EXISTS (
  -- Owner doesn't have this addon type
  SELECT 1 FROM workspaces w
  JOIN user_addons owner_ua ON w.owner_user_id = owner_ua.user_id
  WHERE w.id = wm.workspace_id
  AND owner_ua.addon_type = ua.addon_type
)
AND NOT EXISTS (
  -- Workspace addon doesn't already exist
  SELECT 1 FROM workspace_addons wa 
  WHERE wa.workspace_id = wm.workspace_id 
  AND wa.addon_type = ua.addon_type
);

-- Note: user_addons table is kept for backward compatibility
-- It will be deprecated in a future migration after all code is updated

