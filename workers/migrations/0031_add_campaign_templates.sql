-- Add template columns to campaigns table for dynamic lead context
-- These templates support placeholders like {firstname}, {product}, {notes}, etc.

ALTER TABLE campaigns ADD COLUMN prompt_template TEXT;
ALTER TABLE campaigns ADD COLUMN first_message_template TEXT;
