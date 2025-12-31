-- ============================================================================
-- Rihario Master Database Schema for Supabase
-- ============================================================================
-- Single consolidated schema file for Supabase deployment
-- Run this in your Supabase SQL Editor
-- 
-- This file is idempotent - safe to run multiple times
-- Last updated: 2025-12-27
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Projects table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  team_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Test Runs table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS test_runs (
  id TEXT PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'queued', 'diagnosing', 'waiting_approval', 'running', 'completed', 'failed', 'cancelled')),
  build JSONB NOT NULL,
  profile JSONB NOT NULL,
  options JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration INTEGER,
  error TEXT,
  name TEXT,
  report_url TEXT,
  artifacts_url TEXT,
  trace_url TEXT,
  stream_url TEXT,
  steps JSONB,
  diagnosis JSONB,
  diagnosis_progress JSONB,
  paused BOOLEAN DEFAULT FALSE,
  current_step INTEGER DEFAULT 0,
  guest_session_id TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add columns if they don't exist (for existing deployments)
ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS trace_url TEXT;
ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS stream_url TEXT;
ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS diagnosis JSONB;
ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS diagnosis_progress JSONB;
ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS paused BOOLEAN DEFAULT FALSE;
ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS current_step INTEGER DEFAULT 0;
ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS guest_session_id TEXT;
ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- ----------------------------------------------------------------------------
-- Test Artifacts table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS test_artifacts (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('screenshot', 'video', 'log', 'dom', 'network', 'trace')),
  url TEXT NOT NULL,
  path TEXT NOT NULL,
  size BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Interaction Knowledge Base table (God Mode Memory)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS interaction_knowledge_base (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  component_hash TEXT NOT NULL,
  user_action JSONB NOT NULL,
  pre_condition JSONB,
  reliability_score FLOAT DEFAULT 1.0,
  visual_anchor TEXT,
  functional_anchor TEXT,
  structural_anchor TEXT,
  dom_snapshot_before TEXT,
  dom_snapshot_after TEXT,
  run_id TEXT REFERENCES test_runs(id) ON DELETE SET NULL,
  step_id TEXT,
  usage_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, component_hash)
);

-- ----------------------------------------------------------------------------
-- Selector Healing Memory table (Self-Healing)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS selector_healing_memory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  page_signature TEXT NOT NULL,
  original_selector TEXT NOT NULL,
  healed_selector TEXT NOT NULL,
  success_count INTEGER DEFAULT 1,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, page_signature, original_selector, healed_selector)
);

-- ----------------------------------------------------------------------------
-- Fix Prompts table (AI-generated fix suggestions)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fix_prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_run_id TEXT NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  prompt TEXT NOT NULL,
  token_usage JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(test_run_id)
);

-- ----------------------------------------------------------------------------
-- User Subscriptions table (Polar Integration)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'starter', 'indie', 'pro')),
  polar_customer_id TEXT,
  polar_subscription_id TEXT,
  polar_product_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'cancelled', 'expired')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  tests_used_this_month INTEGER DEFAULT 0,
  visual_tests_used_this_month INTEGER DEFAULT 0,
  usage_reset_date TIMESTAMPTZ DEFAULT (date_trunc('month', NOW()) + INTERVAL '1 month'),
  addon_visual_tests INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Projects indexes
