-- Migration: Add selector_healing_memory table for self-healing persistence
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS selector_healing_memory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  page_signature TEXT NOT NULL, -- URL + DOM hash
  original_selector TEXT NOT NULL,
  healed_selector TEXT NOT NULL,
  success_count INTEGER DEFAULT 1,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, page_signature, original_selector, healed_selector)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_healing_memory_project_page ON selector_healing_memory(project_id, page_signature);
CREATE INDEX IF NOT EXISTS idx_healing_memory_original ON selector_healing_memory(project_id, original_selector);
CREATE INDEX IF NOT EXISTS idx_healing_memory_success_count ON selector_healing_memory(success_count DESC);

-- Enable RLS
ALTER TABLE selector_healing_memory ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access healing memory for their own projects
CREATE POLICY "Users can access healing memory for their projects"
  ON selector_healing_memory
  FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

