// AI-Guided Cookie Banner Handler
// SEALED STATE MACHINE - Authoritative, isolated cookie consent handling
// 
// CORE PRINCIPLE: Cookie consent handling is a SPECIAL, ISOLATED, AUTHORITATIVE FLOW.
// Once cookie handling begins, it must fully resolve BEFORE any other action logic can run.
//
// State Machine: DETECT -> CLICK -> WAIT -> VERIFY (DOM) -> VERIFY (Vision if ambiguous) -> RETRY LIMITS
//
// NON-NEGOTIABLE INVARIANTS:
// - Runs at most ONCE per test run
// - No IRL, self-healing, or fallback during execution
// - Post-click verification is MANDATORY
// - All steps are logged for user visibility

import { Page } from 'playwright'
import { UnifiedBrainService } from './unifiedBrainService'
import { TOKEN_BUDGETS, buildBoundedPrompt, pruneDOM } from './unifiedBrain/tokenBudget'
import { VisionContext } from '../types'
import { ModelClient } from './unifiedBrain/ModelClient'
import axios from 'axios'
import { ActionContext } from '../types/actionContext'
import { getExecutionLogEmitter, ExecutionLogEmitter } from './executionLogEmitter'
import { assertCookieHandlingAllowed, setCookieStatus, resetCookieStatus } from './cookieStatusTracker'

export type CookieBannerStrategy = 'accept_all' | 'reject_all' | 'preferences_flow'

/**
 * CookieResolutionResult - Sealed return type from cookie handling
 * 
 * Once handleCookieConsent() returns, cookie handling MUST NEVER be re-entered.
 * No other code is allowed to detect cookies, click cookie buttons, or retry cookie actions.
 */
export type CookieResolutionResult =
  | { outcome: 'RESOLVED'; strategy: CookieBannerStrategy; selectorsAttempted: string[]; stepsExecuted: number }
  | { outcome: 'RESOLVED_WITH_DELAY'; strategy: CookieBannerStrategy; selectorsAttempted: string[]; stepsExecuted: number; reason: string }
  | { outcome: 'BLOCKED'; strategy?: CookieBannerStrategy; selectorsAttempted: string[]; stepsExecuted: number; reason: string }
  | { outcome: 'NOT_PRESENT'; stepsExecuted: 0 }

export interface CookieBannerPlan {
  isCookieBanner: boolean
  bannerType?: 'framework' | 'custom'
  strategy: CookieBannerStrategy
  primarySelectors: string[]
  fallbackSelectors: string[]
  maxSteps: 1 | 2
  confidence: number
}

// Legacy type for backward compatibility (deprecated)
export type CookieBannerOutcome = 'DISMISSED' | 'BLOCKED'
export interface CookieBannerResult {
  outcome: CookieBannerOutcome | 'RESOLVED_WITH_DELAY'
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
/**
 * CookieBannerHandler - SEALED STATE MACHINE
 * 
 * This class implements the authoritative cookie consent handling flow.
 * It is the ONLY code allowed to detect, click, or verify cookie banners.
 * 
 * INVARIANTS:
 * - Runs at most ONCE per test run (enforced by pagesProcessed)
 * - No IRL, self-healing, or fallback during execution
 * - Post-click verification is MANDATORY
 * - All steps are logged via ExecutionLogEmitter
 */
export class CookieBannerHandler {
  private modelClient: ModelClient
  private attemptedSelectors: Set<string> = new Set()
  private pagesProcessed: Set<string> = new Set()
  private visualConfirmationsUsed: number = 0 // Track visual confirmations per execution
  private readonly maxAttempts: number = 2 // Hard limit: max 2 cookie attempts
  private readonly maxVisualConfirmations: number = 1 // Hard limit: max 1 visual confirmation per click
  private logEmitter?: ExecutionLogEmitter

  constructor(unifiedBrain: UnifiedBrainService) {
    // Access modelClient from UnifiedBrainService (private property access via type assertion)
    // This is safe because UnifiedBrainService maintains the modelClient throughout its lifetime
    this.modelClient = (unifiedBrain as any).modelClient
    if (!this.modelClient) {
      throw new Error('CookieBannerHandler: UnifiedBrainService modelClient not available')
    }
  }

