/**
 * Pricing Tier Definitions and Utilities
 * Matches the exact requirements from the specification
 */

export type PricingTier = 'free' | 'starter' | 'indie' | 'pro'

export interface PricingTierLimits {
  // Test limits
  totalTestsPerMonth: number
  maxVisualTests: number

  // Browser & Device
  browsers: Array<'chromium' | 'firefox' | 'webkit'>
  mobileSupported: boolean

  // Projects
  maxProjects: number | 'unlimited'

  // Features
  exports: boolean
  historyDays: number
  reRuns: boolean

  // Advanced features
  priorityQueue: boolean
  savedConfigurations: boolean
  scheduledTests: boolean
  sharedDashboards: boolean
  ciIntegration: boolean
  teamMembers: number | 'unlimited'
}

export interface PricingTierInfo {
  id: PricingTier
  name: string
  price: number
  priceLabel: string
  description: string
  limits: PricingTierLimits
  features: string[]
  cta: string
  popular?: boolean
  polarProductId?: string // Polar.sh product ID for checkout
}

export const PRICING_TIERS: Record<PricingTier, PricingTierInfo> = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    priceLabel: '$0',
    description: 'Perfect for trying out Rihario',
    limits: {
      totalTestsPerMonth: 3,
      maxVisualTests: 1,
      browsers: ['chromium'],
      mobileSupported: false,
      maxProjects: 1,
      exports: false,
      historyDays: 0,
      reRuns: false,
      priorityQueue: false,
      savedConfigurations: false,
      scheduledTests: false,
      sharedDashboards: false,
      ciIntegration: false,
      teamMembers: 1,
    },
    features: [
      '3 total tests / month',
      'Max 1 Visual Test',
      'Chrome only',
      'Desktop only',
      'Single URL',
      'No exports',
      'No history',
      'No re-runs',
      'No parallel cross-browser testing',
    ],
    cta: 'Get Started',
    polarProductId: undefined, // Free tier - no checkout
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 19,
    priceLabel: '$19',
    description: 'For solo developers and small projects',
    limits: {
      totalTestsPerMonth: 100,
      maxVisualTests: 15,
      browsers: ['chromium', 'firefox', 'webkit'],
      mobileSupported: true,
      maxProjects: 1,
      exports: true,
      historyDays: 30,
      reRuns: true,
      priorityQueue: false,
      savedConfigurations: false,
      scheduledTests: false,
      sharedDashboards: false,
      ciIntegration: false,
      teamMembers: 1,
    },
    features: [
      '100 tests / month',
      'Max 15 Visual Tests',
      'Desktop + mobile',
      'Single project',
      'Full reports',
      'Test history (30 days)',
      'No parallel cross-browser testing',
    ],
    cta: 'Upgrade to Starter',
    polarProductId: '84331781-6628-4f25-a1c4-81c9aff5c301',
  },
  indie: {
    id: 'indie',
    name: 'Indie',
    price: 39,
    priceLabel: '$39',
    description: 'For scaling founders and multiple projects',
    limits: {
      totalTestsPerMonth: 300,
      maxVisualTests: 60,
      browsers: ['chromium', 'firefox', 'webkit'],
      mobileSupported: true,
      maxProjects: 10, // Multiple projects
      exports: true,
      historyDays: 90,
      reRuns: true,
      priorityQueue: true,
      savedConfigurations: true,
      scheduledTests: false,
      sharedDashboards: false,
      ciIntegration: false,
      teamMembers: 1,
    },
    features: [
      '300 tests / month',
      'Max 60 Visual Tests',
      'Multiple projects',
      'Desktop + mobile',
      'Full exports (PDF / JSON)',
      'Test history (90 days)',
      'Priority execution queue',
      'Saved test configurations',
      'Parallel cross-browser testing (2 browsers)',
    ],
    cta: 'Upgrade to Indie',
    polarProductId: 'a9519689-9ac5-4b9e-b006-ad35b2d68531',
    popular: true, // Most Popular badge
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 99,
    priceLabel: '$99',
    description: 'For power users and advanced workflows',
    limits: {
      totalTestsPerMonth: 1000,
      maxVisualTests: 250,
      browsers: ['chromium', 'firefox', 'webkit'],
      mobileSupported: true,
      maxProjects: 'unlimited',
      exports: true,
      historyDays: 365,
      reRuns: true,
      priorityQueue: true,
      savedConfigurations: true,
      scheduledTests: true,
      sharedDashboards: true,
      ciIntegration: false,
      teamMembers: 1,
    },
    features: [
      '1,000 tests / month',
      'Max 250 Visual Tests',
      'Unlimited projects',
      'Advanced API Access',
      'Priority God Mode Support',
      'Scheduled tests',
      'Shared dashboards',
      'Parallel cross-browser testing (Chrome, Firefox, Safari)',
    ],
    cta: 'Upgrade to Pro',
    polarProductId: '1db05405-2505-4156-a535-f4318daabc8c',
  },
}

export interface VisualTestAddOn {
  id: string
  name: string
  visualTests: number
  price: number
  priceLabel: string
  description: string
}

export const VISUAL_TEST_ADDONS: VisualTestAddOn[] = [
  {
    id: 'addon-50',
    name: '+50 Visual Tests',
    visualTests: 50,
    price: 10,
    priceLabel: '$10',
    description: 'Add 50 visual tests to your monthly quota',
  },
  {
    id: 'addon-200',
    name: '+200 Visual Tests',
    visualTests: 200,
    price: 30,
    priceLabel: '$30',
    description: 'Add 200 visual tests to your monthly quota',
  },
]

/**
 * Get the next tier that unlocks a feature
 */
export function getNextTierForFeature(feature: string, currentTier: PricingTier): PricingTier | null {
  const tierOrder: PricingTier[] = ['free', 'starter', 'indie', 'pro']
  const currentIndex = tierOrder.indexOf(currentTier)

  for (let i = currentIndex + 1; i < tierOrder.length; i++) {
    const tier = tierOrder[i]
    const tierInfo = PRICING_TIERS[tier]

    // Check if this tier has the feature
    if (feature === 'mobile' && tierInfo.limits.mobileSupported) return tier
    if (feature === 'exports' && tierInfo.limits.exports) return tier
    if (feature === 'scheduled' && tierInfo.limits.scheduledTests) return tier
    if (feature === 'multiple-projects' && tierInfo.limits.maxProjects !== 1) return tier
    if (feature === 'unlimited-projects' && tierInfo.limits.maxProjects === 'unlimited') return tier
    if (feature === 'ci-integration' && tierInfo.limits.ciIntegration) return tier
    if (feature === 'shared-dashboards' && tierInfo.limits.sharedDashboards) return tier
  }

  return null
}

/**
 * Check if a tier can purchase add-ons
 */
export function canPurchaseAddOns(tier: PricingTier): boolean {
  return tier !== 'free'
}

/**
 * Get recommended tier based on usage
 */
export function getRecommendedTier(usage: {
  totalTests: number
  visualTests: number
  needsMobile?: boolean
  needsMultipleProjects?: boolean
}): PricingTier {
  if (usage.needsMultipleProjects) return 'indie'
  if (usage.totalTests > 300 || usage.visualTests > 60) return 'pro'
  if (usage.totalTests > 100 || usage.visualTests > 15 || usage.needsMobile) return 'indie'
  if (usage.totalTests > 3 || usage.visualTests > 1) return 'starter'
  return 'free'
}

