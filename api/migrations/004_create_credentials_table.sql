-- Credentials table for storing test account credentials
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS credentials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    username TEXT,
    email TEXT,
    password_encrypted TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create index for faster lookups by user_id
CREATE INDEX IF NOT EXISTS idx_credentials_user_id ON credentials(user_id);

-- Enable Row Level Security
ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own credentials
CREATE POLICY "Users can view their own credentials"
    ON credentials FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own credentials"
    ON credentials FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own credentials"
    ON credentials FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own credentials"
    ON credentials FOR DELETE
    USING (auth.uid() = user_id);

-- Allow service role to bypass RLS (needed for API server)
CREATE POLICY "Service role has full access"
    ON credentials FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Update the updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER credentials_updated_at
    BEFORE UPDATE ON credentials
    FOR EACH ROW
    EXECUTE FUNCTION update_credentials_updated_at();
