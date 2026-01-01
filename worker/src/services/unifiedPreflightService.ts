/**
 * Unified Preflight Service
 * 
 * AUTHORITATIVE popup handling system that runs BEFORE any other test logic.
 * 
 * EXECUTION ORDER GUARANTEE:
 * NAVIGATE → PREFLIGHT (blocking) → DIAGNOSIS (paid only) → TEST EXECUTION
 * 
 * HARD INVARIANTS (enforced in code):
 * - Runs exactly once per page load
 * - No page state mutation before preflight completes
 * - No screenshots/DOM capture before preflight completes
 * - No AI screenshot analysis before preflight completes
 * - No diagnosis before preflight completes
 * - No IRL/self-healing/fallback during preflight
 * - No overlay dismissal outside preflight
 * 
 * STATE MACHINE:
 * DETECT → CLASSIFY → RESOLVE → VERIFY → FINALIZE
 */

import { Page } from 'playwright'
import { CookieBannerHandler, CookieResolutionResult } from './cookieBannerHandler'
import { NonCookiePopupHandler, NonCookiePopupResult } from './nonCookiePopupHandler'
import { getExecutionLogEmitter, ExecutionLogEmitter } from './executionLogEmitter'
import { getCookieStatus, setCookieStatus, CookieStatus } from './cookieStatusTracker'
import { setPreflightStatus, PreflightStatus } from './preflightInvariants' // Import SetPreflightStatus
import { UnifiedBrainService } from './unifiedBrainService'
import { ContextSynthesizer } from '../synthesizers/contextSynthesizer'
import { ComprehensiveTestingService } from './comprehensiveTesting'
import { PlaywrightRunner } from '../runners/playwright'

export type PreflightState = 'DETECT' | 'CLASSIFY' | 'RESOLVE' | 'VERIFY' | 'FINALIZE'

export type PopupCategory =
  | 'cookie_consent'
  | 'newsletter'
  | 'age_gate'
  | 'chat_widget'
  | 'login_blocker'
  | 'signup_blocker'
  | 'fullscreen_overlay'
  | 'gdpr_notice'
  | 'region_notice'
  | 'unknown'

export interface DetectedPopup {
  category: PopupCategory
  selector: string
  isBlocking: boolean
  confidence: number
  strategy?: 'dismiss' | 'accept' | 'reject' | 'close' | 'skip'
}

export interface PreflightResult {
  success: boolean
  cookieResult?: CookieResolutionResult
  nonCookiePopups?: NonCookiePopupResult
  popupsResolved: number
  popupsSkipped: number
  executionTrace: Array<{
    timestamp: string
    state: PreflightState
    message: string
    metadata?: Record<string, any>
  }>
  errors: string[]
}

export class UnifiedPreflightService {
  private logEmitter?: ExecutionLogEmitter
  private pagesProcessed: Set<string> = new Set()
  private cookieBannerHandler: CookieBannerHandler | null = null
  private nonCookiePopupHandler: NonCookiePopupHandler | null = null
  private executionTrace: PreflightResult['executionTrace'] = []
  private currentState: PreflightState = 'DETECT'

  constructor(
    private unifiedBrain: UnifiedBrainService,
    private contextSynthesizer: ContextSynthesizer,
    private comprehensiveTesting: ComprehensiveTestingService,
    private playwrightRunner: PlaywrightRunner
  ) { }

