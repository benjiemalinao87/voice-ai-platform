-- Add OpenAI API key to user_settings table
ALTER TABLE user_settings ADD COLUMN openai_api_key TEXT;
