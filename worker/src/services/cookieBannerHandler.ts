// AI-Guided Cookie Banner Handler
// Implements deterministic cookie banner dismissal with hard safety guarantees

import { Page } from 'playwright'
import { UnifiedBrainService } from './unifiedBrainService'
import { TOKEN_BUDGETS, buildBoundedPrompt, pruneDOM } from './unifiedBrain/tokenBudget'
import { VisionContext } from '../types'
import { ModelClient } from './unifiedBrain/ModelClient'

export type CookieBannerStrategy = 'accept_all' | 'reject_all' | 'preferences_flow'
export type CookieBannerOutcome = 'DISMISSED' | 'BLOCKED'

export interface CookieBannerPlan {
  isCookieBanner: boolean
  bannerType?: 'framework' | 'custom'
  strategy: CookieBannerStrategy
  primarySelectors: string[]
  fallbackSelectors: string[]
  maxSteps: 1 | 2
  confidence: number
}

export interface CookieBannerResult {
  outcome: CookieBannerOutcome
  strategy?: CookieBannerStrategy
  selectorsAttempted: string[]
  reason?: string
  stepsExecuted: number
}

/**
 * AI-Guided Cookie Banner Handler
 * 
 * Safety Guarantees:
 * - AI is called exactly once per page
 * - Execution is deterministic with strict validation
 * - Hard exit conditions prevent infinite loops
 * - Global selector tracking prevents retries
 */
export class CookieBannerHandler {
  private modelClient: ModelClient
  private attemptedSelectors: Set<string> = new Set()
  private pagesProcessed: Set<string> = new Set()

  constructor(unifiedBrain: UnifiedBrainService) {
    // Access modelClient from UnifiedBrainService (private property access via type assertion)
    // This is safe because UnifiedBrainService maintains the modelClient throughout its lifetime
    this.modelClient = (unifiedBrain as any).modelClient
    if (!this.modelClient) {
      throw new Error('CookieBannerHandler: UnifiedBrainService modelClient not available')
    }
  }

  /**
   * Handle cookie banner on a page (ONE-TIME AI classification + deterministic execution)
   */
  async handleCookieBanner(
    page: Page,
    context: VisionContext,
    currentUrl: string
  ): Promise<CookieBannerResult> {
    // Safety: Never process the same page twice
    if (this.pagesProcessed.has(currentUrl)) {
      return {
        outcome: 'BLOCKED',
        reason: 'Cookie banner already processed for this page',
        selectorsAttempted: [],
        stepsExecuted: 0,
      }
    }

    // Mark page as processed immediately to prevent re-entry
    this.pagesProcessed.add(currentUrl)

    try {
      // Step 1: AI Classification (ONE-TIME)
      const plan = await this.classifyCookieBanner(context, currentUrl)

      if (!plan.isCookieBanner) {
        return {
          outcome: 'BLOCKED',
          reason: 'No cookie banner detected',
          selectorsAttempted: [],
          stepsExecuted: 0,
        }
      }

      // Step 2: Deterministic Execution
      return await this.executePlan(page, plan, currentUrl)
    } catch (error: any) {
      console.warn(`[CookieBannerHandler] Error handling cookie banner:`, error.message)
      return {
        outcome: 'BLOCKED',
        reason: `Error: ${error.message}`,
        selectorsAttempted: Array.from(this.attemptedSelectors),
        stepsExecuted: 0,
      }
    }
  }

