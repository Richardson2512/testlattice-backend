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
  name TEXT, -- Custom name for the test run
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

-- Interaction Knowledge Base table (God Mode Memory)
-- Stores learned actions from user interventions
CREATE TABLE IF NOT EXISTS interaction_knowledge_base (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  component_hash TEXT NOT NULL, -- sha256(dom_fragment) - identifies component
  user_action JSONB NOT NULL, -- {action, selector, value, description}
  pre_condition JSONB, -- {overlay_detected: true, step_failed: true, etc.}
  reliability_score FLOAT DEFAULT 1.0, -- Human verified = 1.0, AI-generated < 1.0
  visual_anchor TEXT, -- Screenshot fragment (base64) or URL
  functional_anchor TEXT, -- Text/ARIA label (e.g., "Dismiss", "Next")
  structural_anchor TEXT, -- DOM path (e.g., "#nav-bar > div.profile")
  dom_snapshot_before TEXT, -- Full DOM before action
  dom_snapshot_after TEXT, -- Full DOM after action
  run_id TEXT REFERENCES test_runs(id) ON DELETE SET NULL, -- Original run where learned
  step_id TEXT, -- Step where intervention occurred
  usage_count INTEGER DEFAULT 0, -- How many times this heuristic was used
  success_count INTEGER DEFAULT 0, -- How many times it succeeded
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, component_hash)
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
CREATE INDEX IF NOT EXISTS idx_interaction_kb_project_id ON interaction_knowledge_base(project_id);
CREATE INDEX IF NOT EXISTS idx_interaction_kb_component_hash ON interaction_knowledge_base(component_hash);
CREATE INDEX IF NOT EXISTS idx_interaction_kb_reliability ON interaction_knowledge_base(reliability_score DESC);

-- Enable Row Level Security (RLS) - adjust policies as needed
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE interaction_knowledge_base ENABLE ROW LEVEL SECURITY;

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
DROP POLICY IF EXISTS "Service role full access on interaction_knowledge_base" ON interaction_knowledge_base;
DROP POLICY IF EXISTS "Users can view own interaction knowledge" ON interaction_knowledge_base;
DROP POLICY IF EXISTS "Users can create own interaction knowledge" ON interaction_knowledge_base;

-- Allow service role full access (for API server)
CREATE POLICY "Service role full access on projects" ON projects
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on test_runs" ON test_runs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on test_artifacts" ON test_artifacts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on interaction_knowledge_base" ON interaction_knowledge_base
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

-- Users can view interaction knowledge for their own projects
CREATE POLICY "Users can view own interaction knowledge" ON interaction_knowledge_base
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = interaction_knowledge_base.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Users can create interaction knowledge for their own projects
CREATE POLICY "Users can create own interaction knowledge" ON interaction_knowledge_base
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = interaction_knowledge_base.project_id
      AND projects.user_id = auth.uid()
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

