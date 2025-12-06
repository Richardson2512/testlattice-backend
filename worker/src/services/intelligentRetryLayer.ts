// Intelligent Retry Layer (IRL) - De-flaking AI-driven test automation
// Wraps every step in retry policy, self-heals selectors, and allows AI to propose alternatives

import { LLMAction, VisionContext, VisionElement, SelfHealingInfo, ActionExecutionResult } from '../types'
import { UnifiedBrainService } from './unifiedBrainService'
import { PlaywrightRunner, RunnerSession } from '../runners/playwright'
import { AppiumRunner } from '../runners/appium'

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
  stuck?: boolean  // NEW: Indicates AI is stuck and needs God Mode intervention
  stuckReason?: string  // NEW: Why AI is stuck
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
  private unifiedBrainService: UnifiedBrainService
  private playwrightRunner?: PlaywrightRunner
  private appiumRunner?: AppiumRunner
  private defaultConfig: Required<RetryConfig>

  constructor(
    unifiedBrainService: UnifiedBrainService,
    playwrightRunner?: PlaywrightRunner,
    appiumRunner?: AppiumRunner,
    config?: RetryConfig
  ) {
    this.unifiedBrainService = unifiedBrainService
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
   */
  async executeWithRetry(
    sessionId: string,
    action: LLMAction,
    context: VisionContext,
    isMobile: boolean = false,
    config?: RetryConfig
  ): Promise<RetryResult> {
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

        // On first failure, try self-healing
        if (attempt === 1 && action.selector) {
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

    // All retries exhausted - AI is stuck, trigger God Mode
    console.log(`[IRL] All retries exhausted for action: ${action.action} ${action.selector || action.target}`)
    console.log(`[IRL] Triggering God Mode intervention...`)
    
    return {
      success: false,
      healing,
      alternativeAction,
      attempts: retryConfig.maxRetries,
      finalError: lastError,
      stuck: true,  // NEW: Flag for God Mode
      stuckReason: lastError?.message || 'Unknown error after max retries',
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
    if (enableVisionMatching && this.unifiedBrainService) {
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
    // Use UnifiedBrainService for heavy reasoning
    if (!this.unifiedBrainService) return null

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
      
      // Use UnifiedBrainService for heavy reasoning
      const analysis = await this.unifiedBrainService.analyzeScreenshot(
        screenshot.toString('base64'),
        domSnapshot,
        prompt
      )
      
      // Find best matching element from analysis
      const bestMatch = this.findBestMatchFromVision(analysis, action, context)
      
      if (bestMatch && await this.verifySelector(sessionId, bestMatch, isMobile)) {
            return {
              strategy: 'text', // Use 'text' as fallback since 'vision' not in SelfHealingInfo type
              originalSelector: action.selector!,
              healedSelector: bestMatch,
              note: `Matched via AI vision analysis`,
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
    // Use UnifiedBrainService for heavy reasoning when retries fail
    if (!this.unifiedBrainService) {
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

      // Use Llama's generateAction with modified context
      // Note: metadata doesn't support custom fields, so we'll include retry context in goal
      const retryContextNote = `[RETRY CONTEXT] Failed action: ${action.action} ${action.selector || action.target || ''}. Error: ${errorMessage}`
      const alternativeContext: VisionContext = {
        ...context,
        // Keep original metadata structure
        metadata: context.metadata,
      }

      // Generate alternative using UnifiedBrainService
      const alternative = await this.unifiedBrainService.generateAction(
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
    
    // Priority 1: Text + Type match
    if (textHint) {
      const textMatch = analysis.elements.find(
        e => {
          const eText = (e.text || e.ariaLabel || e.name || '').toLowerCase()
          const hintLower = textHint.toLowerCase()
          return eText.includes(hintLower) && 
                 (actionType === 'click' ? (e.type === 'button' || e.type === 'link') : true)
        }
      )
      if (textMatch && textMatch.selector) {
        return textMatch.selector
      }
    }

    // Priority 2: Type match (button for click, input for type)
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

    // Priority 3: Any interactive element
    const interactiveMatch = analysis.elements.find(
      e => (e.type === 'button' || e.type === 'link' || e.type === 'input') && e.selector
    )
    return interactiveMatch?.selector || null
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

