-- Add CustomerConnect integration settings to workspace_settings
-- These settings enable automatic customer lookup during VAPI calls

ALTER TABLE workspace_settings ADD COLUMN customerconnect_workspace_id TEXT;
ALTER TABLE workspace_settings ADD COLUMN customerconnect_api_key TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_workspace_settings_customerconnect ON workspace_settings(customerconnect_workspace_id);

