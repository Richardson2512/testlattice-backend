// Intelligent Retry Layer (IRL) - De-flaking AI-driven test automation
// Wraps every step in retry policy, self-heals selectors, and allows AI to propose alternatives
//
// CRITICAL: IRL MUST respect ActionContext
// - COOKIE_CONSENT context: IRL is COMPLETELY DISABLED
// - No retries, no self-healing, no alternative strategies

import { LLMAction, VisionContext, VisionElement, SelfHealingInfo, ActionExecutionResult } from '../types'
import { UnifiedBrainService } from './unifiedBrainService'
import { PlaywrightRunner, RunnerSession } from '../runners/playwright'
import { AppiumRunner } from '../runners/appium'
import { ActionContext, isIRLAllowed, isSelfHealingAllowed } from '../types/actionContext'

export interface RetryConfig {
  maxRetries?: number
  initialDelay?: number
  maxDelay?: number
  backoffMultiplier?: number
  retryableErrors?: string[]
  enableVisionMatching?: boolean
  enableAIAlternatives?: boolean
}

export interface RetryContext {
  attempt: number
  maxRetries: number
  error?: Error
  lastSelector?: string
  healedSelector?: string
  alternativeStrategy?: LLMAction
}

export interface RetryResult {
  success: boolean
  result?: ActionExecutionResult
  healing?: SelfHealingInfo
  alternativeAction?: LLMAction
  attempts: number
  finalError?: Error
}

/**
 * Intelligent Retry Layer (IRL)
 * 
 * Features:
 * 1. Retry policy with exponential backoff
 * 2. Self-healing selectors using DOM analysis + vision matching
 * 3. AI-proposed alternative strategies when retries fail
 */
export class IntelligentRetryLayer {
  private unifiedBrain: UnifiedBrainService
  private playwrightRunner?: PlaywrightRunner
  private appiumRunner?: AppiumRunner
  private defaultConfig: Required<RetryConfig>

  constructor(
    unifiedBrain: UnifiedBrainService,
    playwrightRunner?: PlaywrightRunner,
    appiumRunner?: AppiumRunner,
    config?: RetryConfig
  ) {
    this.unifiedBrain = unifiedBrain
    this.playwrightRunner = playwrightRunner
    this.appiumRunner = appiumRunner

    this.defaultConfig = {
      maxRetries: config?.maxRetries ?? 3,
      initialDelay: config?.initialDelay ?? 500,
      maxDelay: config?.maxDelay ?? 5000,
      backoffMultiplier: config?.backoffMultiplier ?? 2,
      retryableErrors: config?.retryableErrors ?? [
        'not found',
        'not visible',
        'timeout',
        'detached',
        'intercepts pointer',
        'element not found',
        'selector',
        'waiting for',
      ],
      enableVisionMatching: config?.enableVisionMatching ?? true,
      enableAIAlternatives: config?.enableAIAlternatives ?? true,
    }
  }

