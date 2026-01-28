-- Update check_usage_limit to dynamically count non-cancelled tests
-- This replaces the counter-based approach with a query-based approach for accuracy

CREATE OR REPLACE FUNCTION check_usage_limit(p_user_id UUID)
RETURNS TABLE(can_run BOOLEAN, tests_used INTEGER, tests_limit INTEGER, tier TEXT) AS $$
DECLARE
  v_tier TEXT;
  v_tests_used INTEGER;
  v_limit INTEGER;
BEGIN
  -- Get user tier
  SELECT tier INTO v_tier
  FROM user_subscriptions
  WHERE user_id = p_user_id;

  -- Count actual non-cancelled tests from this month
  -- We include completed, failed, and active tests. We EXCLUDE cancelled.
  SELECT COUNT(*) INTO v_tests_used
  FROM test_runs
  WHERE user_id = p_user_id
  AND created_at >= date_trunc('month', NOW())
  AND status != 'cancelled';
  
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
