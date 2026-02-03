/**
 * Tier System - Defines feature restrictions for Free, Starter, Indie, and Pro tiers
 */

export type UserTier = 'guest' | 'free' | 'starter' | 'indie' | 'pro' | 'agency'

export interface TierLimits {
  // Test execution limits
  maxSteps: number
  maxPages: number
  maxScreenshots: number
  maxDuration: number // in minutes
  maxProjects: number // Maximum number of projects allowed

  // Browser support
  browsers: Array<'chromium' | 'firefox' | 'webkit'>
  mobileBrowsers: boolean
  maxParallelBrowsers: number // Maximum browsers that can run in parallel

  // Features
  diagnosis: {
    enabled: boolean
    maxSteps?: number // For basic diagnosis
  }
  godMode: boolean
  videoRecording: boolean
  traceRecording: boolean

  // Self-healing
  selfHealingRetries: number

  // Test suggestions
  testSuggestions: number

  // Comprehensive testing
  comprehensiveTesting: {
    performance: boolean
    accessibility: boolean
    security: boolean
    seo: boolean
    visualRegression: boolean
  }

  // Result retention
  retentionDays: number
}

export const TIER_LIMITS: Record<UserTier, TierLimits> = {
  guest: {
    maxSteps: 25, // Changed from 10 to 25 (same as Starter)
    maxPages: 1,
    maxScreenshots: Infinity, // Changed from 5 to Infinity (unlimited, based on steps)
    maxDuration: 5,
    maxProjects: 0,
    browsers: ['chromium'],
    mobileBrowsers: false,
    maxParallelBrowsers: 1, // Guest: chromium only
    diagnosis: {
      enabled: false,
    },
    godMode: false,
    videoRecording: false,
    traceRecording: false,
    selfHealingRetries: 1,
    testSuggestions: 0,
    comprehensiveTesting: {
      performance: false,
      accessibility: false,
      security: false,
      seo: false,
      visualRegression: false,
    },
    retentionDays: 2, // 48h
  },
  // Free tier - for registered users with no paid subscription
  // Matches pricing page: 3 tests/month, 1 visual test, Chrome only
  free: {
    maxSteps: 25,
    maxPages: 1,
    maxScreenshots: Infinity,
    maxDuration: 5,
    maxProjects: 0,
    browsers: ['chromium'],
    mobileBrowsers: false,
    maxParallelBrowsers: 1,
    diagnosis: {
      enabled: false,
    },
    godMode: false,
    videoRecording: false,
    traceRecording: false,
    selfHealingRetries: 1,
    testSuggestions: 0,
    comprehensiveTesting: {
      performance: false,
      accessibility: false,
      security: false,
      seo: false,
      visualRegression: false,
    },
    retentionDays: 2, // Same as guest (48h)
  },
  starter: {
    maxSteps: Infinity, // Changed from 25 to Infinity (dynamic based on diagnosis)
    maxPages: 1,
    maxScreenshots: Infinity, // Changed from 15 to Infinity (based on diagnosis report)
    maxDuration: 10,
    maxProjects: 1,
    browsers: ['chromium', 'webkit'],
    mobileBrowsers: false,
    maxParallelBrowsers: 1, // Starter: single browser only
    diagnosis: {
      enabled: true,
      maxSteps: 3,
    },
    godMode: false,
    videoRecording: false,
    traceRecording: false,
    selfHealingRetries: 1,
    testSuggestions: 3,
    comprehensiveTesting: {
      performance: true, // Basic only
      accessibility: false,
      security: false,
      seo: false,
      visualRegression: false,
    },
    retentionDays: 30,
  },
  indie: {
    maxSteps: Infinity, // Changed from 50 to Infinity (dynamic based on diagnosis)
    maxPages: 3,
    maxScreenshots: Infinity, // Changed from 30 to Infinity (based on diagnosis report)
    maxDuration: 15,
    maxProjects: Infinity,
    browsers: ['chromium', 'webkit', 'firefox'],
    mobileBrowsers: true,
    maxParallelBrowsers: 2, // Indie: up to 2 browsers in parallel (user selectable)
    diagnosis: {
      enabled: true,
      maxSteps: 5,
    },
    godMode: true,
    videoRecording: true,
    traceRecording: true,
    selfHealingRetries: 3,
    testSuggestions: 5,
    comprehensiveTesting: {
      performance: true,
      accessibility: true, // Basic WCAG AA
      security: true, // Basic XSS/SQL injection
      seo: true, // Basic meta tags
      visualRegression: false,
    },
    retentionDays: 90,
  },
  pro: {
    maxSteps: Infinity, // Changed from 100 to Infinity (dynamic based on diagnosis)
    maxPages: 10,
    maxScreenshots: Infinity, // Changed from 50 to Infinity (based on diagnosis report)
    maxDuration: 30,
    maxProjects: Infinity,
    browsers: ['chromium', 'webkit', 'firefox'],
    mobileBrowsers: true,
    maxParallelBrowsers: 3, // Pro: all 3 browsers in parallel
    diagnosis: {
      enabled: true,
    },
    godMode: true,
    videoRecording: true,
    traceRecording: true,
    selfHealingRetries: 5,
    testSuggestions: 10,
    comprehensiveTesting: {
      performance: true,
      accessibility: true, // Full WCAG AAA
      security: true,
      seo: true,
      visualRegression: true,
    },
    retentionDays: 365,
  },
  agency: {
    maxSteps: Infinity,
    maxPages: Infinity,
    maxScreenshots: Infinity,
    maxDuration: 60,
    maxProjects: Infinity,
    browsers: ['chromium', 'webkit', 'firefox'],
    mobileBrowsers: true,
    maxParallelBrowsers: 3, // Agency: all 3 browsers in parallel
    diagnosis: {
      enabled: true,
    },
    godMode: true,
    videoRecording: true,
    traceRecording: true,
    selfHealingRetries: 10,
    testSuggestions: Infinity,
    comprehensiveTesting: {
      performance: true,
      accessibility: true,
      security: true,
      seo: true,
      visualRegression: true,
    },
    retentionDays: Infinity,
  },
}