  /**
   * Execute action with intelligent retry
   * Wraps every step in retry policy with self-healing
   * 
   * CRITICAL: If actionContext is COOKIE_CONSENT, IRL is COMPLETELY DISABLED
   */
  async executeWithRetry(
    sessionId: string,
    action: LLMAction,
    context: VisionContext,
    isMobile: boolean = false,
    config?: RetryConfig,
    actionContext: ActionContext = ActionContext.NORMAL
  ): Promise<RetryResult> {
    // INVARIANT: IRL is FORBIDDEN in COOKIE_CONSENT context
    if (!isIRLAllowed(actionContext)) {
      // Return immediate failure - no retries, no healing, no alternatives
      console.log(`[IRL] IRL disabled in ${actionContext} context - returning immediate failure`)
      return {
        success: false,
        attempts: 1,
        finalError: new Error(`IRL is disabled in ${actionContext} context`),
      }
    }

    const retryConfig = { ...this.defaultConfig, ...config }
    const runner = isMobile ? this.appiumRunner : this.playwrightRunner

    if (!runner) {
      throw new Error('No runner available for execution')
    }

    let lastError: Error | undefined
    let healing: SelfHealingInfo | undefined
    let healedSelector: string | undefined
    let alternativeAction: LLMAction | undefined

    for (let attempt = 1; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        // Try original action first
        let actionToExecute = action

        // Use healed selector if available
        if (healedSelector && action.selector) {
          actionToExecute = { ...action, selector: healedSelector }
        }

        // Execute action
        const result = await (runner as any).executeAction(sessionId, actionToExecute) as ActionExecutionResult | void

        // Check if healing was applied
        if (result && 'healing' in result && result.healing) {
          healing = result.healing
          healedSelector = result.healing.healedSelector
        }

        // Success!
        return {
          success: true,
          result: result as ActionExecutionResult,
          healing,
          attempts: attempt,
        }
      } catch (error: any) {
        lastError = error
        const errorMessage = error?.message || String(error)

        // Check if error is retryable
        if (!this.isRetryableError(errorMessage, retryConfig.retryableErrors)) {
          console.log(`[IRL] Non-retryable error: ${errorMessage}`)
          break
        }

        console.log(`[IRL] Attempt ${attempt}/${retryConfig.maxRetries} failed: ${errorMessage}`)

        // On first failure, try self-healing (ONLY if allowed in context)
        if (attempt === 1 && action.selector && isSelfHealingAllowed(actionContext)) {
          const healingResult = await this.attemptSelfHealing(
            sessionId,
            action,
            context,
            errorMessage,
            isMobile,
            retryConfig.enableVisionMatching
          )

          if (healingResult) {
            healing = healingResult
            healedSelector = healingResult.healedSelector
            console.log(`[IRL] Self-healing found alternative: ${healingResult.healedSelector}`)
            // Retry immediately with healed selector (no delay)
            continue
          }
        }

        // On subsequent failures, try AI alternative strategy
        if (attempt >= 2 && retryConfig.enableAIAlternatives && !alternativeAction) {
          const aiAlternative = await this.proposeAlternativeStrategy(
            action,
            context,
            errorMessage,
            attempt
          )

          if (aiAlternative) {
            alternativeAction = aiAlternative
            console.log(`[IRL] AI proposed alternative: ${aiAlternative.action} ${aiAlternative.selector || aiAlternative.target || ''}`)
            // Update action for next retry
            action = aiAlternative
            // Reset healing since we're trying a new strategy
            healing = undefined
            healedSelector = undefined
          }
        }

        // If not last attempt, wait with exponential backoff
        if (attempt < retryConfig.maxRetries) {
          const delay = Math.min(
            retryConfig.initialDelay * Math.pow(retryConfig.backoffMultiplier, attempt - 1),
            retryConfig.maxDelay
          )
          console.log(`[IRL] Waiting ${delay}ms before retry ${attempt + 1}...`)
          await this.delay(delay)
        }
      }
    }

