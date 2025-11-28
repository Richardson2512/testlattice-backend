-- TestLattice Database Schema for Supabase
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Note: User authentication is handled by Supabase Auth
-- Users table is automatically created by Supabase Auth
-- You can access user data via auth.users or create a profiles table

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  team_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Link to authenticated user
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Test Runs table
CREATE TABLE IF NOT EXISTS test_runs (
  id TEXT PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Link to authenticated user
  status TEXT NOT NULL CHECK (status IN ('pending', 'queued', 'diagnosing', 'waiting_approval', 'running', 'completed', 'failed', 'cancelled')),
  build JSONB NOT NULL,
  profile JSONB NOT NULL,
  options JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration INTEGER, -- Duration in seconds
  error TEXT,
  report_url TEXT,
  artifacts_url TEXT,
  trace_url TEXT, -- Fallback for trace URL if artifact save fails
  stream_url TEXT, -- WebRTC/live streaming URL for real-time test viewing
  steps JSONB, -- Array of test steps
  diagnosis JSONB,
  diagnosis_progress JSONB, -- Real-time diagnosis progress tracking
  paused BOOLEAN DEFAULT FALSE, -- Pause/resume support
  current_step INTEGER DEFAULT 0, -- Current step number for pause/resume
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Test Artifacts table
CREATE TABLE IF NOT EXISTS test_artifacts (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('screenshot', 'video', 'log', 'dom', 'network', 'trace')),
  url TEXT NOT NULL,
  path TEXT NOT NULL,
  size BIGINT NOT NULL, -- Size in bytes
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_test_runs_project_id ON test_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_user_id ON test_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_status ON test_runs(status);
CREATE INDEX IF NOT EXISTS idx_test_runs_created_at ON test_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_artifacts_run_id ON test_artifacts(run_id);
CREATE INDEX IF NOT EXISTS idx_projects_team_id ON projects(team_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_paused ON test_runs(paused) WHERE paused = TRUE;

-- Enable Row Level Security (RLS) - adjust policies as needed
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_artifacts ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust based on your auth requirements)
-- Drop existing policies if they exist (to allow re-running this script)
DROP POLICY IF EXISTS "Service role full access on projects" ON projects;
DROP POLICY IF EXISTS "Service role full access on test_runs" ON test_runs;
DROP POLICY IF EXISTS "Service role full access on test_artifacts" ON test_artifacts;
DROP POLICY IF EXISTS "Users can view own projects" ON projects;
DROP POLICY IF EXISTS "Users can create own projects" ON projects;
DROP POLICY IF EXISTS "Users can view own test runs" ON test_runs;
DROP POLICY IF EXISTS "Users can create own test runs" ON test_runs;
DROP POLICY IF EXISTS "Users can view own artifacts" ON test_artifacts;

-- Allow service role full access (for API server)
CREATE POLICY "Service role full access on projects" ON projects
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on test_runs" ON test_runs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on test_artifacts" ON test_artifacts
  FOR ALL USING (auth.role() = 'service_role');

-- User policies (for direct database access via Supabase client)
-- Users can view their own projects
CREATE POLICY "Users can view own projects" ON projects
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own projects
CREATE POLICY "Users can create own projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can view their own test runs
CREATE POLICY "Users can view own test runs" ON test_runs
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own test runs
CREATE POLICY "Users can create own test runs" ON test_runs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can view artifacts for their own test runs
CREATE POLICY "Users can view own artifacts" ON test_artifacts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM test_runs
      WHERE test_runs.id = test_artifacts.run_id
      AND test_runs.user_id = auth.uid()
    )
  );

-- Create storage bucket for artifacts
INSERT INTO storage.buckets (id, name, public)
VALUES ('artifacts', 'artifacts', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for artifacts bucket
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public read access on artifacts" ON storage.objects;
DROP POLICY IF EXISTS "Service role upload access on artifacts" ON storage.objects;
DROP POLICY IF EXISTS "Service role update access on artifacts" ON storage.objects;
DROP POLICY IF EXISTS "Service role delete access on artifacts" ON storage.objects;

CREATE POLICY "Public read access on artifacts" ON storage.objects
  FOR SELECT USING (bucket_id = 'artifacts');

CREATE POLICY "Service role upload access on artifacts" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'artifacts' AND auth.role() = 'service_role');

CREATE POLICY "Service role update access on artifacts" ON storage.objects
  FOR UPDATE USING (bucket_id = 'artifacts' AND auth.role() = 'service_role');

CREATE POLICY "Service role delete access on artifacts" ON storage.objects
  FOR DELETE USING (bucket_id = 'artifacts' AND auth.role() = 'service_role');

