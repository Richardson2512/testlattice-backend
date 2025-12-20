/**
 * Tier System - Defines feature restrictions for Guest, Starter, and Indie tiers
 */

export type UserTier = 'guest' | 'starter' | 'indie' | 'pro' | 'agency'

export interface TierLimits {
  // Test execution limits
  maxSteps: number
  maxPages: number
  maxScreenshots: number
  maxDuration: number // in minutes

  // Browser support
  browsers: Array<'chromium' | 'firefox' | 'webkit'>
  mobileBrowsers: boolean

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
    browsers: ['chromium'],
    mobileBrowsers: false,
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
    retentionDays: 1,
  },
  starter: {
    maxSteps: Infinity, // Changed from 25 to Infinity (dynamic based on diagnosis)
    maxPages: 1,
    maxScreenshots: Infinity, // Changed from 15 to Infinity (based on diagnosis report)
    maxDuration: 10,
    browsers: ['chromium', 'webkit'],
    mobileBrowsers: false,
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
    browsers: ['chromium', 'webkit', 'firefox'],
    mobileBrowsers: true,
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
    browsers: ['chromium', 'webkit', 'firefox'],
    mobileBrowsers: true,
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
    browsers: ['chromium', 'webkit', 'firefox'],
    mobileBrowsers: true,
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
    testMode?: 'single' | 'multi' | 'all' | 'monkey'
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

  // Validate browser support
  if (options.browserMatrix) {
    const unsupportedBrowsers = options.browserMatrix.filter(
      browser => !limits.browsers.includes(browser as any)
    )
    if (unsupportedBrowsers.length > 0) {
      errors.push(`${tier} tier supports: ${limits.browsers.join(', ')}. Unsupported browsers: ${unsupportedBrowsers.join(', ')}`)
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
 * Get user tier from user metadata or default to guest
 */
export async function getUserTier(userId?: string): Promise<UserTier> {
  if (!userId) {
    return 'guest'
  }

  // TODO: Fetch from database user metadata or subscription service
  // For now, default to 'starter' for authenticated users
  // This should be replaced with actual subscription lookup
  try {
    // const user = await Database.getUser(userId)
    // return user?.tier || 'starter'
    return 'starter' // Default for now
  } catch {
    return 'starter'
  }
}

/**
 * Apply tier restrictions to test options
 */
export function applyTierRestrictions(
  tier: UserTier,
  options: any
): any {
  const limits = TIER_LIMITS[tier]

  return {
    ...options,
    // Enforce max steps only if tier has a finite limit
    // Guest: 25 steps max
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

