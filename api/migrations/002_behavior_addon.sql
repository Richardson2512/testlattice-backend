-- ============================================================================
-- Behavior Test Add-on Schema Migration
-- ============================================================================
-- Adds support for Behavior Analysis as a CREDITS-BASED add-on
-- $20 for 20 behavior test credits - can be purchased multiple times
-- Polar Product ID: fd537924-bd3a-43e1-8668-4bd8334fa60b
-- 
-- This file is idempotent - safe to run multiple times
-- Date: 2026-01-17
-- ============================================================================

-- ============================================================================
-- ADD BEHAVIOR CREDITS COLUMNS TO USER_SUBSCRIPTIONS
-- ============================================================================

-- Track behavior test credits (purchased, not monthly)
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS behavior_credits INTEGER DEFAULT 0;

-- Track total behavior tests used (lifetime, for analytics)
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS behavior_tests_used_total INTEGER DEFAULT 0;

-- ============================================================================
-- BEHAVIOR ANALYSIS RUNS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS behavior_analysis_runs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  start_url TEXT NOT NULL,
  behaviors TEXT[] NOT NULL DEFAULT '{}',  -- e.g. ['bias', 'compliance', 'safety']
  
  -- Results
  results JSONB,  -- Stores simulation results, scores, transcripts
  overall_score DECIMAL(5, 2),  -- 0-100 score
  
  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration INTEGER,  -- in milliseconds
  
  -- Error handling
  error TEXT,
  
  -- Credits consumed
  credits_used INTEGER DEFAULT 1,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for behavior_analysis_runs
CREATE INDEX IF NOT EXISTS idx_behavior_runs_project_id ON behavior_analysis_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_behavior_runs_user_id ON behavior_analysis_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_behavior_runs_status ON behavior_analysis_runs(status);
CREATE INDEX IF NOT EXISTS idx_behavior_runs_created_at ON behavior_analysis_runs(created_at DESC);

-- RLS for behavior_analysis_runs
ALTER TABLE behavior_analysis_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on behavior_analysis_runs" ON behavior_analysis_runs;
CREATE POLICY "Service role full access on behavior_analysis_runs" ON behavior_analysis_runs
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can view own behavior runs" ON behavior_analysis_runs;
CREATE POLICY "Users can view own behavior runs" ON behavior_analysis_runs
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own behavior runs" ON behavior_analysis_runs;
CREATE POLICY "Users can create own behavior runs" ON behavior_analysis_runs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- BEHAVIOR ANALYSIS SIMULATIONS TABLE (Child of runs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS behavior_simulations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id TEXT REFERENCES behavior_analysis_runs(id) ON DELETE CASCADE,
  persona TEXT NOT NULL CHECK (persona IN ('aggressive', 'naive', 'sneaky', 'confused', 'persistent')),
  behavior TEXT NOT NULL,  -- e.g. 'bias', 'compliance'
  
  -- Conversation transcript
  transcript JSONB NOT NULL DEFAULT '[]',  -- Array of {role: 'actor'|'chatbot', message: string}
  turn_count INTEGER DEFAULT 0,
  
  -- Judge scoring
  score DECIMAL(5, 2),  -- 0-100
  passed BOOLEAN,
  summary TEXT,
  justification TEXT,
  
  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for behavior_simulations
CREATE INDEX IF NOT EXISTS idx_behavior_sims_run_id ON behavior_simulations(run_id);
CREATE INDEX IF NOT EXISTS idx_behavior_sims_persona ON behavior_simulations(persona);
CREATE INDEX IF NOT EXISTS idx_behavior_sims_behavior ON behavior_simulations(behavior);

-- RLS for behavior_simulations
ALTER TABLE behavior_simulations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on behavior_simulations" ON behavior_simulations;
CREATE POLICY "Service role full access on behavior_simulations" ON behavior_simulations
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can view simulations from own runs" ON behavior_simulations;
CREATE POLICY "Users can view simulations from own runs" ON behavior_simulations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM behavior_analysis_runs
      WHERE behavior_analysis_runs.id = behavior_simulations.run_id
      AND behavior_analysis_runs.user_id = auth.uid()
    )
  );

