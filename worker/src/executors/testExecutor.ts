// TestExecutor: Handles action execution, error recovery, and session management
import { LLMAction, VisionContext, ActionExecutionResult, SelfHealingInfo } from '../types'
import { PlaywrightRunner } from '../runners/playwright'
import { AppiumRunner } from '../runners/appium'
import { IntelligentRetryLayer } from '../services/intelligentRetryLayer'
import { ActionContext, isIRLAllowed, isPageLevelFallbackAllowed } from '../types/actionContext'
import { assertNoIRLDuringPreflight } from '../services/preflightInvariants'

export interface ExecuteActionParams {
  sessionId: string
  action: LLMAction
  context: VisionContext
  isMobile: boolean
  enableIRL: boolean
  retryLayer?: IntelligentRetryLayer | null
  playwrightRunner?: PlaywrightRunner
  appiumRunner?: AppiumRunner
  runId: string
  browserType: 'chromium' | 'firefox' | 'webkit'
  stepNumber: number
  actionContext?: ActionContext // CRITICAL: Enforces control-flow invariants
}

export interface ExecuteActionResult {
  result: ActionExecutionResult | void
  healing: SelfHealingInfo | undefined
}

export interface CaptureStateResult {
  screenshot: string
  domSnapshot: string
}

export interface CaptureElementBoundsResult {
  elementBounds: Array<{
    selector: string
    bounds: { x: number; y: number; width: number; height: number }
    type: string
    text?: string
    interactionType?: 'clicked' | 'typed' | 'analyzed' | 'failed' | 'healed'
  }>
  targetElementBounds?: {
    selector: string
    bounds: { x: number; y: number; width: number; height: number }
    interactionType: 'clicked' | 'typed' | 'analyzed' | 'failed' | 'healed'
  }
}

export class TestExecutor {
  constructor(
    private playwrightRunner: PlaywrightRunner,
    private appiumRunner: AppiumRunner | null,
    private retryLayer: IntelligentRetryLayer | null
  ) {}

  /**
   * Execute an action with Intelligent Retry Layer (IRL) if enabled
   */
  async executeAction(params: ExecuteActionParams): Promise<ExecuteActionResult> {
    const {
      sessionId,
      action,
      context,
      isMobile,
      enableIRL,
      retryLayer,
      playwrightRunner,
      appiumRunner,
      runId,
      browserType,
      stepNumber
    } = params

    const runner = isMobile ? (appiumRunner || params.appiumRunner) : playwrightRunner
    if (isMobile && !runner) {
      throw new Error('Appium runner is required for mobile tests but is not available')
    }
    let executionResult: ActionExecutionResult | void
    let healingMeta: SelfHealingInfo | undefined

    // HARD INVARIANT: IRL/self-healing/fallback forbidden during preflight
    assertNoIRLDuringPreflight(runId, 'TestExecutor.executeAction')

    // Use IRL for retry + self-healing if available and enabled
    // CRITICAL: IRL is FORBIDDEN in COOKIE_CONSENT context and during PREFLIGHT
    const actionContext = params.actionContext || ActionContext.NORMAL
    const irlAllowed = isIRLAllowed(actionContext)
    
    if (enableIRL && retryLayer && irlAllowed && (action.action === 'click' || action.action === 'type' || action.action === 'assert')) {
      const retryResult = await retryLayer.executeWithRetry(
        sessionId,
        action,
        context,
        isMobile,
        {
          maxRetries: 3,
          enableVisionMatching: true,
          enableAIAlternatives: true,
        },
        actionContext // Pass context to IRL
      )

      if (retryResult.success && retryResult.result) {
        executionResult = retryResult.result
        healingMeta = retryResult.healing

        // If AI proposed alternative, log it
        if (retryResult.alternativeAction) {
          console.log(`[${runId}] [${browserType.toUpperCase()}] Step ${stepNumber}: IRL used AI alternative: ${retryResult.alternativeAction.action} ${retryResult.alternativeAction.selector || retryResult.alternativeAction.target || ''}`)
        }

        if (retryResult.attempts > 1) {
          console.log(`[${runId}] [${browserType.toUpperCase()}] Step ${stepNumber}: IRL succeeded after ${retryResult.attempts} attempts`)
        }
      } else {
        // IRL failed, throw error to be caught by outer try-catch
        throw retryResult.finalError || new Error(`IRL retry exhausted after ${retryResult.attempts} attempts`)
      }
    } else {
      // Fallback to direct execution for non-retryable actions
      executionResult = await (runner as any).executeAction(sessionId, action) as ActionExecutionResult | void
      healingMeta = executionResult?.healing
    }

    return {
      result: executionResult,
      healing: healingMeta,
    }
  }