  /**
   * AI Classification: Called exactly once per page
   */
  private async classifyCookieBanner(
    context: VisionContext,
    currentUrl: string
  ): Promise<CookieBannerPlan> {
    // Build context description for AI
    const elementsDescription = context.elements
      .slice(0, 50) // Limit to prevent token overflow
      .map((e, idx) => {
        const hidden = e.isHidden ? ' [HIDDEN]' : ''
        const label = e.text || e.ariaLabel || e.name || 'unnamed'
        return `${idx + 1}. ${e.type}${hidden}: "${label}" - selector: "${e.selector}"`
      })
      .join('\n')

    const basePrompt = `Analyze this page for a cookie consent banner:

URL: ${currentUrl}

Determine:
1. Is there a cookie consent banner present? (true/false)
2. If yes, what type is it? (framework like OneTrust/Cookiebot, or custom)
3. What is the best dismissal strategy? (accept_all, reject_all, or preferences_flow)
4. What are the primary selectors to click? (array of CSS selectors)
5. What are fallback selectors if primary fails? (array of CSS selectors)
6. Maximum steps needed (1 or 2)
7. Confidence level (0-1)

Return JSON:
{
  "isCookieBanner": true/false,
  "bannerType": "framework" | "custom" | null,
  "strategy": "accept_all" | "reject_all" | "preferences_flow" | null,
  "primarySelectors": ["selector1", "selector2"],
  "fallbackSelectors": ["selector3", "selector4"],
  "maxSteps": 1 or 2,
  "confidence": 0.0-1.0
}

IMPORTANT:
- Only return true for isCookieBanner if you are CERTAIN it's a cookie banner
- Selectors must be valid CSS selectors
- maxSteps must be 1 or 2 (never more)
- If uncertain, set isCookieBanner to false`

    const systemPrompt = `You are an expert web automation engineer specializing in cookie consent banner detection and dismissal. Analyze page elements and provide a precise dismissal plan. Return valid JSON only.`

    try {
      // Build prompt with token budget enforcement
      const prompt = buildBoundedPrompt(basePrompt, {
        elements: elementsDescription,
      }, TOKEN_BUDGETS.cookieBanner)

      const response = await this.modelClient.call(
        prompt,
        systemPrompt,
        'analyze'
      )

      const parsed = JSON.parse(response.content)
      
      // Validate response
      if (typeof parsed.isCookieBanner !== 'boolean') {
        return { isCookieBanner: false, strategy: 'accept_all', primarySelectors: [], fallbackSelectors: [], maxSteps: 1, confidence: 0 }
      }

      if (!parsed.isCookieBanner) {
        return { isCookieBanner: false, strategy: 'accept_all', primarySelectors: [], fallbackSelectors: [], maxSteps: 1, confidence: 0 }
      }

      return {
        isCookieBanner: true,
        bannerType: parsed.bannerType || 'custom',
        strategy: parsed.strategy || 'accept_all',
        primarySelectors: Array.isArray(parsed.primarySelectors) ? parsed.primarySelectors.slice(0, 3) : [],
        fallbackSelectors: Array.isArray(parsed.fallbackSelectors) ? parsed.fallbackSelectors.slice(0, 3) : [],
        maxSteps: parsed.maxSteps === 2 ? 2 : 1,
        confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
      }
    } catch (error: any) {
      console.warn(`[CookieBannerHandler] AI classification failed:`, error.message)
      // Fail safe: return no banner detected
      return { isCookieBanner: false, strategy: 'accept_all', primarySelectors: [], fallbackSelectors: [], maxSteps: 1, confidence: 0 }
    }
  }

  /**
   * Deterministic Execution: Execute AI plan with strict validation
   */
  private async executePlan(
    page: Page,
    plan: CookieBannerPlan,
    currentUrl: string
  ): Promise<CookieBannerResult> {
    const selectorsAttempted: string[] = []
    let stepsExecuted = 0

    // Combine all selectors (primary first, then fallback)
    const allSelectors = [...plan.primarySelectors, ...plan.fallbackSelectors]

    // Execute up to maxSteps
    for (let step = 0; step < plan.maxSteps && stepsExecuted < plan.maxSteps; step++) {
      // Find next actionable selector
      let actionableSelector: string | null = null

      for (const selector of allSelectors) {
        // Safety: Skip if already attempted
        if (this.attemptedSelectors.has(selector)) {
          continue
        }

        // Validate selector is actionable
        const isValid = await this.validateSelector(page, selector)
        if (isValid) {
          actionableSelector = selector
          break
        }
      }

      // Hard exit: No actionable selector found
      if (!actionableSelector) {
        return {
          outcome: 'BLOCKED',
          strategy: plan.strategy,
          selectorsAttempted,
          reason: 'No actionable selectors found',
          stepsExecuted,
        }
      }

      // Mark as attempted (prevent retry)
      this.attemptedSelectors.add(actionableSelector)
      selectorsAttempted.push(actionableSelector)

      // Execute action
      try {
        const element = page.locator(actionableSelector).first()
        await element.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {})
        await page.waitForTimeout(300)

        // Click
        await element.click({ timeout: 3000, force: false }).catch(() => {
          // Try force click if normal click fails
          return element.click({ timeout: 3000, force: true })
        })

        stepsExecuted++

        // Wait for potential dismissal
        await page.waitForTimeout(1000)

        // Verify banner removal
        const isDismissed = await this.verifyDismissal(page, actionableSelector)
        if (isDismissed) {
          return {
            outcome: 'DISMISSED',
            strategy: plan.strategy,
            selectorsAttempted,
            stepsExecuted,
          }
        }

        // Check if DOM changed meaningfully (banner might be transitioning)
        const domChanged = await this.checkDOMChange(page)
        if (!domChanged && stepsExecuted >= plan.maxSteps) {
          // No progress made, exit
          return {
            outcome: 'BLOCKED',
            strategy: plan.strategy,
            selectorsAttempted,
            reason: 'Banner persisted after maxSteps with no DOM change',
            stepsExecuted,
          }
        }
      } catch (error: any) {
        // Action failed, try next selector
        console.warn(`[CookieBannerHandler] Action failed for ${actionableSelector}:`, error.message)
        continue
      }
    }