export interface TierValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Validate test run options against tier limits
 */
export function validateTierLimits(
  tier: UserTier,
  options: {
    maxSteps?: number
    testMode?: 'single' | 'multi' | 'all' | 'monkey' | 'behavior'
    browserMatrix?: string[]
    skipDiagnosis?: boolean
    godMode?: boolean
    videoRecording?: boolean
    visualDiff?: boolean
  },
  profile?: {
    device?: string
  }
): TierValidationResult {
  const limits = TIER_LIMITS[tier]
  const errors: string[] = []
  const warnings: string[] = []

  // Validate max steps - but allow unlimited for Starter+ when diagnosis is enabled
  // Guest: 25 steps max
  // Starter+: Unlimited (dynamic based on diagnosis)
  if (options.maxSteps !== undefined && limits.maxSteps !== Infinity) {
    if (options.maxSteps > limits.maxSteps) {
      errors.push(`Maximum steps for ${tier} tier is ${limits.maxSteps}. Requested: ${options.maxSteps}`)
    }
  }
  // For Starter+ with diagnosis, steps are dynamic (no limit check needed)
  // For Guest, limit is 25 (already set in limits)

  // Validate test mode (pages)
  if (options.testMode === 'multi' || options.testMode === 'all') {
    const requestedPages = options.testMode === 'all' ? Infinity : 3
    if (requestedPages > limits.maxPages) {
      errors.push(`${tier} tier supports maximum ${limits.maxPages} page(s). ${options.testMode} mode requires more pages.`)
    }
  }

  // Validate browser support and parallel browser limits
  if (options.browserMatrix) {
    const unsupportedBrowsers = options.browserMatrix.filter(
      browser => !limits.browsers.includes(browser as any)
    )
    if (unsupportedBrowsers.length > 0) {
      errors.push(`${tier} tier supports: ${limits.browsers.join(', ')}. Unsupported browsers: ${unsupportedBrowsers.join(', ')}`)
    }

    // Validate parallel browser limit
    if (options.browserMatrix.length > limits.maxParallelBrowsers) {
      errors.push(`${tier} tier supports maximum ${limits.maxParallelBrowsers} parallel browser(s). Requested: ${options.browserMatrix.length}`)
    }

    // Validate unique browsers
    const uniqueBrowsers = new Set(options.browserMatrix)
    if (uniqueBrowsers.size !== options.browserMatrix.length) {
      errors.push('Browser matrix cannot contain duplicate browsers')
    }
  }

  // Validate device profile
  if (profile?.device) {
    const isMobile = profile.device.includes('mobile') || profile.device.includes('android') || profile.device.includes('ios')
    if (isMobile && !limits.mobileBrowsers) {
      errors.push(`${tier} tier does not support mobile browser testing`)
    }
  }

  // Validate diagnosis
  if (!options.skipDiagnosis && !limits.diagnosis.enabled) {
    errors.push(`${tier} tier does not support diagnosis phase`)
  }

  // Validate God Mode
  if (options.godMode && !limits.godMode) {
    errors.push(`${tier} tier does not support God Mode (manual intervention)`)
  }

  // Validate video recording
  if (options.videoRecording && !limits.videoRecording) {
    errors.push(`${tier} tier does not support video recording`)
  }

  // Validate visual regression
  if (options.visualDiff && !limits.comprehensiveTesting.visualRegression) {
    errors.push(`${tier} tier does not support visual regression testing`)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Get user tier from user_subscriptions table
 */
export async function getUserTier(userId?: string): Promise<UserTier> {
  if (!userId) {
    return 'guest'
  }

  try {
    // Import supabase here to avoid circular dependencies
    const { supabase } = await import('./supabase')

    // ADMIN OVERRIDE: Hardcoded pro tier for admin accounts (by user ID)
    // To find your user ID, check auth.users table in Supabase or use: supabase.auth.getUser()
    const ADMIN_USER_IDS = process.env.ADMIN_USER_IDS?.split(',') || []
    if (ADMIN_USER_IDS.includes(userId)) {
      console.log(`[TierSystem] Admin override: ${userId} -> pro tier`)
      return 'pro'
    }

    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('tier')
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      console.warn(`Failed to fetch tier for user ${userId}:`, error?.message)
      return 'free' as UserTier // Default to free if not found
    }

    // Map database tier to UserTier
    // INVARIANT: Free users behave like guests with persistence and limits
    const tierMap: Record<string, UserTier> = {
      'free': 'free', // Keep free as distinct tier for usage tracking
      'starter': 'starter',
      'indie': 'indie',
      'pro': 'pro',
      'agency': 'agency',
    }

    return tierMap[data.tier] || 'free'
  } catch (err) {
    console.error('Error fetching user tier:', err)
    return 'free'
  }
}

/**
 * Apply tier restrictions to test options
 * INVARIANT: Free users behave like guests with persistence and limits
 */
export function applyTierRestrictions(
  tier: UserTier,
  options: any
): any {
  // Free tier uses guest limits for feature restrictions
  const effectiveTier = tier === 'free' ? 'guest' : tier
  const limits = TIER_LIMITS[effectiveTier]

  return {
    ...options,
    // Enforce max steps only if tier has a finite limit
    // Guest/Free: 25 steps max
    // Starter+: Unlimited (dynamic based on diagnosis)
    maxSteps: limits.maxSteps === Infinity
      ? options.maxSteps  // Keep user's requested steps (will be dynamic based on diagnosis)
      : (options.maxSteps ? Math.min(options.maxSteps, limits.maxSteps) : limits.maxSteps),
    // Screenshots: Unlimited for all tiers (determined by steps/diagnosis)
    // No need to enforce screenshot limits - they're based on actual test execution
    // Enforce diagnosis
    skipDiagnosis: !limits.diagnosis.enabled || options.skipDiagnosis,
    // Enforce God Mode
    godMode: limits.godMode && options.godMode,
    // Enforce video recording
    videoRecording: limits.videoRecording && options.videoRecording,
    // Enforce visual regression
    visualDiff: limits.comprehensiveTesting.visualRegression && options.visualDiff,
  }
}

/**
 * Check monthly usage limits for free tier users
 * Rule 1: Free users are limited to 3 tests per month
 */
export async function checkUsageLimits(userId: string, tier: UserTier): Promise<{
  canRun: boolean
  testsUsed: number
  testsLimit: number
  reason?: string
}> {
  // Paid tiers have no monthly limit
  if (tier !== 'free') {
    return { canRun: true, testsUsed: 0, testsLimit: Infinity }
  }

  try {
    const { supabase } = await import('./supabase')

    // Try RPC first (Dynamic count, handles cancelled tests correctly)
    const { data: rpcData, error: rpcError } = await supabase.rpc('check_usage_limit', { p_user_id: userId })

    if (!rpcError && rpcData?.[0]) {
      const result = rpcData[0]
      return {
        canRun: result.can_run,
        testsUsed: result.tests_used,
        testsLimit: result.tests_limit,
        reason: !result.can_run ? `Monthly limit reached (${result.tests_used}/${result.tests_limit} tests)` : undefined
      }
    }

    // Fallback: Check user_subscriptions table directly
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('tests_used_this_month')
      .eq('user_id', userId)
      .single()

    if (error) {
      console.warn(`Failed to check usage for user ${userId}:`, error.message)
      // On error, allow the test (fail open for UX, backend will still track)
      return { canRun: true, testsUsed: 0, testsLimit: 3 }
    }

    const used = data?.tests_used_this_month || 0
    const limit = 3

    return {
      canRun: used < limit,
      testsUsed: used,
      testsLimit: limit,
      reason: used >= limit ? `Monthly limit reached (${used}/${limit} tests)` : undefined
    }
  } catch (err) {
    console.error('Error checking usage limits:', err)
    // Fail open for UX
    return { canRun: true, testsUsed: 0, testsLimit: 3 }
  }
}

/**
 * Validate test type cardinality for free tier
 * Rule 2: Free users can only run 1 test type per run
 */
export function validateTestTypeCardinality(
  tier: UserTier,
  selectedTestTypes?: string[]
): { valid: boolean; error?: string } {
  if (tier !== 'free') {
    return { valid: true }
  }

  if (selectedTestTypes && selectedTestTypes.length > 1) {
    return {
      valid: false,
      error: 'Free plan allows 1 test type per run. Upgrade to select multiple.'
    }
  }

  return { valid: true }
}