  /**
   * Capture current page state (screenshot and DOM snapshot)
   */
  async captureState(sessionId: string, isMobile: boolean): Promise<CaptureStateResult> {
    if (isMobile && !this.appiumRunner) {
      throw new Error('Appium runner is required for mobile tests but is not available')
    }
    const runner = isMobile ? this.appiumRunner! : this.playwrightRunner
    const screenshot = await runner.captureScreenshot(sessionId)
    const domSnapshot = await (isMobile
      ? this.appiumRunner!.getPageSource(sessionId)
      : this.playwrightRunner.getDOMSnapshot(sessionId))

    return {
      screenshot,
      domSnapshot,
    }
  }

  /**
   * Dismiss overlays/popups before action execution
   * 
   * DEPRECATED: This method contained cookie bypass logic and has been removed.
   * Cookie handling is now exclusively handled by CookieBannerHandler.
   * Non-cookie popups are handled by NonCookiePopupHandler.
   * 
   * This method is kept for backward compatibility but always returns false.
   */
  async dismissOverlays(
    sessionId: string,
    isMobile: boolean,
    runId: string,
    browserType: 'chromium' | 'firefox' | 'webkit',
    stepNumber: number
  ): Promise<boolean> {
    // Cookie handling bypass removed - always return false
    // Cookie handling must go through CookieBannerHandler
    // Non-cookie popups must go through NonCookiePopupHandler
    return false
  }

  /**
   * Capture element bounds for Iron Man HUD visual annotations
   */
  async captureElementBounds(
    sessionId: string,
    isMobile: boolean,
    action: LLMAction | null,
    healing?: SelfHealingInfo
  ): Promise<CaptureElementBoundsResult> {
    if (isMobile || !this.playwrightRunner) {
      return { elementBounds: [] }
    }

    try {
      const elementBounds = await this.playwrightRunner.captureElementBounds(sessionId)

      // Mark the target element based on the action
      let targetElementBounds: CaptureElementBoundsResult['targetElementBounds'] | undefined
      if (action && action.selector && elementBounds.length > 0) {
        const targetSelector = action.selector
        const targetElement = elementBounds.find(e => e.selector === targetSelector)
        if (targetElement) {
          let interactionType: 'clicked' | 'typed' | 'analyzed' | 'failed' | 'healed' = 'analyzed'
          if (healing) {
            interactionType = 'healed'
          } else if (action.action === 'click') {
            interactionType = 'clicked'
          } else if (action.action === 'type') {
            interactionType = 'typed'
          }

          targetElement.interactionType = interactionType
          targetElementBounds = {
            selector: targetElement.selector,
            bounds: targetElement.bounds,
            interactionType,
          }
        }
      }

      return {
        elementBounds,
        targetElementBounds,
      }
    } catch (boundsError: any) {
      console.warn(`Failed to capture element bounds:`, boundsError.message)
      return { elementBounds: [] }
    }
  }