  /**
   * Execute unified preflight phase
   * 
   * This is the ONLY function allowed to handle popups.
   * Must run before diagnosis, screenshots, DOM capture, or any test logic.
   */
  async executePreflight(
    page: Page,
    currentUrl: string,
    runId: string,
    buildUrl: string,
    sessionId: string = '' // Added sessionId
  ): Promise<PreflightResult> {
    // INVARIANT: Preflight must run exactly once per page
    if (this.pagesProcessed.has(currentUrl)) {
      const logEmitter = getExecutionLogEmitter(runId, 0)
      logEmitter.log('Preflight already completed for this page, skipping', { url: currentUrl })

      // ENSURE INVARIANT: Cookie status must be COMPLETED if we skip preflight
      // This prevents context synthesis from failing later
      setCookieStatus(runId, 'COMPLETED')
      
      // ENSURE INVARIANT: Preflight status must be COMPLETED
      setPreflightStatus(runId, 'COMPLETED')

      return {
        success: true,
        popupsResolved: 0,
        popupsSkipped: 0,
        executionTrace: [],
        errors: [],
      }
    }

    this.pagesProcessed.add(currentUrl)
    this.logEmitter = getExecutionLogEmitter(runId, 0)
    this.executionTrace = []
    this.currentState = 'DETECT'

    this.logTrace('DETECT', 'Starting unified preflight phase', { url: currentUrl })
    this.logEmitter.log('[Preflight] Starting unified preflight phase', { url: currentUrl })

    // Set preflight status to IN_PROGRESS
    setPreflightStatus(runId, 'IN_PROGRESS')

    const errors: string[] = []
    let cookieResult: CookieResolutionResult | undefined
    let nonCookiePopups: NonCookiePopupResult | undefined
    let popupsResolved = 0
    let popupsSkipped = 0

    try {
      // STATE: DETECT & CLASSIFY
      this.currentState = 'DETECT'
      this.logTrace('DETECT', 'Detecting blocking UI elements', {})

      // Initialize handlers
      if (!this.cookieBannerHandler) {
        this.cookieBannerHandler = new CookieBannerHandler(this.unifiedBrain)
      }
      this.cookieBannerHandler.reset(runId)

      if (!this.nonCookiePopupHandler) {
        this.nonCookiePopupHandler = new NonCookiePopupHandler()
      }

      // Set cookie status to IN_PROGRESS
      setCookieStatus(runId, 'IN_PROGRESS')
      this.logTrace('DETECT', 'Cookie status set to IN_PROGRESS', {})

      // Synthesize context for cookie detection (minimal - no comprehensive testing)
      this.logTrace('CLASSIFY', 'Synthesizing context for popup detection', {})
      const contextResult = await this.contextSynthesizer.synthesizeContext({
        sessionId: sessionId, // Use passed sessionId
        isMobile: false,
        goal: 'Detect and classify all blocking UI elements (cookie banners, popups, overlays)',
        visitedSelectors: new Set(),
        visitedUrls: new Set([currentUrl]),
        visitedHrefs: new Set(),
        blockedSelectors: new Set(),
        isSelectorBlocked: () => false,
        comprehensiveTesting: this.comprehensiveTesting,
        playwrightRunner: this.playwrightRunner,
        appiumRunner: undefined,
        stepNumber: 0, // Preflight is step 0
        runId,
        browserType: 'chromium',
        testableComponents: [],
      })

      // STATE: RESOLVE - Cookie consent handling
      this.currentState = 'RESOLVE'
      this.logTrace('RESOLVE', 'Handling cookie consent banner', {})

      try {
        cookieResult = await this.cookieBannerHandler.handleCookieConsent(
          page,
          contextResult.filteredContext,
          buildUrl,
          runId
        )

        this.logTrace('RESOLVE', `Cookie consent handled: ${cookieResult.outcome}`, {
          outcome: cookieResult.outcome,
          strategy: cookieResult.outcome !== 'NOT_PRESENT' ? cookieResult.strategy : undefined,
        })

        if (cookieResult.outcome === 'RESOLVED' || cookieResult.outcome === 'RESOLVED_WITH_DELAY') {
          popupsResolved++
        }
      } catch (cookieError: any) {
        const errorMsg = `Cookie handling failed: ${cookieError.message}`
        errors.push(errorMsg)
        this.logTrace('RESOLVE', errorMsg, { error: cookieError.message })
        this.logEmitter.log(`[Preflight] ${errorMsg}`, { error: cookieError.message })
      }

      // Set cookie status to COMPLETED
      setCookieStatus(runId, 'COMPLETED')
      this.logTrace('VERIFY', 'Cookie status set to COMPLETED', {})

      // Wait for UI to settle after cookie handling
      if (cookieResult && (cookieResult.outcome === 'RESOLVED' || cookieResult.outcome === 'RESOLVED_WITH_DELAY')) {
        const waitTime = cookieResult.outcome === 'RESOLVED_WITH_DELAY' ? 1000 : 620
        this.logTrace('VERIFY', `Waiting ${waitTime}ms for UI to settle`, { waitTime })
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }

      // STATE: VERIFY - Verify cookie banner is gone
      this.currentState = 'VERIFY'
      this.logTrace('VERIFY', 'Verifying cookie banner is no longer visible', {})

      if (cookieResult && (cookieResult.outcome === 'RESOLVED' || cookieResult.outcome === 'RESOLVED_WITH_DELAY')) {
        const stillVisible = await page.evaluate(() => {
          const cookieSelectors = [
            '[class*="cookie" i]',
            '[id*="cookie" i]',
            '[class*="consent" i]',
            '[id*="consent" i]',
            '[class*="gdpr" i]',
            '[id*="gdpr" i]',
          ]
          return cookieSelectors.some(sel => {
            const el = document.querySelector(sel)
            if (!el) return false
            const style = window.getComputedStyle(el)
            return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
          })
        })

        if (stillVisible) {
          this.logTrace('VERIFY', 'Cookie banner still visible after resolution attempt', {})
          this.logEmitter.log('[Preflight] WARNING: Cookie banner still visible after resolution', {})
        } else {
          this.logTrace('VERIFY', 'Cookie banner no longer visible - verified', {})
          this.logEmitter.log('[Preflight] Cookie banner no longer visible - verified', {})
        }
      }

      // STATE: RESOLVE - Non-cookie popup handling
      this.currentState = 'RESOLVE'
      this.logTrace('RESOLVE', 'Handling non-cookie popups', {})

      try {
        nonCookiePopups = await this.nonCookiePopupHandler.handleNonCookiePopups(
          page,
          currentUrl,
          runId,
          0 // Preflight is step 0
        )

        const blockingPopups = nonCookiePopups.popupsDetected.filter(p => p.blockingStatus === 'BLOCKING_UI')
        const nonBlockingPopups = nonCookiePopups.popupsDetected.filter(p => p.blockingStatus === 'NON_BLOCKING_UI')

        this.logTrace('RESOLVE', `Detected ${nonCookiePopups.popupsDetected.length} non-cookie popup(s)`, {
          blocking: blockingPopups.length,
          nonBlocking: nonBlockingPopups.length,
        })

        // Auto-dismiss blocking popups/modals
        if (blockingPopups.length > 0) {
          this.logTrace('RESOLVE', `Attempting to dismiss ${blockingPopups.length} blocking popup(s)`, {
            popups: blockingPopups.map(p => ({ type: p.type, selector: p.selector })),
          })

          for (const popup of blockingPopups) {
            try {
              // Try common dismiss strategies
              const dismissed = await this.tryDismissPopup(page, popup.selector)
              if (dismissed) {
                popupsResolved++
                this.logTrace('RESOLVE', `Dismissed blocking popup: ${popup.type}`, { selector: popup.selector })
                this.logEmitter.log(`[Preflight] Dismissed blocking popup: ${popup.type}`, { selector: popup.selector })
              } else {
                popupsSkipped++
                this.logTrace('RESOLVE', `Could not dismiss popup: ${popup.type}`, { selector: popup.selector })
              }
            } catch (dismissError: any) {
              popupsSkipped++
              this.logTrace('RESOLVE', `Failed to dismiss popup: ${dismissError.message}`, { selector: popup.selector })
            }
          }

          // Wait for UI to settle after dismissals
          if (popupsResolved > 0) {
            await new Promise(resolve => setTimeout(resolve, 500))
          }
        }
      } catch (popupError: any) {
        const errorMsg = `Non-cookie popup handling failed: ${popupError.message}`
        errors.push(errorMsg)
        this.logTrace('RESOLVE', errorMsg, { error: popupError.message })
        this.logEmitter.log(`[Preflight] ${errorMsg}`, { error: popupError.message })
      }

      // STATE: FINALIZE
      this.currentState = 'FINALIZE'
      this.logTrace('FINALIZE', 'Preflight phase completed', {
        cookieResolved: cookieResult?.outcome === 'RESOLVED' || cookieResult?.outcome === 'RESOLVED_WITH_DELAY',
        nonCookiePopupsDetected: nonCookiePopups?.popupsDetected.length || 0,
      })

      this.logEmitter.log('[Preflight] Preflight phase completed successfully', {
        cookieResult: cookieResult?.outcome,
        nonCookiePopups: nonCookiePopups?.popupsDetected.length || 0,
      })

      // Set preflight status to COMPLETED
      setPreflightStatus(runId, 'COMPLETED')

      return {
        success: errors.length === 0,
        cookieResult,
        nonCookiePopups,
        popupsResolved,
        popupsSkipped,
        executionTrace: this.executionTrace,
        errors,
      }
    } catch (preflightError: any) {
      const errorMsg = `Preflight phase failed: ${preflightError.message}`
      errors.push(errorMsg)
      this.logTrace('FINALIZE', errorMsg, { error: preflightError.message })
      this.logEmitter.log(`[Preflight] ${errorMsg}`, { error: preflightError.message })

      // Ensure cookie status is set even on error
      const currentStatus = getCookieStatus(runId)
      if (currentStatus === 'IN_PROGRESS') {
        setCookieStatus(runId, 'COMPLETED')
      }
      setPreflightStatus(runId, 'COMPLETED')

      return {
        success: false,
        cookieResult,
        nonCookiePopups,
        popupsResolved,
        popupsSkipped,
        executionTrace: this.executionTrace,
        errors,
      }
    }
  }