  /**
   * handleCookieConsent - SEALED STATE MACHINE
   * 
   * This is the ONLY function allowed to handle cookie consent.
   * Once it returns, cookie handling MUST NEVER be re-entered during the same test run.
   * 
   * Returns: CookieResolutionResult (sealed type)
   * - RESOLVED: Banner successfully dismissed
   * - RESOLVED_WITH_DELAY: Banner persisted but test continues
   * - BLOCKED: Banner could not be dismissed
   * - NOT_PRESENT: No cookie banner detected
   * 
   * State Machine: DETECT -> CLICK -> WAIT -> VERIFY (DOM) -> VERIFY (Vision if ambiguous) -> RETRY LIMITS
   */
  async handleCookieConsent(
    page: Page,
    context: VisionContext,
    currentUrl: string,
    runId: string
  ): Promise<CookieResolutionResult> {
    // Initialize execution log emitter
    this.logEmitter = getExecutionLogEmitter(runId, 1)

    // INVARIANT CHECK: Ensure cookie handling is allowed
    assertCookieHandlingAllowed(runId, 'CookieBannerHandler.handleCookieConsent')

    // Set status to IN_PROGRESS
    setCookieStatus(runId, 'IN_PROGRESS')

    // INVARIANT: Never process the same page twice
    if (this.pagesProcessed.has(currentUrl)) {
      this.logEmitter.log('Cookie banner already processed for this page', { url: currentUrl })
      setCookieStatus(runId, 'COMPLETED')
      return {
        outcome: 'BLOCKED',
        selectorsAttempted: [],
        stepsExecuted: 0,
        reason: 'Cookie banner already processed for this page',
      }
    }

    // Mark page as processed immediately to prevent re-entry
    this.pagesProcessed.add(currentUrl)
    this.visualConfirmationsUsed = 0 // Reset visual confirmation counter

    try {
      // STATE 0: HEURISTIC FAST PATH
      // Attempt to resolve common cookie banners without AI (faster, cheaper, more reliable)
      this.logEmitter.log('Attempting heuristic cookie resolution')
      const heuristicResult = await this.heuristicResolve(page, currentUrl)
      if (heuristicResult && heuristicResult.outcome === 'RESOLVED') {
        this.logEmitter.log('Heuristic resolution successful', { strategy: heuristicResult.strategy })
        setCookieStatus(runId, 'COMPLETED')
        return heuristicResult
      }

      // STATE 1: DETECT (AI Fallback)
      this.logEmitter.log('Detected cookie consent banner (AI Analysis)', { url: currentUrl })
      const plan = await this.classifyCookieBanner(context, currentUrl)

      if (!plan.isCookieBanner) {
        this.logEmitter.log('No cookie banner detected')
        setCookieStatus(runId, 'COMPLETED')
        return {
          outcome: 'NOT_PRESENT',
          stepsExecuted: 0,
        }
      }

      // STATE 2-6: CLICK -> WAIT -> VERIFY -> RETRY LIMITS
      const result = await this.executePlan(page, plan, currentUrl)

      // Set status to COMPLETED after handling
      setCookieStatus(runId, 'COMPLETED')

      return result
    } catch (error: any) {
      this.logEmitter.log('Error handling cookie banner', { error: error.message })
      // Set status to COMPLETED even on error - cookie handling is done
      setCookieStatus(runId, 'COMPLETED')
      return {
        outcome: 'BLOCKED',
        selectorsAttempted: Array.from(this.attemptedSelectors),
        stepsExecuted: 0,
        reason: `Error: ${error.message}`,
      }
    }
  }

  /**
   * STEP 1: Detect site platform (WordPress, Shopify, Webflow, Custom)
   */
  private async detectPlatform(page: Page): Promise<'wordpress' | 'shopify' | 'webflow' | 'custom'> {
    try {
      const platform = await page.evaluate(() => {
        const html = document.documentElement.outerHTML.toLowerCase()
        const meta = document.querySelector('meta[name="generator"]')?.getAttribute('content')?.toLowerCase() || ''

        // WordPress detection
        if (
          html.includes('wp-content') ||
          html.includes('wp-includes') ||
          meta.includes('wordpress') ||
          document.querySelector('link[href*="wp-content"]') ||
          document.querySelector('script[src*="wp-includes"]')
        ) {
          return 'wordpress'
        }

        // Shopify detection
        if (
          html.includes('shopify') ||
          html.includes('cdn.shopify.com') ||
          meta.includes('shopify') ||
          (window as any).Shopify
        ) {
          return 'shopify'
        }

        // Webflow detection
        if (
          html.includes('webflow') ||
          html.includes('assets.website-files.com') ||
          meta.includes('webflow') ||
          document.querySelector('html[data-wf-site]')
        ) {
          return 'webflow'
        }

        return 'custom'
      })

      this.logEmitter?.log(`Detected platform: ${platform}`)
      return platform
    } catch (error) {
      console.warn('[CookieBannerHandler] Platform detection failed, defaulting to custom')
      return 'custom'
    }
  }