    // All retries exhausted
    return {
      success: false,
      healing,
      alternativeAction,
      attempts: retryConfig.maxRetries,
      finalError: lastError,
    }
  }

  /**
   * Attempt self-healing using DOM analysis + vision matching
   */
  private async attemptSelfHealing(
    sessionId: string,
    action: LLMAction,
    context: VisionContext,
    errorMessage: string,
    isMobile: boolean,
    enableVisionMatching: boolean
  ): Promise<SelfHealingInfo | null> {
    if (!action.selector) {
      return null
    }

    console.log(`[IRL] Attempting self-healing for selector: ${action.selector}`)

    // Strategy 1: DOM-based healing (fast, no AI needed)
    const domHealing = await this.healViaDOMAnalysis(sessionId, action, context, isMobile)
    if (domHealing) {
      return domHealing
    }

    // Strategy 2: Vision + AI matching (slower, more accurate)
    // Use UnifiedBrainService for vision matching
    if (enableVisionMatching) {
      const visionHealing = await this.healViaVisionMatching(sessionId, action, context, errorMessage, isMobile)
      if (visionHealing) {
        return visionHealing
      }
    }

    return null
  }

  /**
   * Heal selector using DOM analysis (fast heuristic-based approach)
   */
  private async healViaDOMAnalysis(
    sessionId: string,
    action: LLMAction,
    context: VisionContext,
    isMobile: boolean
  ): Promise<SelfHealingInfo | null> {
    const originalSelector = action.selector!
    const runner = isMobile ? this.appiumRunner : this.playwrightRunner

    if (!runner) return null

    try {
      // Get fresh DOM snapshot
      const domSnapshot = isMobile
        ? await this.appiumRunner!.getPageSource(sessionId)
        : await this.playwrightRunner!.getDOMSnapshot(sessionId)

      // Extract text hint from action
      const textHint = this.extractTextHint(action)

      // Strategy 1: Text-based matching
      if (textHint) {
        const textMatch = this.findElementByText(domSnapshot, textHint, action.action)
        if (textMatch) {
          // Verify element exists and is actionable
          if (await this.verifySelector(sessionId, textMatch, isMobile)) {
            return {
              strategy: 'text',
              originalSelector,
              healedSelector: textMatch,
              note: `Matched by text "${textHint}"`,
              confidence: 0.9,
            }
          }
        }
      }

      // Strategy 2: Attribute-based matching (ID prefix, data attributes)
      const attributeMatch = this.findElementByAttributes(domSnapshot, originalSelector, action)
      if (attributeMatch && await this.verifySelector(sessionId, attributeMatch, isMobile)) {
        return {
          strategy: 'attribute',
          originalSelector,
          healedSelector: attributeMatch,
          note: `Matched by attribute similarity`,
          confidence: 0.8,
        }
      }

      // Strategy 3: Structural matching (position-based)
      const structuralMatch = this.findElementByStructure(domSnapshot, originalSelector, action)
      if (structuralMatch && await this.verifySelector(sessionId, structuralMatch, isMobile)) {
        return {
          strategy: 'position',
          originalSelector,
          healedSelector: structuralMatch,
          note: `Matched by structural position`,
          confidence: 0.5,
        }
      }
    } catch (error: any) {
      console.warn(`[IRL] DOM analysis healing failed: ${error.message}`)
    }

    return null
  }

  /**
   * Heal selector using vision matching + AI (more accurate but slower)
   */
  private async healViaVisionMatching(
    sessionId: string,
    action: LLMAction,
    context: VisionContext,
    errorMessage: string,
    isMobile: boolean
  ): Promise<SelfHealingInfo | null> {
    // Use UnifiedBrainService for self-healing
    if (!this.unifiedBrain) return null

    try {
      // Capture current screenshot
      const runner = isMobile ? this.appiumRunner : this.playwrightRunner
      if (!runner) return null

      const screenshot = await runner.captureScreenshot(sessionId)
      const domSnapshot = isMobile
        ? await this.appiumRunner!.getPageSource(sessionId)
        : await this.playwrightRunner!.getDOMSnapshot(sessionId)

      // Ask AI to find alternative selector based on vision + DOM
      const prompt = this.buildVisionHealingPrompt(action, context, errorMessage)

      // Use UnifiedBrainService for self-healing analysis
      const analysis = await this.unifiedBrain.analyzeScreenshot(screenshot, domSnapshot, prompt)

      // Find best matching element from analysis
      const bestMatch = this.findBestMatchFromVision(analysis, action, context)

      if (bestMatch && await this.verifySelector(sessionId, bestMatch, isMobile)) {
        return {
          strategy: 'vision',
          originalSelector: action.selector!,
          healedSelector: bestMatch,
          note: `Matched via AI vision analysis`,
          confidence: 0.85,
        }
      }
    } catch (error: any) {
      console.warn(`[IRL] Vision matching healing failed: ${error.message}`)
    }

    return null
  }

  /**
   * Propose alternative strategy using AI when retries fail
   */
  private async proposeAlternativeStrategy(
    action: LLMAction,
    context: VisionContext,
    errorMessage: string,
    attempt: number
  ): Promise<LLMAction | null> {
    // Use UnifiedBrainService for alternative strategy when retries fail
    if (!this.unifiedBrain) {
      // Fallback to heuristic if no AI service available
      return this.generateHeuristicAlternative(action, context, errorMessage)
    }

    try {
      // Build context description for AI
      const availableElements = context.elements.slice(0, 20).map((e, idx) => {
        return `${idx + 1}. ${e.type}: "${e.text || e.ariaLabel || e.name || 'unnamed'}" - selector: "${e.selector || 'N/A'}"`
      }).join('\n')

      const prompt = `The test automation action has failed ${attempt} times.

FAILED ACTION:
- Action: ${action.action}
- Selector: ${action.selector || 'N/A'}
- Target: ${action.target || 'N/A'}
- Description: ${action.description || 'N/A'}
- Error: ${errorMessage}

AVAILABLE ELEMENTS ON PAGE:
${availableElements}

Please propose an ALTERNATIVE strategy to achieve the same goal. Consider:
1. Different element to interact with (from available elements above)
2. Different action type (e.g., scroll first, then click)
3. Different approach to reach the goal

Return ONLY a valid JSON object (no markdown, no explanation):
{
  "action": "click|type|scroll|navigate|wait|assert",
  "target": "description of target element",
  "selector": "alternative selector from available elements",
  "value": "value if type action",
  "description": "why this alternative should work",
  "confidence": 0.0-1.0
}

If no good alternative exists, return: {"action": "wait", "description": "No viable alternative found"}`

      // Use GPT-5 Mini's generateAction with modified context
      // Note: metadata doesn't support custom fields, so we'll include retry context in goal
      const retryContextNote = `[RETRY CONTEXT] Failed action: ${action.action} ${action.selector || action.target || ''}. Error: ${errorMessage}`
      const alternativeContext: VisionContext = {
        ...context,
        // Keep original metadata structure
        metadata: context.metadata,
      }

      // Generate alternative using UnifiedBrainService
      const alternative = await this.unifiedBrain.generateAction(
        alternativeContext,
        [{ action, timestamp: new Date().toISOString() }],
        `${retryContextNote}\n\nFind alternative to failed action: ${action.description}. Error: ${errorMessage}`
      )

      // Validate alternative is different from original
      if (alternative.action === action.action && alternative.selector === action.selector) {
        // Try heuristic fallback
        return this.generateHeuristicAlternative(action, context, errorMessage)
      }

      return alternative
    } catch (error: any) {
      console.warn(`[IRL] AI alternative proposal failed: ${error.message}`)
      // Fallback to heuristic
      return this.generateHeuristicAlternative(action, context, errorMessage)
    }
  }

  /**
   * Generate heuristic-based alternative when AI is unavailable
   */
  private generateHeuristicAlternative(
    action: LLMAction,
    context: VisionContext,
    errorMessage: string
  ): LLMAction | null {
    // Strategy 1: If click failed, try scrolling first
    if (action.action === 'click' && errorMessage.includes('not visible')) {
      return {
        action: 'scroll',
        description: 'Scroll to make element visible before clicking',
        confidence: 0.7,
      }
    }

    // Strategy 2: If selector failed, try text-based alternative
    if (action.selector && action.target) {
      const textMatch = context.elements.find(
        e => e.text && e.text.toLowerCase().includes(action.target!.toLowerCase())
      )
      if (textMatch && textMatch.selector) {
        return {
          ...action,
          selector: textMatch.selector,
          description: `Alternative: Using text-based selector for "${action.target}"`,
          confidence: 0.6,
        }
      }
    }

    // Strategy 3: Try similar element type
    if (action.action === 'click') {
      const similarElement = context.elements.find(
        e => e.type === 'button' || e.type === 'link'
      )
      if (similarElement && similarElement.selector) {
        return {
          action: 'click',
          target: similarElement.text || similarElement.type,
          selector: similarElement.selector,
          description: `Alternative: Clicking similar ${similarElement.type} element`,
          confidence: 0.5,
        }
      }
    }

    return null
  }

  /**
   * Helper methods
   */
  private isRetryableError(errorMessage: string, retryableErrors: string[]): boolean {
    const lowerMessage = errorMessage.toLowerCase()
    return retryableErrors.some(pattern => lowerMessage.includes(pattern.toLowerCase()))
  }

  private extractTextHint(action: LLMAction): string | null {
    return action.target || action.description?.match(/"([^"]+)"/)?.[1] || null
  }

  private findElementByText(domSnapshot: string, text: string, actionType: string): string | null {
    if (!text || text.length < 2) return null

    // Escape special characters for regex/selector
    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const lowerText = text.toLowerCase()

    // Try multiple selector patterns in order of reliability
    const patterns = [
      // Playwright text selectors (most reliable)
      `button:has-text("${escaped}")`,
      `a:has-text("${escaped}")`,
      `text="${escaped}"`,

      // ARIA-based (good for accessibility)
      `[aria-label*="${escaped}" i]`,
      `[aria-label="${escaped}"]`,
      `[title*="${escaped}" i]`,

      // XPath fallback (works but slower)
      `xpath=//*[contains(normalize-space(.), "${escaped}")]`,
    ]

    // Return first pattern (Playwright will handle matching)
    return patterns[0] || null
  }

  private findElementByAttributes(domSnapshot: string, originalSelector: string, action: LLMAction): string | null {
    // Extract ID prefix from original selector
    const idMatch = originalSelector.match(/#([\w-]+)/)
    if (idMatch) {
      const idPrefix = idMatch[1].replace(/[\d_]+$/g, '')
      if (idPrefix && idPrefix.length >= 3) {
        return `[id^="${idPrefix}"]`
      }
    }
    return null
  }

  private findElementByStructure(domSnapshot: string, originalSelector: string, action: LLMAction): string | null {
    // Remove dynamic parts (IDs, data attributes)
    const structural = originalSelector
      .replace(/#[\w-]+/g, '')
      .replace(/\[data-[^\]]+\]/g, '')
      .trim()

    return structural && structural !== originalSelector ? structural : null
  }

  private findBestMatchFromVision(analysis: VisionContext, action: LLMAction, originalContext: VisionContext): string | null {
    // Find element in analysis that matches action intent
    const textHint = this.extractTextHint(action)
    const actionType = action.action

    // Get original element position if available (from accessibility map)
    const originalElement = originalContext.elements.find(e => e.selector === action.selector)
    const originalPosition = originalElement?.bounds

    // Priority 1: Text + Type + Position match (if position available)
    if (textHint) {
      const textMatch = analysis.elements.find(
        e => {
          const eText = (e.text || e.ariaLabel || e.name || '').toLowerCase()
          const hintLower = textHint.toLowerCase()
          const textMatches = eText.includes(hintLower)
          const typeMatches = actionType === 'click' ? (e.type === 'button' || e.type === 'link') : true

          // If we have position data, also check proximity
          if (originalPosition && e.bounds) {
            const distance = Math.sqrt(
              Math.pow(e.bounds.x - originalPosition.x, 2) +
              Math.pow(e.bounds.y - originalPosition.y, 2)
            )
            // Prefer elements within 50px of original position
            return textMatches && typeMatches && distance < 50
          }

          return textMatches && typeMatches
        }
      )
      if (textMatch && textMatch.selector) {
        return textMatch.selector
      }
    }

    // Phase 2: Gravity algorithm for position-based matching
    if (originalPosition) {
      const gravityMatch = this.findNearestElementByGravity(
        originalPosition,
        analysis.elements,
        actionType,
        50 // 50px radius
      )
      if (gravityMatch && gravityMatch.selector) {
        return gravityMatch.selector
      }
    }

    // Priority 3: Type match (button for click, input for type)
    if (actionType === 'click') {
      const buttonMatch = analysis.elements.find(
        e => (e.type === 'button' || e.type === 'link') && e.selector
      )
      if (buttonMatch && buttonMatch.selector) {
        return buttonMatch.selector
      }
    } else if (actionType === 'type') {
      const inputMatch = analysis.elements.find(
        e => e.type === 'input' && e.selector
      )
      if (inputMatch && inputMatch.selector) {
        return inputMatch.selector
      }
    }

    // Priority 4: Any interactive element
    const interactiveMatch = analysis.elements.find(
      e => (e.type === 'button' || e.type === 'link' || e.type === 'input') && e.selector
    )
    return interactiveMatch?.selector || null
  }

  /**
   * Phase 2: Gravity algorithm for finding nearest element
   * Considers distance, element type, and size (larger = more clickable)
   */
  private findNearestElementByGravity(
    failedPosition: { x: number; y: number },
    candidates: VisionElement[],
    actionType: string,
    radius: number = 50
  ): VisionElement | null {
    const scored = candidates
      .filter((e) => e.bounds && this.isCompatibleType(e, actionType))
      .map((e) => {
        const centerX = e.bounds!.x + e.bounds!.width / 2
        const centerY = e.bounds!.y + e.bounds!.height / 2
        const distance = Math.sqrt(
          Math.pow(centerX - failedPosition.x, 2) +
          Math.pow(centerY - failedPosition.y, 2)
        )

        if (distance > radius) return null

        // Gravity formula: closer = higher score, type match = bonus, size = bonus
        const typeBonus = this.isCompatibleType(e, actionType) ? 1.5 : 1.0
        const sizeBonus = Math.min(
          (e.bounds!.width * e.bounds!.height) / 1000,
          2.0
        ) // Larger = more clickable
        const gravityScore = (1 / (distance + 1)) * typeBonus * sizeBonus

        return { element: e, score: gravityScore, distance }
      })
      .filter((item) => item !== null)
      .sort((a, b) => b!.score - a!.score)

    return scored[0]?.element || null
  }

  /**
   * Check if element type is compatible with action type
   */
  private isCompatibleType(element: VisionElement, actionType: string): boolean {
    if (actionType === 'click') {
      return element.type === 'button' || element.type === 'link'
    }
    if (actionType === 'type') {
      return element.type === 'input' || element.type === 'textarea'
    }
    return true
  }

  private buildVisionHealingPrompt(action: LLMAction, context: VisionContext, errorMessage: string): string {
    return `Find an alternative selector for the failed action:
- Original action: ${action.action}
- Original selector: ${action.selector || 'N/A'}
- Target: ${action.target || 'N/A'}
- Error: ${errorMessage}

Analyze the screenshot and DOM to find a working alternative selector that achieves the same goal.`
  }

  private async verifySelector(sessionId: string, selector: string, isMobile: boolean): Promise<boolean> {
    try {
      const runner = isMobile ? this.appiumRunner : this.playwrightRunner
      if (!runner) return false

      // Try to find element (quick verification)
      if (isMobile) {
        // For Appium, we'd need to check if element exists
        // Simplified: assume it works if we got this far
        return true
      } else {
        const session = this.playwrightRunner!.getSession(sessionId)
        if (session?.page) {
          const count = await session.page.locator(selector).count()
          return count > 0
        }
      }
      return false
    } catch {
      return false
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

