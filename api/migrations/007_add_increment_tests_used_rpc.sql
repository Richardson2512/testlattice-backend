-- Migration: Add increment_tests_used RPC function
-- This function atomically increments the tests_used_this_month counter for a user

-- Create or replace the increment_tests_used function
CREATE OR REPLACE FUNCTION increment_tests_used(p_user_id UUID, p_count INTEGER DEFAULT 1)
RETURNS VOID AS $$
BEGIN
    -- Update the user_subscriptions table
    UPDATE user_subscriptions
    SET 
        tests_used_this_month = COALESCE(tests_used_this_month, 0) + p_count,
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    -- If no row was updated, insert a new one
    IF NOT FOUND THEN
        INSERT INTO user_subscriptions (user_id, tier, tests_used_this_month, created_at, updated_at)
        VALUES (p_user_id, 'free', p_count, NOW(), NOW())
        ON CONFLICT (user_id) DO UPDATE
        SET tests_used_this_month = user_subscriptions.tests_used_this_month + p_count,
            updated_at = NOW();
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_tests_used(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_tests_used(UUID, INTEGER) TO service_role;