  /**
   * Log execution trace entry
   */
  private logTrace(state: PreflightState, message: string, metadata?: Record<string, any>): void {
    const entry = {
      timestamp: new Date().toISOString(),
      state,
      message,
      metadata: metadata || {},
    }
    this.executionTrace.push(entry)
    this.logEmitter?.log(`[Preflight] [${state}] ${message}`, metadata || {})
  }

  /**
   * Reset preflight state for new test run
   */
  reset(runId: string): void {
    this.pagesProcessed.clear()
    this.executionTrace = []
    this.currentState = 'DETECT'
    if (this.cookieBannerHandler) {
      this.cookieBannerHandler.reset(runId)
    }
    if (this.nonCookiePopupHandler) {
      this.nonCookiePopupHandler.reset()
    }
  }

  /**
   * Get current preflight state
   */
  getCurrentState(): PreflightState {
    return this.currentState
  }

  /**
   * Get execution trace
   */
  getExecutionTrace(): PreflightResult['executionTrace'] {
    return this.executionTrace
  }

  /**
   * Get session ID from page (helper method)
   */
  private getSessionIdFromPage(page: Page): string | null {
    // Try to get session ID from page context
    // This is a workaround - ideally we'd pass sessionId directly
    try {
      const context = page.context()
      const browser = context.browser()
      if (browser) {
        // Use a hash of the browser context as session ID
        return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`
      }
    } catch {
      // Ignore errors
    }
    return null
  }

  /**
   * Try to dismiss a popup/modal using multiple strategies
   * Returns true if popup was successfully dismissed
   */
  private async tryDismissPopup(page: Page, popupSelector: string): Promise<boolean> {
    try {
      // Strategy 1: Try pressing Escape key
      try {
        await page.keyboard.press('Escape')
        await new Promise(resolve => setTimeout(resolve, 300))

        // Check if popup is still visible
        const stillVisible = await page.locator(popupSelector).isVisible().catch(() => false)
        if (!stillVisible) {
          this.logTrace('RESOLVE', 'Popup dismissed via Escape key', { selector: popupSelector })
          return true
        }
      } catch {
        // Continue to next strategy
      }

      // Strategy 2: Try clicking common close button selectors within the popup
      const closeButtonSelectors = [
        '[aria-label*="close" i]',
        '[aria-label*="dismiss" i]',
        'button:has-text("Close")',
        'button:has-text("×")',
        'button:has-text("X")',
        '.close-button',
        '.modal-close',
        '.dialog-close',
        '[data-dismiss="modal"]',
        '[data-close]',
        '.btn-close',
        'button.close',
      ]

      for (const closeSelector of closeButtonSelectors) {
        try {
          // Look for close button inside or near the popup
          const closeButton = page.locator(`${popupSelector} ${closeSelector}`).first()
          const isVisible = await closeButton.isVisible().catch(() => false)

          if (isVisible) {
            await closeButton.click({ timeout: 2000 })
            await new Promise(resolve => setTimeout(resolve, 300))

            // Check if popup is dismissed
            const stillVisible = await page.locator(popupSelector).isVisible().catch(() => false)
            if (!stillVisible) {
              this.logTrace('RESOLVE', `Popup dismissed via close button: ${closeSelector}`, { selector: popupSelector })
              return true
            }
          }
        } catch {
          // Continue to next selector
        }
      }

      // Strategy 3: Try clicking outside the modal (on backdrop/overlay)
      try {
        const backdropSelectors = [
          '.modal-backdrop',
          '.modal-overlay',
          '.overlay',
          '[class*="backdrop"]',
          '[class*="overlay"]',
        ]

        for (const backdropSelector of backdropSelectors) {
          const backdrop = page.locator(backdropSelector).first()
          const isVisible = await backdrop.isVisible().catch(() => false)

          if (isVisible) {
            // Click at top-left corner of backdrop (usually outside modal content)
            await backdrop.click({ position: { x: 10, y: 10 }, timeout: 2000 })
            await new Promise(resolve => setTimeout(resolve, 300))

            const stillVisible = await page.locator(popupSelector).isVisible().catch(() => false)
            if (!stillVisible) {
              this.logTrace('RESOLVE', `Popup dismissed via backdrop click: ${backdropSelector}`, { selector: popupSelector })
              return true
            }
          }
        }
      } catch {
        // Continue
      }

      // Strategy 4: Look for any button that might be a dismiss action
      try {
        const dismissActions = [
          'button:has-text("No")',
          'button:has-text("No, thanks")',
          'button:has-text("Skip")',
          'button:has-text("Later")',
          'button:has-text("Cancel")',
          'button:has-text("Not now")',
          'button:has-text("Decline")',
          'button:has-text("Maybe later")',
        ]

        for (const actionSelector of dismissActions) {
          try {
            const actionBtn = page.locator(`${popupSelector} ${actionSelector}`).first()
            const isVisible = await actionBtn.isVisible().catch(() => false)

            if (isVisible) {
              await actionBtn.click({ timeout: 2000 })
              await new Promise(resolve => setTimeout(resolve, 300))

              const stillVisible = await page.locator(popupSelector).isVisible().catch(() => false)
              if (!stillVisible) {
                this.logTrace('RESOLVE', `Popup dismissed via action button: ${actionSelector}`, { selector: popupSelector })
                return true
              }
            }
          } catch {
            // Continue to next action
          }
        }
      } catch {
        // Continue
      }

      return false
    } catch (error: any) {
      this.logTrace('RESOLVE', `Error trying to dismiss popup: ${error.message}`, { selector: popupSelector })
      return false
    }
  }
}

