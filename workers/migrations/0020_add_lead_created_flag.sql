-- Migration: Add lead_created flag to Dynamics 365 sync logs
-- Description: Track when a new Lead was automatically created vs found existing contact
-- Date: 2025-11-11

-- Add column to track if a new Lead was created during sync
ALTER TABLE dynamics_sync_logs ADD COLUMN lead_created INTEGER DEFAULT 0;

-- 0 = existing Lead/Contact was found
-- 1 = new Lead was automatically created
