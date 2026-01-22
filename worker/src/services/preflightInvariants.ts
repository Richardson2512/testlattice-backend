/**
 * Preflight Invariants - Hard runtime guards
 * 
 * These functions throw immediately if preflight invariants are violated.
 * They are NOT comments - they are executable code that prevents bugs.
 */

import { getCookieStatus, CookieStatus } from './cookieStatusTracker'

export type PreflightStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'

// Global preflight status tracking (separate from cookie status)
const preflightStatusMap = new Map<string, PreflightStatus>()

/**
 * Get current preflight status for a run
 */
export function getPreflightStatus(runId: string): PreflightStatus {
  return preflightStatusMap.get(runId) || 'NOT_STARTED'
}

/**
 * Set preflight status
 */
export function setPreflightStatus(runId: string, status: PreflightStatus): void {
  preflightStatusMap.set(runId, status)
}

/**
 * Reset preflight status for a new test run
 */
export function resetPreflightStatus(runId: string): void {
  preflightStatusMap.delete(runId)
}

/**
 * INVARIANT: Screenshot capture before preflight completes
 * 
 * Throws immediately if violated.
 */
export function assertPreflightCompletedBeforeScreenshot(runId: string, context: string): void {
  const preflightStatus = getPreflightStatus(runId)
  const cookieStatus = getCookieStatus(runId)

  if (preflightStatus !== 'COMPLETED') {
    throw new Error(
      `INVARIANT VIOLATION: Screenshot capture attempted before preflight completes. ` +
      `Context: ${context}. ` +
      `Preflight status: ${preflightStatus}. ` +
      `Cookie status: ${cookieStatus}. ` +
      `Screenshots may only be captured after preflight phase completes.`
    )
  }

  if (cookieStatus !== 'COMPLETED') {
    throw new Error(
      `INVARIANT VIOLATION: Screenshot capture attempted before cookie handling completes. ` +
      `Context: ${context}. ` +
      `Cookie status: ${cookieStatus}. ` +
      `Screenshots may only be captured after cookie handling completes.`
    )
  }
}

/**
 * INVARIANT: DOM snapshot before preflight completes
 * 
 * Throws immediately if violated.
 */
export function assertPreflightCompletedBeforeDOMSnapshot(runId: string, context: string): void {
  const preflightStatus = getPreflightStatus(runId)
  const cookieStatus = getCookieStatus(runId)

  if (preflightStatus !== 'COMPLETED') {
    throw new Error(
      `INVARIANT VIOLATION: DOM snapshot attempted before preflight completes. ` +
      `Context: ${context}. ` +
      `Preflight status: ${preflightStatus}. ` +
      `Cookie status: ${cookieStatus}. ` +
      `DOM snapshots may only be captured after preflight phase completes.`
    )
  }

  if (cookieStatus !== 'COMPLETED') {
    throw new Error(
      `INVARIANT VIOLATION: DOM snapshot attempted before cookie handling completes. ` +
      `Context: ${context}. ` +
      `Cookie status: ${cookieStatus}. ` +
      `DOM snapshots may only be captured after cookie handling completes.`
    )
  }
}

/**
 * INVARIANT: AI screenshot analysis before preflight completes
 * 
 * Throws immediately if violated.
 */
export function assertPreflightCompletedBeforeAIAnalysis(runId: string, context: string): void {
  const preflightStatus = getPreflightStatus(runId)
  const cookieStatus = getCookieStatus(runId)

  if (preflightStatus !== 'COMPLETED') {
    throw new Error(
      `INVARIANT VIOLATION: AI screenshot analysis attempted before preflight completes. ` +
      `Context: ${context}. ` +
      `Preflight status: ${preflightStatus}. ` +
      `Cookie status: ${cookieStatus}. ` +
      `AI analysis may only run after preflight phase completes.`
    )
  }

  if (cookieStatus !== 'COMPLETED') {
    throw new Error(
      `INVARIANT VIOLATION: AI screenshot analysis attempted before cookie handling completes. ` +
      `Context: ${context}. ` +
      `Cookie status: ${cookieStatus}. ` +
      `AI analysis may only run after cookie handling completes.`
    )
  }
}

/**
 * INVARIANT: Diagnosis before preflight completes
 * 
 * Throws immediately if violated.
 */
export function assertPreflightCompletedBeforeDiagnosis(runId: string, context: string): void {
  const preflightStatus = getPreflightStatus(runId)
  const cookieStatus = getCookieStatus(runId)

  if (preflightStatus !== 'COMPLETED') {
    throw new Error(
      `INVARIANT VIOLATION: Diagnosis attempted before preflight completes. ` +
      `Context: ${context}. ` +
      `Preflight status: ${preflightStatus}. ` +
      `Cookie status: ${cookieStatus}. ` +
      `Diagnosis may only run after preflight phase completes.`
    )
  }

  if (cookieStatus !== 'COMPLETED') {
    throw new Error(
      `INVARIANT VIOLATION: Diagnosis attempted before cookie handling completes. ` +
      `Context: ${context}. ` +
      `Cookie status: ${cookieStatus}. ` +
      `Diagnosis may only run after cookie handling completes.`
    )
  }
}

/**
 * INVARIANT: IRL/self-healing/fallback during preflight
 * 
 * Throws immediately if violated.
 */
export function assertNoIRLDuringPreflight(runId: string, context: string): void {
  const preflightStatus = getPreflightStatus(runId)

  if (preflightStatus === 'IN_PROGRESS') {
    throw new Error(
      `INVARIANT VIOLATION: IRL/self-healing/fallback attempted during preflight. ` +
      `Context: ${context}. ` +
      `Preflight status: ${preflightStatus}. ` +
      `IRL, self-healing, and fallback logic are FORBIDDEN during preflight phase.`
    )
  }
}

/**
 * INVARIANT: Overlay dismissal outside preflight
 * 
 * Throws immediately if violated.
 */
export function assertNoOverlayDismissalOutsidePreflight(runId: string, context: string): void {
  const preflightStatus = getPreflightStatus(runId)

  if (preflightStatus === 'COMPLETED') {
    throw new Error(
      `INVARIANT VIOLATION: Overlay dismissal attempted outside preflight. ` +
      `Context: ${context}. ` +
      `Preflight status: ${preflightStatus}. ` +
      `All overlay dismissal must occur during preflight phase. ` +
      `Legacy overlay dismissal logic must be removed.`
    )
  }
}

/**
 * INVARIANT: Page state mutation before preflight completes
 * 
 * Throws immediately if violated.
 */
export function assertNoPageStateMutationBeforePreflight(runId: string, context: string): void {
  const preflightStatus = getPreflightStatus(runId)
  const cookieStatus = getCookieStatus(runId)

  if (preflightStatus !== 'COMPLETED' && preflightStatus !== 'IN_PROGRESS') {
    throw new Error(
      `INVARIANT VIOLATION: Page state mutation attempted before preflight starts. ` +
      `Context: ${context}. ` +
      `Preflight status: ${preflightStatus}. ` +
      `Cookie status: ${cookieStatus}. ` +
      `Page state mutations (clicks, typing, etc.) may only occur after preflight completes.`
    )
  }

  // Allow mutations during preflight (it needs to click buttons)
  // But not before preflight starts

}

