/**
 * Analytics tracking for guest tests and conversions
 * Lightweight event tracking - can be extended with PostHog, Mixpanel, etc.
 */

export interface AnalyticsEvent {
  event: string
  properties?: Record<string, any>
  userId?: string
  sessionId?: string
  timestamp?: string
}

// In-memory store for development (replace with real analytics service in production)
const eventStore: AnalyticsEvent[] = []

/**
 * Track an analytics event
 */
export async function trackEvent(
  event: string,
  properties?: Record<string, any>,
  userId?: string,
  sessionId?: string
): Promise<void> {
  const analyticsEvent: AnalyticsEvent = {
    event,
    properties,
    userId,
    sessionId,
    timestamp: new Date().toISOString(),
  }

  // Store event (in production, send to analytics service)
  eventStore.push(analyticsEvent)

  // Log in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[Analytics]', event, properties)
  }

  // In production, send to analytics service:
  // - PostHog: posthog.capture(userId, event, properties)
  // - Mixpanel: mixpanel.track(event, properties)
  // - Google Analytics: gtag('event', event, properties)
  
  // For now, we'll just log it
  // TODO: Integrate with analytics service
}

/**
 * Track guest test started
 */
export function trackGuestTestStarted(data: {
  url: string
  source: string
  sessionId: string
  email?: string
}): void {
  trackEvent('guest_test_started', {
    url: data.url,
    source: data.source,
    hasEmail: !!data.email,
  }, undefined, data.sessionId)
}

/**
 * Track guest test completed
 */
export function trackGuestTestCompleted(data: {
  testId: string
  sessionId: string
  steps: number
  issues: number
  duration: number
  hitStepLimit: boolean
}): void {
  trackEvent('guest_test_completed', {
    testId: data.testId,
    steps: data.steps,
    issues: data.issues,
    duration: data.duration,
    hitStepLimit: data.hitStepLimit,
  }, undefined, data.sessionId)
}

/**
 * Track guest test failed
 */
export function trackGuestTestFailed(data: {
  testId: string
  sessionId: string
  error: string
}): void {
  trackEvent('guest_test_failed', {
    testId: data.testId,
    error: data.error,
  }, undefined, data.sessionId)
}

/**
 * Track step limit hit
 */
export function trackGuestStepLimitHit(data: {
  testId: string
  sessionId: string
  stepsCompleted: number
}): void {
  trackEvent('guest_test_step_limit_hit', {
    testId: data.testId,
    stepsCompleted: data.stepsCompleted,
  }, undefined, data.sessionId)
}

/**
 * Track signup click from results
 */
export function trackGuestSignupClick(data: {
  testId: string
  sessionId: string
  source: 'results_page' | 'step_limit' | 'expiration_warning'
  issuesFound?: number
}): void {
  trackEvent('guest_signup_clicked', {
    testId: data.testId,
    source: data.source,
    issuesFound: data.issuesFound,
  }, undefined, data.sessionId)
}

/**
 * Track signup completed
 */
export function trackGuestSignupCompleted(data: {
  testId: string
  sessionId: string
  userId: string
}): void {
  trackEvent('guest_signup_completed', {
    testId: data.testId,
  }, data.userId, data.sessionId)
}

/**
 * Track test expired
 */
export function trackGuestTestExpired(data: {
  testId: string
  sessionId: string
}): void {
  trackEvent('guest_test_expired', {
    testId: data.testId,
  }, undefined, data.sessionId)
}

/**
 * Get analytics events (for debugging/admin)
 */
export function getAnalyticsEvents(limit: number = 100): AnalyticsEvent[] {
  return eventStore.slice(-limit)
}