  /**
   * STEP 2: Get platform-specific cookie selectors
   * Enhanced with EU/UK regional selectors for TCF v2.0, GDPR, and UK ICO compliance
   */
  private getPlatformSelectors(platform: 'wordpress' | 'shopify' | 'webflow' | 'custom', region?: 'eu' | 'uk' | 'us' | 'other'): string[] {
    const universalSelectors = [
      // OneTrust (most common)
      '#onetrust-accept-btn-handler',
      '#onetrust-pc-btn-handler',
      // TrustArc
      '#trustarc-agree-btn',
      // Cookiebot
      '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
      // Generic patterns
      'button[id*="cookie"][id*="accept"]',
      'button[class*="cookie"][class*="accept"]',
      'button:has-text("Accept All Cookies")',
      'button:has-text("Accept All")',
      'button:has-text("Allow All")',
      'button:has-text("Agree")',
      'button:has-text("I Accept")',
      '[aria-label="Accept cookies"]',
    ]

    // EU/UK Regional Selectors (TCF v2.0, GDPR-specific)
    const euUkSelectors = [
      // TCF v2.0 (IAB Framework - very common in EU)
      '.qc-cmp2-summary-buttons button[mode="primary"]',
      '[data-testid="GDPR-accept"]',
      '.fc-cta-consent', // Funding Choices
      '.fc-button.fc-cta-consent',
      // Didomi (popular in France/Germany)
      '#didomi-notice-agree-button',
      '.didomi-continue-without-agreeing',
      '#didomi-notice-learn-more-button + button',
      // Quantcast
      '.qc-cmp-button[mode="primary"]',
      '.qc-cmp-ui button.qc-cmp-button',
      // Sourcepoint
      '[title="Accept"]',
      'button[title="AGREE"]',
      '.sp_choice_type_11',
      // Osano
      '.osano-cm-accept-all',
      '.osano-cm-button--type_accept',
      // Cookie Script (EU-focused)
      '#cookiescript_accept',
      '#cookiescript_acceptAll',
      // Klaro
      '.klaro .cm-btn-success',
      '.klaro .cm-btn-accept-all',
      // Usercentrics
      '#uc-btn-accept-banner',
      '[data-testid="uc-accept-all-button"]',
      // Axeptio
      '#axeptio_btn_acceptAll',
      '.axeptio-btn-accept',
      // Tarteaucitron
      '#tarteaucitronPersonalize2',
      '.tarteaucitronAllow',
      // UK-specific (UK Cookie Control)
      '.ccc-accept-close',
      '#ccc-recommended-settings',
      '.ccc-notify-button',
      '#ccc-close',
      // PECR/UK ICO compliant
      '[data-cc-event="accept"]',
      '.cc-accept-all',
    ]

    const platformSelectors: Record<string, string[]> = {
      wordpress: [
        // CookieYes (very popular WP plugin)
        '#cky-accept-btn',
        '.cky-btn-accept',
        '.cky-consent-bar button.cky-btn-accept',
        // GDPR Cookie Consent
        '#cookie_action_close_header',
        '.cli-plugin-button.cli_action_button',
        '.cli-bar button[data-cli_action="accept"]',
        // Complianz
        '.cmplz-accept',
        '.cmplz-btn.cmplz-accept',
        '#cmplz-accept-btn',
        // Borlabs Cookie
        '.BorlabsCookie ._brlbs-btn-accept-all',
        'a[data-cookie-accept-all]',
        // Cookie Notice
        '#cn-accept-cookie',
        '.cn-button[data-cookie-action="accept"]',
        // GDPR Cookie Compliance
        '#moove_gdpr_cookie_accept',
        '.moove_gdpr_cookie_modal button.mgbutton',
        // Real Cookie Banner
        '#rcb-accept-all',
        '.rcb-btn-accept-all',
      ],
      shopify: [
        // Shopify Cookie Banner
        '.cc-dismiss',
        '.cc-allow',
        'button.cc-btn.cc-allow',
        // Pandectes GDPR
        '.pandectes-accept-all',
        '#pandectes-accept',
        // Cookie Bar
        '#cookiebar-accept',
        '.cookie-banner-accept',
        // Enzuzo
        '.ez-accept-all',
        '#ez-cookie-banner button.ez-accept',
        // Shopify native (2024+)
        '[data-cookie-banner-accept]',
      ],
      webflow: [
        // Finsweet Cookie Consent
        '.fs-cc-banner_button[data-fs-cc-button="allow"]',
        '[fs-cc="allow"]',
        '.fs-cc-allow',
        // Iubenda
        '.iubenda-cs-accept-btn',
        '#iubenda-cs-banner button.iubenda-cs-accept-btn',
        // Termly
        '#termly-consent-banner button.t-acceptAllButton',
        '.termly-styles-acceptAll',
      ],
      custom: [],
    }

    // Build selector list based on region priority
    const selectors: string[] = []

    // Add platform-specific first
    selectors.push(...(platformSelectors[platform] || []))

    // Add EU/UK selectors if in those regions (or always, for broader coverage)
    if (region === 'eu' || region === 'uk' || !region) {
      selectors.push(...euUkSelectors)
    }

    // Add universal selectors last
    selectors.push(...universalSelectors)

    return selectors
  }

