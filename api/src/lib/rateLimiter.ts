/**
 * Progressive Rate Limiting for Guest Tests
 * Implements tiered rate limiting system
 */

import { Database } from './db'
import { supabase } from './supabase'

export interface RateLimitResult {
  allowed: boolean
  reason?: string
  retryAfter?: number // seconds until next test allowed
  tier?: 'tier1' | 'tier2'
  testsRemaining?: number
}

export interface RateLimitConfig {
  tier1: {
    tests: number
    window: number // seconds
    cooldown: number // seconds between tests
  }
  tier2: {
    tests: number
    window: number
    cooldown: number
  }
  global: {
    tests: number
    window: number // seconds
  }
}

// Default rate limit configuration
export const DEFAULT_RATE_LIMITS: RateLimitConfig = {
  tier1: {
    tests: 3, // 3 tests per day for first-time users
    window: 86400, // 24 hours
    cooldown: 3600, // 1 hour between tests
  },
  tier2: {
    tests: 5, // 5 tests per day for returning users
    window: 86400, // 24 hours
    cooldown: 1800, // 30 minutes between tests
  },
  global: {
    tests: 20, // Max 20 concurrent guest tests per minute
    window: 60, // 1 minute
  },
}

/**
 * Check if guest session has previous tests (determines tier)
 */
async function getGuestTier(guestSessionId: string): Promise<'tier1' | 'tier2'> {
  try {
    // Check if user has completed any tests in the last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    
    // Query for completed tests
    const { supabase } = await import('./supabase')
    const { count, error } = await supabase
      .from('test_runs')
      .select('*', { count: 'exact', head: true })
      .eq('guest_session_id', guestSessionId)
      .gte('created_at', sevenDaysAgo)
      .in('status', ['completed', 'failed'])
    
    if (error) {
      console.error('Failed to get guest tier:', error)
      return 'tier1' // Default to tier1 on error
    }
    
    // If they have previous tests, they're tier2 (returning user)
    return (count || 0) > 0 ? 'tier2' : 'tier1'
  } catch (error) {
    console.error('Error determining guest tier:', error)
    return 'tier1' // Default to tier1 on error
  }
}

/**
 * Check rate limits for guest test
 */
export async function checkGuestRateLimit(
  guestSessionId: string,
  config: RateLimitConfig = DEFAULT_RATE_LIMITS
): Promise<RateLimitResult> {
  try {
    // Determine tier
    const tier = await getGuestTier(guestSessionId)
    const tierConfig = config[tier]
    
    // Check tier-specific limits
    const now = Date.now()
    const windowStart = now - (tierConfig.window * 1000)
    const cooldownWindow = now - (tierConfig.cooldown * 1000)
    
    // Get test count in window
    const testCount = await Database.getGuestTestCount(guestSessionId, tierConfig.window * 1000)
    
    // Check if exceeded tier limit
    if (testCount >= tierConfig.tests) {
      // Find oldest test in window to calculate retry time
      const { supabase } = await import('./supabase')
      const { data: oldestTest, error: oldestTestError } = await supabase
        .from('test_runs')
        .select('created_at')
        .eq('guest_session_id', guestSessionId)
        .gte('created_at', new Date(windowStart).toISOString())
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      
      if (oldestTestError && oldestTestError.code !== 'PGRST116') {
        console.error('Error finding oldest test:', oldestTestError)
      }
      
      if (oldestTest) {
        const oldestTestTime = new Date(oldestTest.created_at).getTime()
        const retryAfter = Math.ceil((oldestTestTime + (tierConfig.window * 1000) - now) / 1000)
        
        return {
          allowed: false,
          reason: `You've reached the limit of ${tierConfig.tests} tests per 24 hours. Please try again in ${formatTime(retryAfter)}.`,
          retryAfter,
          tier,
          testsRemaining: 0,
        }
      } else {
        // Fallback if we can't find oldest test
        return {
          allowed: false,
          reason: `You've reached the limit of ${tierConfig.tests} tests per 24 hours. Please try again later.`,
          retryAfter: tierConfig.window,
          tier,
          testsRemaining: 0,
        }
      }
    }
    
    // Check cooldown (time since last test)
    const { supabase } = await import('./supabase')
    const { data: lastTest } = await supabase
      .from('test_runs')
      .select('created_at')
      .eq('guest_session_id', guestSessionId)
      .gte('created_at', new Date(cooldownWindow).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    
    if (lastTest) {
      const lastTestTime = new Date(lastTest.created_at).getTime()
      const timeSinceLastTest = (now - lastTestTime) / 1000
      
      if (timeSinceLastTest < tierConfig.cooldown) {
        const retryAfter = Math.ceil(tierConfig.cooldown - timeSinceLastTest)
        
        return {
          allowed: false,
          reason: `Please wait ${formatTime(retryAfter)} before starting another test.`,
          retryAfter,
          tier,
          testsRemaining: tierConfig.tests - testCount,
        }
      }
    }
    
    // Check global rate limit (simplified - in production, use Redis)
    // For now, we'll skip this check as it requires distributed rate limiting
    // In production, implement with Redis INCR with TTL
    
    return {
      allowed: true,
      tier,
      testsRemaining: tierConfig.tests - testCount,
    }
  } catch (error: any) {
    console.error('Rate limit check error:', error)
    // On error, allow the request (fail open)
    return {
      allowed: true,
      tier: 'tier1',
      testsRemaining: 3,
    }
  }
}

/**
 * Format seconds into human-readable time
 */
function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60)
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`
  } else {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (minutes > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`
    }
    return `${hours} hour${hours !== 1 ? 's' : ''}`
  }
}

