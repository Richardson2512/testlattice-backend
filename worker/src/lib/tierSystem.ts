/**
 * Tier System for Worker - Enforces tier limits during test execution
 */

export type UserTier = 'guest' | 'starter' | 'indie' | 'pro' | 'agency'

export interface TierLimits {
  maxSteps: number
  maxPages: number
  maxScreenshots: number
  comprehensiveTesting: {
    performance: boolean
    accessibility: boolean
    security: boolean
    seo: boolean
    visualRegression: boolean
  }
  selfHealingRetries: number
  godMode: boolean
  videoRecording: boolean
}

export const TIER_LIMITS: Record<UserTier, TierLimits> = {
  guest: {
    maxSteps: 25, // Changed from 10 to 25 (same as Starter)
    maxPages: 1,
    maxScreenshots: Infinity, // Changed from 5 to Infinity (unlimited, based on steps)
    comprehensiveTesting: {
      performance: false,
      accessibility: false,
      security: false,
      seo: false,
      visualRegression: false,
    },
    selfHealingRetries: 1,
    godMode: false,
    videoRecording: false,
  },
  starter: {
    maxSteps: Infinity, // Changed from 25 to Infinity (dynamic based on diagnosis)
    maxPages: 1,
    maxScreenshots: Infinity, // Changed from 15 to Infinity (based on diagnosis report)
    comprehensiveTesting: {
      performance: true,
      accessibility: false,
      security: false,
      seo: false,
      visualRegression: false,
    },
    selfHealingRetries: 1,
    godMode: false,
    videoRecording: false,
  },
  indie: {
    maxSteps: Infinity, // Changed from 50 to Infinity (dynamic based on diagnosis)
    maxPages: 3,
    maxScreenshots: Infinity, // Changed from 30 to Infinity (based on diagnosis report)
    comprehensiveTesting: {
      performance: true,
      accessibility: true,
      security: true,
      seo: true,
      visualRegression: false,
    },
    selfHealingRetries: 3,
    godMode: true,
    videoRecording: true,
  },
  pro: {
    maxSteps: Infinity, // Changed from 100 to Infinity (dynamic based on diagnosis)
    maxPages: 10,
    maxScreenshots: Infinity, // Changed from 50 to Infinity (based on diagnosis report)
    comprehensiveTesting: {
      performance: true,
      accessibility: true,
      security: true,
      seo: true,
      visualRegression: true,
    },
    selfHealingRetries: 5,
    godMode: true,
    videoRecording: true,
  },
  agency: {
    maxSteps: Infinity,
    maxPages: Infinity,
    maxScreenshots: Infinity,
    comprehensiveTesting: {
      performance: true,
      accessibility: true,
      security: true,
      seo: true,
      visualRegression: true,
    },
    selfHealingRetries: 10,
    godMode: true,
    videoRecording: true,
  },
}

/**
 * Get tier limits for a user tier
 */
export function getTierLimits(tier: UserTier = 'guest'): TierLimits {
  return TIER_LIMITS[tier] || TIER_LIMITS.guest
}

/**
 * Check if comprehensive testing feature is enabled for tier
 */
export function isComprehensiveTestingEnabled(
  tier: UserTier,
  feature: 'performance' | 'accessibility' | 'security' | 'seo' | 'visualRegression'
): boolean {
  const limits = getTierLimits(tier)
  return limits.comprehensiveTesting[feature] || false
}

