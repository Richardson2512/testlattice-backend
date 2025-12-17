-- Migration: Add Interaction Knowledge Base table for God Mode Memory
-- Run this in your Supabase SQL Editor

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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_interaction_kb_project_id ON interaction_knowledge_base(project_id);
CREATE INDEX IF NOT EXISTS idx_interaction_kb_component_hash ON interaction_knowledge_base(component_hash);
CREATE INDEX IF NOT EXISTS idx_interaction_kb_reliability ON interaction_knowledge_base(reliability_score DESC);

-- Enable Row Level Security
ALTER TABLE interaction_knowledge_base ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role full access on interaction_knowledge_base" ON interaction_knowledge_base;
DROP POLICY IF EXISTS "Users can view own interaction knowledge" ON interaction_knowledge_base;
DROP POLICY IF EXISTS "Users can create own interaction knowledge" ON interaction_knowledge_base;

-- Service role full access
CREATE POLICY "Service role full access on interaction_knowledge_base" ON interaction_knowledge_base
  FOR ALL USING (auth.role() = 'service_role');

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