    // Hard exit: Banner persists after maxSteps
    return {
      outcome: 'BLOCKED',
      strategy: plan.strategy,
      selectorsAttempted,
      reason: `Banner persisted after ${stepsExecuted} steps`,
      stepsExecuted,
    }
  }

  /**
   * Validate selector is actionable (strict checks)
   */
  private async validateSelector(page: Page, selector: string): Promise<boolean> {
    try {
      const element = page.locator(selector).first()
      const count = await element.count()
      if (count === 0) return false

      const isVisible = await element.isVisible().catch(() => false)
      if (!isVisible) return false

      // Check element properties
      const isValid = await element.evaluate((el: any) => {
        const style = window.getComputedStyle(el)
        const rect = el.getBoundingClientRect()

        // Must be visible
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
          return false
        }

        // Must have non-zero size
        if (rect.width === 0 || rect.height === 0) {
          return false
        }

        // Must be enabled (for buttons/inputs)
        if (el.disabled || el.getAttribute('aria-disabled') === 'true') {
          return false
        }

        // Must be in viewport (rough check)
        const viewportHeight = window.innerHeight
        const viewportWidth = window.innerWidth
        if (rect.bottom < 0 || rect.top > viewportHeight || rect.right < 0 || rect.left > viewportWidth) {
          return false
        }

        return true
      }).catch(() => false)

      return isValid
    } catch {
      return false
    }
  }

  /**
   * Verify banner was dismissed
   */
  private async verifyDismissal(page: Page, selector: string): Promise<boolean> {
    try {
      // Check if clicked element is still visible
      const element = page.locator(selector).first()
      const stillVisible = await element.isVisible({ timeout: 500 }).catch(() => false)

      // If element is gone, banner was likely dismissed
      if (!stillVisible) {
        return true
      }

      // Check for common cookie banner indicators
      const cookieIndicators = [
        ':has-text("cookie")',
        ':has-text("consent")',
        '[id*="cookie" i]',
        '[class*="cookie" i]',
        '[id*="consent" i]',
        '[class*="consent" i]',
      ]

      let visibleCount = 0
      for (const indicator of cookieIndicators) {
        const count = await page.locator(indicator).count().catch(() => 0)
        if (count > 0) {
          const isVisible = await page.locator(indicator).first().isVisible({ timeout: 500 }).catch(() => false)
          if (isVisible) visibleCount++
        }
      }

      // If no cookie indicators visible, banner was dismissed
      return visibleCount === 0
    } catch {
      return false
    }
  }

  /**
   * Check if DOM changed meaningfully (indicates progress)
   */
  private async checkDOMChange(page: Page): Promise<boolean> {
    try {
      // Simple check: compare element count before/after
      const beforeCount = await page.evaluate(() => document.querySelectorAll('*').length)
      await page.waitForTimeout(500)
      const afterCount = await page.evaluate(() => document.querySelectorAll('*').length)

      // If count changed significantly, DOM changed
      return Math.abs(beforeCount - afterCount) > 5
    } catch {
      return false
    }
  }

  /**
   * Reset handler state (for new test runs)
   */
  reset(): void {
    this.attemptedSelectors.clear()
    this.pagesProcessed.clear()
  }
}

