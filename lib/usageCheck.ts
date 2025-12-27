/**
 * Utility functions for checking usage limits and tier restrictions
 */
import { PRICING_TIERS, type PricingTier } from './pricing'
import { DeviceProfile } from './api'

export interface UsageCheckResult {
  canProceed: boolean
  reason?: 'test-limit' | 'visual-test-limit' | 'mobile-locked' | 'feature-locked'
  message?: string
  recommendedTier?: PricingTier
}

/**
 * Check if user can create a test based on their tier and usage
 */
export function canCreateTest(
  tier: PricingTier,
  usage: {
    totalTests: number
    visualTests: number
  },
  options: {
    isVisualTest?: boolean
    device?: DeviceProfile
  } = {}
): UsageCheckResult {
  const tierInfo = PRICING_TIERS[tier]

  // Check total test limit
  if (usage.totalTests >= tierInfo.limits.totalTestsPerMonth) {
    return {
      canProceed: false,
      reason: 'test-limit',
      message: `You've reached your monthly limit of ${tierInfo.limits.totalTestsPerMonth} tests.`,
      recommendedTier: getNextTier(tier),
    }
  }

  // Check visual test limit
  if (options.isVisualTest) {
    if (usage.visualTests >= tierInfo.limits.maxVisualTests) {
      return {
        canProceed: false,
        reason: 'visual-test-limit',
        message: `You've reached your visual test limit of ${tierInfo.limits.maxVisualTests}.`,
        recommendedTier: getNextTier(tier),
      }
    }
  }

  // Check mobile device support
  if (options.device) {
    const isMobile = [
      DeviceProfile.MOBILE_CHROME,
      DeviceProfile.MOBILE_SAFARI,
      DeviceProfile.MOBILE_CHROME_ANDROID,
      DeviceProfile.ANDROID_EMULATOR,
      DeviceProfile.IOS_SIMULATOR,
    ].includes(options.device as DeviceProfile)

    if (isMobile && !tierInfo.limits.mobileSupported) {
      return {
        canProceed: false,
        reason: 'mobile-locked',
        message: 'Mobile testing is not available on your current plan.',
        recommendedTier: 'starter',
      }
    }
  }

  return { canProceed: true }
}

/**
 * Check if a feature is available for the tier
 */
export function isFeatureAvailable(tier: PricingTier, feature: string): boolean {
  const tierInfo = PRICING_TIERS[tier]

  switch (feature) {
    case 'mobile':
      return tierInfo.limits.mobileSupported
    case 'exports':
      return tierInfo.limits.exports
    case 'scheduled':
      return tierInfo.limits.scheduledTests
    case 'multiple-projects':
      return tierInfo.limits.maxProjects !== 1
    case 'unlimited-projects':
      return tierInfo.limits.maxProjects === 'unlimited'
    case 'unlimited-projects':
      return tierInfo.limits.maxProjects === 'unlimited'
    default:
      return true
  }
}

/**
 * Get the next tier for upgrade
 */
function getNextTier(tier: PricingTier): PricingTier {
  const tiers: PricingTier[] = ['free', 'starter', 'indie', 'pro']
  const currentIndex = tiers.indexOf(tier)
  return currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : 'pro'
}

