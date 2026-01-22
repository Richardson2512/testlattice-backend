/**
 * Cookie Status Tracker - Global invariant enforcement
 * 
 * Enforces the SINGLE AUTHORITY rule for cookie handling:
 * - Cookie handling may ONLY occur when status === NOT_STARTED
 * - handleCookieConsent() sets status → COMPLETED
 * - Any attempt to detect or dismiss cookies after COMPLETED MUST throw
 * 
 * This is a RUNTIME INVARIANT that prevents cookie logic from executing
 * outside the sealed CookieBannerHandler.
 */

export type CookieStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'

interface RunCookieStatus {
  status: CookieStatus
  runId: string
  completedAt?: string
}

const cookieStatusMap = new Map<string, RunCookieStatus>()

/**
 * Get current cookie status for a run
 */
export function getCookieStatus(runId: string): CookieStatus {
  const entry = cookieStatusMap.get(runId)
  return entry?.status || 'NOT_STARTED'
}

/**
 * Set cookie status - ONLY CookieBannerHandler should call this
 */
export function setCookieStatus(runId: string, status: CookieStatus): void {
  const entry: RunCookieStatus = {
    status,
    runId,
    completedAt: status === 'COMPLETED' ? new Date().toISOString() : undefined,
  }
  cookieStatusMap.set(runId, entry)
}

/**
 * Check if cookie handling is allowed
 * Throws if cookie handling is attempted after completion
 */
export function assertCookieHandlingAllowed(runId: string, context: string): void {
  const status = getCookieStatus(runId)
  
  if (status === 'COMPLETED') {
    throw new Error(
      `INVARIANT VIOLATION: Cookie handling attempted outside sealed handler. ` +
      `Context: ${context}. ` +
      `Cookie handling was already completed for run ${runId}. ` +
      `This indicates a bypass path that must be removed.`
    )
  }
  
  if (status === 'IN_PROGRESS') {
    throw new Error(
      `INVARIANT VIOLATION: Cookie handling already in progress. ` +
      `Context: ${context}. ` +
      `Run ${runId} is currently processing cookies. ` +
      `This indicates concurrent cookie handling which is forbidden.`
    )
  }
}

/**
 * Reset cookie status for a new test run
 */
export function resetCookieStatus(runId: string): void {
  cookieStatusMap.delete(runId)
}

/**
 * Clear all cookie status (for cleanup/testing)
 */
export function clearAllCookieStatus(): void {
  cookieStatusMap.clear()
}