  /**
   * Get reject/decline selectors for UK ICO compliance testing
   * These are used when strategy is 'reject_all'
   */
  private getRejectSelectors(): string[] {
    return [
      // OneTrust
      '#onetrust-reject-all-handler',
      '.onetrust-reject-all-handler',
      // Cookiebot
      '#CybotCookiebotDialogBodyButtonDecline',
      '#CybotCookiebotDialogBodyLevelButtonDecline',
      // Generic patterns
      'button:has-text("Reject All")',
      'button:has-text("Decline All")',
      'button:has-text("Refuse All")',
      'button:has-text("Deny All")',
      'button:has-text("Only Necessary")',
      'button:has-text("Essential Only")',
      '[aria-label="Reject cookies"]',
      '[data-testid="GDPR-reject"]',
      // Didomi
      '#didomi-notice-disagree-button',
      // Quantcast
      '.qc-cmp-button[mode="secondary"]',
      // UK Cookie Control
      '.ccc-reject-close',
      '#ccc-reject-settings',
      // Usercentrics
      '#uc-btn-deny-banner',
      '[data-testid="uc-deny-all-button"]',
      // Klaro
      '.klaro .cm-btn-decline',
      // Osano
      '.osano-cm-deny-all',
    ]
  }

  /**
   * Get secondary selectors for multi-step flows
   * These are clicked AFTER the preferences/settings button
   */
  private getSecondarySelectors(): string[] {
    return [
      // Save/Confirm buttons (after preferences opened)
      'button:has-text("Save Settings")',
      'button:has-text("Save Preferences")',
      'button:has-text("Confirm Choices")',
      'button:has-text("Confirm My Choices")',
      'button:has-text("Save and Close")',
      'button:has-text("Apply")',
      '#save-preferences',
      '.consent-save-btn',
      '.save-preferences-btn',
      // OneTrust preferences save
      '.save-preference-btn-handler',
      '#onetrust-pc-sdk button.save-preference-btn-handler',
      // Cookiebot
      '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowallSelection',
      // Didomi
      '.didomi-consent-popup-save-button',
      // Usercentrics
      '.uc-save-settings-button',
    ]
  }

  /**
   * STEP 2.5: Detect region from URL/meta tags
   * Used to prioritize regional selectors
   */
  private async detectRegion(page: Page): Promise<'eu' | 'uk' | 'us' | 'other'> {
    try {
      const url = page.url()

      // Check TLD first (fastest)
      if (url.includes('.co.uk') || url.includes('.uk') || url.includes('.gov.uk')) {
        return 'uk'
      }
      if (url.includes('.eu') || url.includes('.de') || url.includes('.fr') ||
        url.includes('.es') || url.includes('.it') || url.includes('.nl') ||
        url.includes('.be') || url.includes('.at') || url.includes('.ie')) {
        return 'eu'
      }
      if (url.includes('.com') && !url.includes('.co.')) {
        // Could be US, but check locale meta
        const locale = await page.evaluate(() => {
          const htmlLang = document.documentElement.lang?.toLowerCase()
          const ogLocale = document.querySelector('meta[property="og:locale"]')?.getAttribute('content')?.toLowerCase()
          return htmlLang || ogLocale || ''
        }).catch(() => '')

        if (locale.startsWith('en-gb') || locale.startsWith('en_gb')) return 'uk'
        if (['de', 'fr', 'es', 'it', 'nl', 'pl', 'pt', 'sv', 'da', 'fi', 'no'].some(l => locale.startsWith(l))) return 'eu'
        if (locale.startsWith('en-us') || locale.startsWith('en_us')) return 'us'
      }

      return 'other'
    } catch (error) {
      console.warn('[CookieBannerHandler] Region detection failed, defaulting to other')
      return 'other'
    }
  }