CREATE INDEX IF NOT EXISTS idx_projects_team_id ON projects(team_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

-- Test runs indexes
CREATE INDEX IF NOT EXISTS idx_test_runs_project_id ON test_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_user_id ON test_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_status ON test_runs(status);
CREATE INDEX IF NOT EXISTS idx_test_runs_created_at ON test_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_runs_paused ON test_runs(paused) WHERE paused = TRUE;
CREATE INDEX IF NOT EXISTS idx_test_runs_guest_session_id ON test_runs(guest_session_id) WHERE guest_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_test_runs_expires_at ON test_runs(expires_at) WHERE expires_at IS NOT NULL;

-- Test artifacts indexes
CREATE INDEX IF NOT EXISTS idx_test_artifacts_run_id ON test_artifacts(run_id);

-- Interaction knowledge base indexes
CREATE INDEX IF NOT EXISTS idx_interaction_kb_project_id ON interaction_knowledge_base(project_id);
CREATE INDEX IF NOT EXISTS idx_interaction_kb_component_hash ON interaction_knowledge_base(component_hash);
CREATE INDEX IF NOT EXISTS idx_interaction_kb_reliability ON interaction_knowledge_base(reliability_score DESC);

-- Selector healing memory indexes
CREATE INDEX IF NOT EXISTS idx_healing_memory_project_page ON selector_healing_memory(project_id, page_signature);
CREATE INDEX IF NOT EXISTS idx_healing_memory_original ON selector_healing_memory(project_id, original_selector);
CREATE INDEX IF NOT EXISTS idx_healing_memory_success_count ON selector_healing_memory(success_count DESC);

-- Fix prompts indexes
CREATE INDEX IF NOT EXISTS idx_fix_prompts_test_run_id ON fix_prompts(test_run_id);
CREATE INDEX IF NOT EXISTS idx_fix_prompts_user_id ON fix_prompts(user_id);

-- User subscriptions indexes
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_polar_customer_id ON user_subscriptions(polar_customer_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_polar_subscription_id ON user_subscriptions(polar_subscription_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_tier ON user_subscriptions(tier);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE interaction_knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE selector_healing_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE fix_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Drop existing policies (for idempotent re-runs)
DROP POLICY IF EXISTS "Service role full access on projects" ON projects;
DROP POLICY IF EXISTS "Service role full access on test_runs" ON test_runs;
DROP POLICY IF EXISTS "Service role full access on test_artifacts" ON test_artifacts;
DROP POLICY IF EXISTS "Service role full access on interaction_knowledge_base" ON interaction_knowledge_base;
DROP POLICY IF EXISTS "Service role full access on selector_healing_memory" ON selector_healing_memory;
DROP POLICY IF EXISTS "Service role full access on fix_prompts" ON fix_prompts;
DROP POLICY IF EXISTS "Service role full access on user_subscriptions" ON user_subscriptions;

DROP POLICY IF EXISTS "Users can view own projects" ON projects;
DROP POLICY IF EXISTS "Users can create own projects" ON projects;
DROP POLICY IF EXISTS "Users can view own test runs" ON test_runs;
DROP POLICY IF EXISTS "Users can create own test runs" ON test_runs;
DROP POLICY IF EXISTS "Users can view own artifacts" ON test_artifacts;
DROP POLICY IF EXISTS "Users can view own interaction knowledge" ON interaction_knowledge_base;
DROP POLICY IF EXISTS "Users can create own interaction knowledge" ON interaction_knowledge_base;
DROP POLICY IF EXISTS "Users can access healing memory for their projects" ON selector_healing_memory;
DROP POLICY IF EXISTS "Users can view own subscription" ON user_subscriptions;

-- ----------------------------------------------------------------------------
-- Service Role Policies (API Server access)
-- ----------------------------------------------------------------------------
CREATE POLICY "Service role full access on projects" ON projects
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on test_runs" ON test_runs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on test_artifacts" ON test_artifacts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on interaction_knowledge_base" ON interaction_knowledge_base
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on selector_healing_memory" ON selector_healing_memory
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on fix_prompts" ON fix_prompts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on user_subscriptions" ON user_subscriptions
  FOR ALL USING (auth.role() = 'service_role');

-- ----------------------------------------------------------------------------
-- User Policies (Direct Supabase client access)
-- ----------------------------------------------------------------------------

-- Projects policies
CREATE POLICY "Users can view own projects" ON projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Test runs policies
CREATE POLICY "Users can view own test runs" ON test_runs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own test runs" ON test_runs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Test artifacts policies
CREATE POLICY "Users can view own artifacts" ON test_artifacts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM test_runs
      WHERE test_runs.id = test_artifacts.run_id
      AND test_runs.user_id = auth.uid()
    )
  );

-- Interaction knowledge base policies
CREATE POLICY "Users can view own interaction knowledge" ON interaction_knowledge_base
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = interaction_knowledge_base.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own interaction knowledge" ON interaction_knowledge_base
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = interaction_knowledge_base.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Selector healing memory policies
CREATE POLICY "Users can access healing memory for their projects" ON selector_healing_memory
  FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- User subscriptions policies
CREATE POLICY "Users can view own subscription" ON user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to auto-create subscription record for new users
CREATE OR REPLACE FUNCTION create_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_subscriptions (user_id, tier, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't block user creation
  RAISE WARNING 'Failed to create subscription for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset monthly usage
CREATE OR REPLACE FUNCTION reset_monthly_usage()
RETURNS void AS $$
BEGIN
  UPDATE user_subscriptions
  SET 
    tests_used_this_month = 0,
    visual_tests_used_this_month = 0,
    addon_visual_tests = 0,
    usage_reset_date = date_trunc('month', NOW()) + INTERVAL '1 month'
  WHERE usage_reset_date <= NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to atomically increment test usage (prevents race conditions)
CREATE OR REPLACE FUNCTION increment_test_usage(p_user_id UUID)
RETURNS TABLE(new_count INTEGER, tier TEXT) AS $$
DECLARE
  v_new_count INTEGER;
  v_tier TEXT;
BEGIN
  UPDATE user_subscriptions 
  SET tests_used_this_month = tests_used_this_month + 1,
      updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING tests_used_this_month, user_subscriptions.tier INTO v_new_count, v_tier;
  
  RETURN QUERY SELECT v_new_count, v_tier;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to atomically increment visual test usage
CREATE OR REPLACE FUNCTION increment_visual_test_usage(p_user_id UUID)
RETURNS TABLE(new_count INTEGER, tier TEXT) AS $$
DECLARE
  v_new_count INTEGER;
  v_tier TEXT;
BEGIN
  UPDATE user_subscriptions 
  SET visual_tests_used_this_month = visual_tests_used_this_month + 1,
      updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING visual_tests_used_this_month, user_subscriptions.tier INTO v_new_count, v_tier;
  
  RETURN QUERY SELECT v_new_count, v_tier;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can run a test (returns remaining tests)
CREATE OR REPLACE FUNCTION check_usage_limit(p_user_id UUID)
RETURNS TABLE(can_run BOOLEAN, tests_used INTEGER, tests_limit INTEGER, tier TEXT) AS $$
DECLARE
  v_tier TEXT;
  v_tests_used INTEGER;
  v_limit INTEGER;
BEGIN
  SELECT us.tier, us.tests_used_this_month 
  INTO v_tier, v_tests_used
  FROM user_subscriptions us
  WHERE us.user_id = p_user_id;
  
  -- Set limits based on tier (matches pricing.ts)
  v_limit := CASE v_tier
    WHEN 'free' THEN 3
    WHEN 'starter' THEN 100
    WHEN 'indie' THEN 300
    WHEN 'pro' THEN 750
    ELSE 3 -- Default to free limits
  END;
  
  RETURN QUERY SELECT (v_tests_used < v_limit), v_tests_used, v_limit, v_tier;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TOKEN USAGE TRACKING TABLE (Admin Analytics)
-- ============================================================================

-- Token usage tracking per test run for cost monitoring
CREATE TABLE IF NOT EXISTS token_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_run_id TEXT NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
  test_mode TEXT,  -- 'single', 'multi', 'all', 'monkey', 'guest', 'behavior'
  model TEXT NOT NULL DEFAULT 'gpt-5-mini',  -- 'gpt-5-mini', 'gpt-4o', etc.
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  api_calls INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd DECIMAL(10, 6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Token usage indexes
CREATE INDEX IF NOT EXISTS idx_token_usage_test_run_id ON token_usage(test_run_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_test_mode ON token_usage(test_mode);
CREATE INDEX IF NOT EXISTS idx_token_usage_model ON token_usage(model);
CREATE INDEX IF NOT EXISTS idx_token_usage_created_at ON token_usage(created_at DESC);

-- Token usage RLS
ALTER TABLE token_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on token_usage" ON token_usage;
CREATE POLICY "Service role full access on token_usage" ON token_usage
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger to create subscription on new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_subscription();

-- ============================================================================
-- NOTES
-- ============================================================================
-- 
-- Artifact Storage:
--   Artifacts (screenshots, videos, traces) are stored in Wasabi S3
--   See: worker/src/services/wasabiStorage.ts
--   NOT using Supabase Storage
--
-- Authentication:
--   Handled by Supabase Auth (auth.users table)
--
-- Payments:
--   Integrated with Polar via user_subscriptions table
--
-- ============================================================================