-- ============================================================================
-- BEHAVIOR CREDIT PURCHASE HISTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS behavior_credit_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  credits_purchased INTEGER NOT NULL DEFAULT 20,
  amount_paid DECIMAL(10, 2) NOT NULL DEFAULT 20.00,
  polar_checkout_id TEXT,
  polar_product_id TEXT DEFAULT 'fd537924-bd3a-43e1-8668-4bd8334fa60b',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_behavior_purchases_user_id ON behavior_credit_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_behavior_purchases_created_at ON behavior_credit_purchases(created_at DESC);

ALTER TABLE behavior_credit_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on behavior_credit_purchases" ON behavior_credit_purchases;
CREATE POLICY "Service role full access on behavior_credit_purchases" ON behavior_credit_purchases
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can view own purchases" ON behavior_credit_purchases;
CREATE POLICY "Users can view own purchases" ON behavior_credit_purchases
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to check if user can run a behavior test (has credits)
CREATE OR REPLACE FUNCTION check_behavior_credits(p_user_id UUID)
RETURNS TABLE(
  can_run BOOLEAN, 
  tier TEXT, 
  credits_remaining INTEGER
) AS $$
DECLARE
  v_tier TEXT;
  v_credits INTEGER;
BEGIN
  SELECT us.tier, us.behavior_credits
  INTO v_tier, v_credits
  FROM user_subscriptions us
  WHERE us.user_id = p_user_id;
  
  -- Only Indie and Pro tiers can purchase behavior credits
  IF v_tier NOT IN ('indie', 'pro') THEN
    RETURN QUERY SELECT FALSE, v_tier, 0;
    RETURN;
  END IF;
  
  -- Check if user has credits
  RETURN QUERY SELECT (v_credits > 0), v_tier, v_credits;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to consume behavior test credit
CREATE OR REPLACE FUNCTION consume_behavior_credit(p_user_id UUID)
RETURNS TABLE(success BOOLEAN, credits_remaining INTEGER) AS $$
DECLARE
  v_credits INTEGER;
BEGIN
  -- Atomically decrement credits
  UPDATE user_subscriptions 
  SET behavior_credits = behavior_credits - 1,
      behavior_tests_used_total = behavior_tests_used_total + 1,
      updated_at = NOW()
  WHERE user_id = p_user_id
    AND behavior_credits > 0
  RETURNING behavior_credits INTO v_credits;
  
  IF v_credits IS NULL THEN
    RETURN QUERY SELECT FALSE, 0;
  ELSE
    RETURN QUERY SELECT TRUE, v_credits;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add behavior credits after purchase
CREATE OR REPLACE FUNCTION add_behavior_credits(
  p_user_id UUID,
  p_credits INTEGER DEFAULT 20,
  p_polar_checkout_id TEXT DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, new_balance INTEGER) AS $$
DECLARE
  v_tier TEXT;
  v_new_balance INTEGER;
BEGIN
  -- Check tier eligibility
  SELECT tier INTO v_tier FROM user_subscriptions WHERE user_id = p_user_id;
  
  IF v_tier NOT IN ('indie', 'pro') THEN
    RAISE EXCEPTION 'Behavior credits are only available for Indie and Pro tiers';
  END IF;
  
  -- Add credits
  UPDATE user_subscriptions
  SET behavior_credits = behavior_credits + p_credits,
      updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING behavior_credits INTO v_new_balance;
  
  -- Record purchase
  INSERT INTO behavior_credit_purchases (user_id, credits_purchased, polar_checkout_id)
  VALUES (p_user_id, p_credits, p_polar_checkout_id);
  
  RETURN QUERY SELECT TRUE, v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE behavior_analysis_runs IS 'Stores behavior test runs - uses credits purchased by Indie/Pro users';
COMMENT ON TABLE behavior_simulations IS 'Stores individual persona simulations within a behavior run';
COMMENT ON TABLE behavior_credit_purchases IS 'History of behavior credit purchases ($20 for 20 credits)';
COMMENT ON COLUMN user_subscriptions.behavior_credits IS 'Current behavior test credits balance';
COMMENT ON COLUMN user_subscriptions.behavior_tests_used_total IS 'Total behavior tests consumed (lifetime)';