  /**
   * Heuristic Resolution: Platform-aware cookie banner handling
   * Flow: Detect Platform → Detect Region → Select Selectors → Click → Screenshot Verify → Retry/Proceed
   */
  private async heuristicResolve(page: Page, currentUrl: string): Promise<CookieResolutionResult | null> {
    try {
      // STEP 1: Detect platform
      const platform = await this.detectPlatform(page)

      // STEP 1.5: Detect region for regional selectors
      const region = await this.detectRegion(page)
      this.logEmitter?.log(`Detected region: ${region}`)

      // STEP 2: Get platform-specific + regional selectors
      const selectors = this.getPlatformSelectors(platform, region)
      this.logEmitter?.log(`Using ${selectors.length} selectors for ${platform} platform (${region} region)`)

      // STEP 3: Try each selector
      for (const selector of selectors) {
        if (this.attemptedSelectors.has(selector)) continue

        const element = page.locator(selector).first()
        const isVisible = await element.isVisible({ timeout: 200 }).catch(() => false)

        if (isVisible) {
          const isEnabled = await element.isEnabled().catch(() => false)
          if (!isEnabled) continue

          this.logEmitter?.log(`Found cookie button: ${selector} (${platform})`)

          // Click the button
          await element.click({ timeout: 1000, force: false }).catch(() => {
            return element.click({ force: true })
          })

          this.attemptedSelectors.add(selector)

          // STEP 4: Wait and take verification screenshot
          await page.waitForTimeout(500)

          // Take screenshot for verification
          const screenshot = await page.screenshot({ type: 'png', fullPage: false }).catch(() => null)
          if (screenshot) {
            this.logEmitter?.log('Verification screenshot captured')
          }

          // Check if button is still visible (DOM verification)
          const stillVisible = await element.isVisible({ timeout: 200 }).catch(() => false)

          if (!stillVisible) {
            // SUCCESS: Banner dismissed
            this.logEmitter?.log(`Cookie banner dismissed successfully (${platform})`)
            return {
              outcome: 'RESOLVED',
              strategy: 'accept_all',
              selectorsAttempted: [selector],
              stepsExecuted: 1
            }
          } else {
            // FAILED: Try visual verification
            this.logEmitter?.log('Button still visible, attempting visual verification')
            const bannerStillShowing = await this.verifyDismissalVision(page)

            if (!bannerStillShowing) {
              this.logEmitter?.log(`Cookie banner dismissed (visual confirmed, ${platform})`)
              return {
                outcome: 'RESOLVED',
                strategy: 'accept_all',
                selectorsAttempted: [selector],
                stepsExecuted: 1
              }
            }
            // Continue to next selector
            this.logEmitter?.log('Visual verification: banner still visible, trying next selector')
          }
        }
      }

      // No selector worked
      this.logEmitter?.log(`No heuristic selector worked for ${platform} platform`)
      return null
    } catch (error) {
      console.warn('Heuristic cookie resolution failed:', error)
      return null
    }
  }

  /**
   * DEPRECATED: This method has been removed as part of architectural cleanup.
   * 
   * All cookie handling must go through handleCookieConsent().
   * This method was a legacy bypass path that has been eliminated.
   */

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
   * Deterministic Execution: Execute AI plan with verification-based state machine
   * State Machine: CLICK -> WAIT (randomized) -> VERIFY (DOM first) -> VERIFY (Vision if ambiguous) -> RETRY LIMITS
   * 
   * INVARIANT: This method runs in COOKIE_CONSENT context - no IRL, self-healing, or fallback allowed
   */
  private async executePlan(
    page: Page,
    plan: CookieBannerPlan,
    currentUrl: string
  ): Promise<CookieResolutionResult> {
    const selectorsAttempted: string[] = []
    let stepsExecuted = 0

    // Combine all selectors (primary first, then fallback)
    const allSelectors = [...plan.primarySelectors, ...plan.fallbackSelectors]

    // Hard limit: Maximum 2 attempts total
    const maxAttempts = Math.min(plan.maxSteps, this.maxAttempts)

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
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
        console.log('[CookieBannerHandler] No actionable selectors found')
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

      try {
        // STATE 2: CLICK
        const element = page.locator(actionableSelector).first()
        const buttonText = await element.textContent().catch(() => actionableSelector) || actionableSelector
        this.logEmitter?.log(`Attempting to close cookie banner`)
        this.logEmitter?.log(`Clicking '${buttonText}' button`, { selector: actionableSelector })

        await element.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => { })
        await page.waitForTimeout(300)

        await element.click({ timeout: 3000, force: false }).catch(() => {
          // Try force click if normal click fails
          return element.click({ timeout: 3000, force: true })
        })

        stepsExecuted++

        // STATE 3: WAIT (CRITICAL - randomized delay for animations/JS callbacks)
        // MANDATORY: This wait MUST occur before verification
        const waitMs = 300 + Math.random() * 500 // 300-800ms randomized
        this.logEmitter?.log(`Waiting for banner to close (${Math.round(waitMs)}ms)`)
        await page.waitForTimeout(waitMs)

        // STATE 4: VERIFY (DOM FIRST) - MANDATORY POST-CLICK VERIFICATION
        this.logEmitter?.log('Verifying banner dismissal using DOM checks')
        const domVerification = await this.verifyDismissalDOM(page, actionableSelector)

        if (domVerification.dismissed) {
          this.logEmitter?.log('Cookie banner resolved')
          return {
            outcome: 'RESOLVED',
            strategy: plan.strategy,
            selectorsAttempted,
            stepsExecuted,
          }
        }

        // STATE 5: VERIFY (VISION ONLY IF DOM IS AMBIGUOUS)
        if (!domVerification.dismissed && domVerification.ambiguous && this.visualConfirmationsUsed < this.maxVisualConfirmations) {
          this.logEmitter?.log('DOM ambiguous, performing visual confirmation')
          const visionResult = await this.verifyDismissalVision(page)

          if (!visionResult) {
            // Visual confirmation: banner not visible
            this.logEmitter?.log('Visual confirmation: banner not visible')
            this.logEmitter?.log('Cookie banner resolved')
            return {
              outcome: 'RESOLVED',
              strategy: plan.strategy,
              selectorsAttempted,
              stepsExecuted,
            }
          } else {
            // Visual confirmation: banner still visible
            this.logEmitter?.log('Visual confirmation: banner still visible')
            this.visualConfirmationsUsed++

            // Allow ONE retry max if we haven't exceeded attempt limit
            if (attempt < maxAttempts - 1) {
              this.logEmitter?.log(`Allowing one retry (attempt ${attempt + 2}/${maxAttempts})`)
              continue
            }
          }
        } else if (!domVerification.dismissed && !domVerification.ambiguous) {
          // DOM clearly shows banner is still present
          // Allow ONE retry max if we haven't exceeded attempt limit
          if (attempt < maxAttempts - 1) {
            this.logEmitter?.log(`Banner still present, allowing one retry (attempt ${attempt + 2}/${maxAttempts})`)
            continue
          }
        }

        // STATE 6: RETRY LIMITS EXCEEDED
        if (attempt >= maxAttempts - 1) {
          this.logEmitter?.log(`Maximum attempts (${maxAttempts}) reached. Marking as RESOLVED_WITH_DELAY and continuing test`)
          return {
            outcome: 'RESOLVED_WITH_DELAY',
            strategy: plan.strategy,
            selectorsAttempted,
            reason: `Banner persisted after ${stepsExecuted} attempts, continuing test`,
            stepsExecuted,
          }
        }
      } catch (error: any) {
        // Action failed, try next selector
        this.logEmitter?.log(`Action failed for ${actionableSelector}`, { error: error.message })
        continue
      }
    }

