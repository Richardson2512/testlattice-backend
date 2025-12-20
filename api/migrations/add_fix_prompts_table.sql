-- Fix Prompts table
-- Stores AI-generated fix prompts for test runs
-- One prompt per test run (enforced by unique constraint)

CREATE TABLE IF NOT EXISTS fix_prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_run_id TEXT NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  model TEXT NOT NULL, -- AI model used to generate the prompt (e.g., 'gpt-4', 'claude-3')
  prompt TEXT NOT NULL, -- The generated fix prompt
  token_usage JSONB, -- {input_tokens: number, output_tokens: number, total_tokens: number}
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(test_run_id) -- Enforce one prompt per test run
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_fix_prompts_test_run_id ON fix_prompts(test_run_id);
CREATE INDEX IF NOT EXISTS idx_fix_prompts_user_id ON fix_prompts(user_id);

-- Add comment
COMMENT ON TABLE fix_prompts IS 'Stores AI-generated fix prompts for test runs. One prompt per test run.';