  /**
   * Attempt to recover from consecutive errors
   * Enhanced with multiple recovery strategies
   */
  async recoverFromErrors(
    sessionId: string,
    isMobile: boolean,
    buildUrl: string | undefined,
    runId: string,
    browserType: 'chromium' | 'firefox' | 'webkit',
    recentErrors: number
  ): Promise<boolean> {
    if (isMobile && !this.appiumRunner) {
      return false // Can't recover mobile tests without Appium
    }
    const runner = isMobile ? this.appiumRunner! : this.playwrightRunner

    // Strategy 1: Wait for page to stabilize (sometimes elements load late)
    if (recentErrors >= 2) {
      try {
        console.log(`[${runId}] [${browserType.toUpperCase()}] Recovery: Waiting for page to stabilize...`)
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // Check if page is still loading
        if (!isMobile && this.playwrightRunner) {
          const session = this.playwrightRunner.getSession(sessionId)
          if (session?.page) {
            await session.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
            console.log(`[${runId}] [${browserType.toUpperCase()}] Recovery: Page stabilized`)
            return true
          }
        }
      } catch (waitError: any) {
        console.warn(`[${runId}] [${browserType.toUpperCase()}] Recovery wait failed:`, waitError.message)
      }
    }

    // Strategy 2: Scroll to find new elements
    if (recentErrors >= 3) {
      try {
        await runner.executeAction(sessionId, {
          action: 'scroll',
          description: 'Scroll to find new interactive elements',
          confidence: 0.8,
        })
        await new Promise(resolve => setTimeout(resolve, 1000))
        console.log(`[${runId}] [${browserType.toUpperCase()}] Recovery: Scrolled successfully`)
        return true
      } catch (scrollError: any) {
        console.warn(`[${runId}] [${browserType.toUpperCase()}] Recovery scroll failed:`, scrollError.message)
      }
    }

    // Strategy 3: Cookie handling bypass removed
    // Recovery no longer attempts to dismiss overlays
    // Cookie handling must go through CookieBannerHandler
    // Non-cookie popups must go through NonCookiePopupHandler

    // Strategy 4: Try navigating back or refreshing
    if (recentErrors >= 5) {
      try {
        const currentUrl = await (isMobile
          ? this.appiumRunner!.getCurrentUrl(sessionId).catch(() => buildUrl || '')
          : this.playwrightRunner.getCurrentUrl(sessionId).catch(() => buildUrl || ''))

        // Try navigating to a different page or refreshing
        if (currentUrl && currentUrl !== buildUrl) {
          console.log(`[${runId}] [${browserType.toUpperCase()}] Recovery: Attempting to navigate to a different page`)
          await runner.executeAction(sessionId, {
            action: 'navigate',
            value: buildUrl || currentUrl,
            description: 'Navigate to recover from errors',
            confidence: 0.7,
          })
          await new Promise(resolve => setTimeout(resolve, 2000))
          return true
        } else if (currentUrl) {
          // Try page reload
          if (!isMobile && this.playwrightRunner) {
            const session = this.playwrightRunner.getSession(sessionId)
            if (session?.page) {
              console.log(`[${runId}] [${browserType.toUpperCase()}] Recovery: Reloading page`)
              await session.page.reload({ waitUntil: 'networkidle', timeout: 10000 }).catch(() => {})
              await new Promise(resolve => setTimeout(resolve, 2000))
              return true
            }
          }
        }
      } catch (navError: any) {
        console.warn(`[${runId}] [${browserType.toUpperCase()}] Recovery navigation failed:`, navError.message)
      }
    }

    // Strategy 5: Check for element visibility issues
    if (recentErrors >= 6 && !isMobile && this.playwrightRunner) {
      try {
        const session = this.playwrightRunner.getSession(sessionId)
        if (session?.page) {
          // Check if any elements are hidden or not in viewport
          const visibleElements = await session.page.evaluate(() => {
            const allElements = document.querySelectorAll('button, a, input, select, textarea, [role="button"]')
            return Array.from(allElements)
              .filter(el => {
                const rect = el.getBoundingClientRect()
                const style = window.getComputedStyle(el)
                return style.display !== 'none' &&
                       style.visibility !== 'hidden' &&
                       rect.width > 0 &&
                       rect.height > 0 &&
                       rect.top >= 0 &&
                       rect.left >= 0 &&
                       rect.bottom <= window.innerHeight &&
                       rect.right <= window.innerWidth
              })
              .length
          })
          
          if (visibleElements === 0) {
            console.log(`[${runId}] [${browserType.toUpperCase()}] Recovery: No visible elements found, scrolling to top`)
            await runner.executeAction(sessionId, {
              action: 'scroll',
              description: 'Scroll to top to find elements',
              confidence: 0.8,
            })
            await new Promise(resolve => setTimeout(resolve, 1000))
            return true
          }
        }
      } catch (visibilityError: any) {
        console.warn(`[${runId}] [${browserType.toUpperCase()}] Recovery visibility check failed:`, visibilityError.message)
      }
    }

    return false
  }
}