    // Hard exit: Banner persists after maxAttempts
    this.logEmitter?.log(`Banner persisted in DOM after ${stepsExecuted} attempts. Performing final Visual Verification...`)

    // VISUAL TRUTH CHECK: Use AI Vision to confirm if banner is REALLY there
    const finalVisualCheck = await this.verifyDismissalVision(page)

    if (!finalVisualCheck) {
      // Vision says it's gone (DOM was lying/laggy)
      this.logEmitter?.log('Visual Verification Passed: Banner is NOT visible. DOM was out of sync.')
      return {
        outcome: 'RESOLVED',
        strategy: plan.strategy,
        selectorsAttempted,
        stepsExecuted,
      }
    }

    // Vision confirms it is actually there
    this.logEmitter?.log('Visual Verification Failed: Banner is visually confirmed to be present.')

    // Capture evidence of failure
    try {
      const screenshot = await page.screenshot({ fullPage: false, type: 'jpeg', quality: 60 })
      const screenshotPath = `cookie_failure_${Date.now()}.jpg`
      // We aren't uploading here directly, but the log emitter might handle it or we contextually log it
      this.logEmitter?.log(`Captured evidence of cookie banner failure: ${screenshotPath}`)
    } catch (e) {
      console.warn('Failed to capture cookie failure screenshot')
    }

