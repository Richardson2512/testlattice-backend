/**
 * Analytics tracking for guest tests (worker-side)
 * Mirrors the API analytics but for worker context
 */

export interface AnalyticsEvent {
  event: string
  properties?: Record<string, any>
  userId?: string
  sessionId?: string
  timestamp?: string
}

/**
 * Track an analytics event (worker-side)
 * In production, this would send to the API or directly to analytics service
 */
export async function trackEvent(
  event: string,
  properties?: Record<string, any>,
  userId?: string,
  sessionId?: string
): Promise<void> {
  // In production, send to API or analytics service
  // For now, just log
  console.log('[Analytics]', event, properties)
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