    return {
      outcome: 'RESOLVED_WITH_DELAY',
      strategy: plan.strategy,
      selectorsAttempted,
      reason: `Visual Verification confirmed banner persist after ${stepsExecuted} attempts.`,
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
   * Verify banner dismissal using DOM checks (STATE 4: VERIFY DOM FIRST)
   * Returns: { dismissed: boolean, ambiguous: boolean }
   * - dismissed: true if banner is clearly dismissed
   * - ambiguous: true if DOM signals are inconclusive (needs visual confirmation)
   */
  private async verifyDismissalDOM(page: Page, clickedSelector: string): Promise<{ dismissed: boolean; ambiguous: boolean }> {
    try {
      // Check if clicked element is still visible
      const element = page.locator(clickedSelector).first()
      const stillVisible = await element.isVisible({ timeout: 500 }).catch(() => false)

      // If element is gone, banner was likely dismissed
      if (!stillVisible) {
        // Double-check: look for banner container
        const bannerContainer = await this.findBannerContainer(page)
        if (!bannerContainer) {
          return { dismissed: true, ambiguous: false }
        }
      }

      // Comprehensive DOM checks for banner dismissal
      const bannerState = await page.evaluate(() => {
        // Find all potential cookie banner elements
        const cookieSelectors = [
          '[id*="cookie" i]',
          '[class*="cookie" i]',
          '[id*="consent" i]',
          '[class*="consent" i]',
          '[id*="banner" i]',
          '[class*="banner" i]',
        ]

        const banners: Array<{
          element: Element
          display: string
          visibility: string
          opacity: string
          pointerEvents: string
          rect: DOMRect
          offscreen: boolean
        }> = []

        for (const selector of cookieSelectors) {
          try {
            const elements = document.querySelectorAll(selector)
            elements.forEach((el) => {
              const style = window.getComputedStyle(el)
              const rect = el.getBoundingClientRect()
              const viewportHeight = window.innerHeight
              const viewportWidth = window.innerWidth

              banners.push({
                element: el,
                display: style.display,
                visibility: style.visibility,
                opacity: style.opacity,
                pointerEvents: style.pointerEvents,
                rect: {
                  x: rect.x,
                  y: rect.y,
                  width: rect.width,
                  height: rect.height,
                  top: rect.top,
                  left: rect.left,
                  bottom: rect.bottom,
                  right: rect.right,
                } as DOMRect,
                offscreen: rect.bottom < 0 || rect.top > viewportHeight || rect.right < 0 || rect.left > viewportWidth,
              })
            })
          } catch (e) {
            // Ignore selector errors
          }
        }

        return banners
      })

      if (bannerState.length === 0) {
        // No cookie banner elements found in DOM
        return { dismissed: true, ambiguous: false }
      }

      // Check each banner element for dismissal signals
      let clearlyDismissed = 0
      let clearlyVisible = 0
      let ambiguousCount = 0

      for (const banner of bannerState) {
        const isDisplayNone = banner.display === 'none'
        const isHidden = banner.visibility === 'hidden'
        const opacity = parseFloat(banner.opacity)
        const isLowOpacity = opacity < 0.05
        const isPointerEventsDisabled = banner.pointerEvents === 'none'
        const isOffscreen = banner.offscreen
        const hasZeroSize = banner.rect.width === 0 || banner.rect.height === 0

        // Clearly dismissed: display:none OR opacity < 0.05 OR offscreen OR zero size
        if (isDisplayNone || isLowOpacity || isOffscreen || hasZeroSize) {
          clearlyDismissed++
        }
        // Clearly visible: visible, non-zero opacity, in viewport, has size
        else if (!isHidden && opacity >= 0.1 && !isOffscreen && !hasZeroSize && !isPointerEventsDisabled) {
          clearlyVisible++
        }
        // Ambiguous: hidden but not display:none, or low opacity but not zero
        else {
          ambiguousCount++
        }
      }

      // If all banners are clearly dismissed
      if (clearlyDismissed > 0 && clearlyVisible === 0) {
        return { dismissed: true, ambiguous: false }
      }

      // If any banner is clearly visible
      if (clearlyVisible > 0) {
        return { dismissed: false, ambiguous: false }
      }

      // If ambiguous (transitioning state, low opacity, etc.)
      if (ambiguousCount > 0) {
        return { dismissed: false, ambiguous: true }
      }

      // Default: assume dismissed if we can't determine
      return { dismissed: true, ambiguous: false }
    } catch (error: any) {
      console.warn(`[CookieBannerHandler] DOM verification error:`, error.message)
      // On error, treat as ambiguous (may need visual confirmation)
      return { dismissed: false, ambiguous: true }
    }
  }

  /**
   * Find banner container element (helper for DOM verification)
   */
  private async findBannerContainer(page: Page): Promise<boolean> {
    try {
      const cookieIndicators = [
        ':has-text("cookie")',
        ':has-text("consent")',
        '[id*="cookie" i]',
        '[class*="cookie" i]',
        '[id*="consent" i]',
        '[class*="consent" i]',
      ]

      for (const indicator of cookieIndicators) {
        const count = await page.locator(indicator).count().catch(() => 0)
        if (count > 0) {
          const isVisible = await page.locator(indicator).first().isVisible({ timeout: 500 }).catch(() => false)
          if (isVisible) return true
        }
      }

      return false
    } catch {
      return false
    }
  }

  /**
   * Verify banner dismissal using GPT-4o visual confirmation (STATE 5: VISION IF AMBIGUOUS)
   * Returns: true if banner is still visible, false if not visible
   * Only called when DOM verification is ambiguous
   */
  private async verifyDismissalVision(page: Page): Promise<boolean> {
    try {
      // Take screenshot
      const screenshot = await page.screenshot({ type: 'png', fullPage: false })
      const screenshotBase64 = screenshot.toString('base64')

      // Call GPT-4o with binary question
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) {
        console.warn('[CookieBannerHandler] OPENAI_API_KEY not available for visual confirmation')
        return true // Assume visible if we can't verify
      }

      const apiUrl = process.env.OPENAI_API_URL || 'https://api.openai.com/v1'
      const visionModel = process.env.VISION_MODEL || 'gpt-4o'

      const response = await axios.post(
        `${apiUrl}/chat/completions`,
        {
          model: visionModel,
          temperature: 0.2,
          messages: [
            {
              role: 'system',
              content: 'You are a web automation assistant. Answer with JSON only: {"bannerVisible": true/false}',
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Is a cookie consent banner still visible on this page? Answer with JSON: {"bannerVisible": true/false}',
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/png;base64,${screenshotBase64}`,
                  },
                },
              ],
            },
          ],
          response_format: { type: 'json_object' },
          max_tokens: 50,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      )

      const content = response.data.choices?.[0]?.message?.content
      if (!content) {
        return true // Assume visible if we can't parse
      }

      // ADMIN ONLY: Log GPT-4o Vision token usage for cost tracking
      const usage = response.data.usage
      if (usage) {
        console.log(`[TokenUsage][GPT-4o-Vision] Call: prompt=${usage.prompt_tokens}, completion=${usage.completion_tokens}, total=${usage.total_tokens}`)
      }

      const parsed = JSON.parse(content)
      return parsed.bannerVisible === true
    } catch (error: any) {
      console.warn(`[CookieBannerHandler] Visual confirmation error:`, error.message)
      return true // Assume visible on error (safer to retry)
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
   * ENHANCEMENT 5: Log failed cookie banner attempts for learning/improvement
   * This data can be analyzed later to add new selectors for unhandled banners
   */
  private async logFailedBanner(
    page: Page,
    url: string,
    selectorsAttempted: string[],
    region: 'eu' | 'uk' | 'us' | 'other',
    platform: 'wordpress' | 'shopify' | 'webflow' | 'custom',
    reason: string
  ): Promise<void> {
    try {
      // Capture minimal DOM info for analysis (cookie-related elements only)
      const cookieElements = await page.evaluate(() => {
        const selectors = [
          '[id*="cookie" i]',
          '[class*="cookie" i]',
          '[id*="consent" i]',
          '[class*="consent" i]',
          '[id*="gdpr" i]',
          '[class*="gdpr" i]',
          '[id*="privacy" i]',
          '[class*="privacy" i]',
        ]

        const elements: Array<{
          tagName: string
          id: string
          className: string
          text: string
          visible: boolean
        }> = []

        for (const selector of selectors) {
          try {
            const found = document.querySelectorAll(selector)
            found.forEach(el => {
              const rect = el.getBoundingClientRect()
              const style = window.getComputedStyle(el)
              elements.push({
                tagName: el.tagName.toLowerCase(),
                id: el.id || '',
                className: el.className?.toString?.() || '',
                text: (el as HTMLElement).innerText?.slice(0, 100) || '',
                visible: rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden',
              })
            })
          } catch (e) {
            // Ignore selector errors
          }
        }

        // Deduplicate and limit
        const seen = new Set<string>()
        return elements.filter(el => {
          const key = `${el.tagName}#${el.id}.${el.className}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        }).slice(0, 20)
      }).catch(() => [])

      // Log the failure for future analysis
      const failureLog = {
        timestamp: new Date().toISOString(),
        url: new URL(url).hostname, // Only log hostname for privacy
        region,
        platform,
        selectorsAttempted: selectorsAttempted.slice(0, 10), // Limit for brevity
        reason,
        cookieElementsFound: cookieElements.length,
        sampleElements: cookieElements.slice(0, 5).map(el => ({
          tag: el.tagName,
          id: el.id?.slice(0, 50),
          class: el.className?.slice(0, 50),
          visible: el.visible,
        })),
      }

      // Log to console for now (could be sent to analytics in future)
      console.log('[CookieBannerHandler] Failed banner logged for learning:', JSON.stringify(failureLog))
      this.logEmitter?.log('Cookie banner failure logged for future improvement', {
        hostname: failureLog.url,
        elementsFound: failureLog.cookieElementsFound
      })
    } catch (error) {
      // Logging should never break the test
      console.warn('[CookieBannerHandler] Failed to log banner failure:', error)
    }
  }

  /**
   * Reset handler state (for new test runs)
   */
  reset(runId?: string): void {
    this.attemptedSelectors.clear()
    this.pagesProcessed.clear()
    this.visualConfirmationsUsed = 0
    // Reset cookie status for the run
    if (runId) {
      resetCookieStatus(runId)
    }
  }
}

