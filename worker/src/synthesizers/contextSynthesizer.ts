// ContextSynthesizer: Prepares VisionContext and trackingInfo for LLM
import { VisionContext, VisionElement, TestOptions, DiagnosisComponentInsight } from '../types'
import { UnifiedBrainService } from '../services/unifiedBrainService'
import { ComprehensiveTestingService, ComprehensiveTestResults } from '../services/comprehensiveTesting'
import { Page } from 'playwright'

export interface SynthesizeContextParams {
  sessionId: string
  isMobile: boolean
  goal: string
  visitedSelectors: Set<string>
  visitedUrls: Set<string>
  visitedHrefs: Set<string>
  blockedSelectors: Set<string>
  isSelectorBlocked: (selector?: string | null) => boolean
  comprehensiveTesting: ComprehensiveTestingService
  playwrightRunner?: any
  appiumRunner?: any
  stepNumber: number
  runId: string
  browserType: 'chromium' | 'firefox' | 'webkit'
  testableComponents?: DiagnosisComponentInsight[] // Components identified as testable during diagnosis
}

export interface SynthesizeContextResult {
  context: VisionContext
  filteredContext: VisionContext
  currentUrl: string
  comprehensiveData: ComprehensiveTestResults | null
}

export interface PrepareTrackingInfoParams {
  visitedUrls: Set<string>
  visitedSelectors: Set<string>
  discoveredPages: Array<{ url: string; title: string; selector: string }>
  currentUrl: string
  options: TestOptions | undefined
  environment: {
    browser: string
    viewport: string
  }
}

export interface TrackingInfo {
  visitedUrls: string[]
  visitedSelectors: string[]
  discoveredPages: Array<{ url: string; title: string; selector: string }>
  currentUrl: string
  isAllPagesMode?: boolean
  browser?: 'chromium' | 'firefox' | 'webkit'
  viewport?: string
}

export class ContextSynthesizer {
  constructor(
    private unifiedBrain: UnifiedBrainService,
    private comprehensiveTesting: ComprehensiveTestingService
  ) {}

  /**
   * Synthesize VisionContext from current page state
   * Includes screenshot analysis, DOM snapshot, comprehensive testing data, and element filtering
   */
  async synthesizeContext(params: SynthesizeContextParams): Promise<SynthesizeContextResult> {
    const {
      sessionId,
      isMobile,
      goal,
      visitedSelectors,
      visitedUrls,
      visitedHrefs,
      isSelectorBlocked,
      playwrightRunner,
      appiumRunner,
      stepNumber,
      runId,
      browserType
    } = params

    // Capture screenshot and DOM snapshot
    const runner = isMobile ? appiumRunner : playwrightRunner
    const screenshot = await runner.captureScreenshot(sessionId)
    const domSnapshot = await (isMobile
      ? appiumRunner.getPageSource(sessionId)
      : playwrightRunner.getDOMSnapshot(sessionId))

    // Collect comprehensive testing data (only for web, not mobile)
    let comprehensiveData: ComprehensiveTestResults | null = null
    if (!isMobile && playwrightRunner) {
      try {
        // Try to get comprehensive test results from diagnosis phase first
        // (This would require passing diagnosis data, but for now we'll collect fresh)
        const sessionData = playwrightRunner.getSession(sessionId)
        if (sessionData?.page) {
          // Initialize comprehensive testing if not already done
          if (stepNumber === 1) {
            await this.comprehensiveTesting.initialize(sessionData.page)
          }

          // Collect data at key steps (every 3 steps or on first step)
          if (stepNumber === 1 || stepNumber % 3 === 0) {
            console.log(`[${runId}] [${browserType.toUpperCase()}] Step ${stepNumber}: Collecting comprehensive test data...`)
            await Promise.all([
              this.comprehensiveTesting.collectPerformanceMetrics(sessionData.page),
              this.comprehensiveTesting.checkAccessibility(sessionData.page),
              this.comprehensiveTesting.analyzeDOMHealth(sessionData.page),
              this.comprehensiveTesting.detectVisualIssues(sessionData.page),
            ])
            comprehensiveData = this.comprehensiveTesting.getResults()
            console.log(`[${runId}] [${browserType.toUpperCase()}] Step ${stepNumber}: Comprehensive data collected - ${comprehensiveData.consoleErrors.length} console errors, ${comprehensiveData.networkErrors.length} network errors`)
          }
        }
      } catch (compError: any) {
        console.warn(`[${runId}] [${browserType.toUpperCase()}] Step ${stepNumber}: Failed to collect comprehensive data:`, compError.message)
      }
    }

    // Analyze screenshot and DOM summary with Unified Brain
    console.log(`[${runId}] [${browserType.toUpperCase()}] Step ${stepNumber}: Summarizing DOM context...`)
    const context = await this.unifiedBrain.analyzeScreenshot(screenshot, domSnapshot, goal)
    console.log(`[${runId}] [${browserType.toUpperCase()}] Step ${stepNumber}: DOM summary ready (${context.elements.length} elements, truncated: ${context.metadata.truncated})`)

    // Get current URL to track navigation
    const currentUrl = await (isMobile
      ? appiumRunner.getCurrentUrl(sessionId).catch(() => '')
      : playwrightRunner.getCurrentUrl(sessionId).catch(() => ''))
    visitedUrls.add(currentUrl)

    // Build testability map from diagnosis data
    const testabilityMap = new Map<string, 'high' | 'medium' | 'low'>()
    if (params.testableComponents) {
      params.testableComponents.forEach(comp => {
        if (comp.selector) {
          testabilityMap.set(comp.selector, comp.testability)
        }
      })
    }

    // Helper to check if selector matches a testable component (fuzzy match)
    const getTestability = (selector?: string): 'high' | 'medium' | 'low' | null => {
      if (!selector) return null
      
      // Exact match
      if (testabilityMap.has(selector)) {
        return testabilityMap.get(selector)!
      }
      
      // Partial match (e.g., if testable component is ".btn-primary" and element is ".btn-primary.active")
      for (const [testableSelector, testability] of testabilityMap.entries()) {
        if (selector.includes(testableSelector) || testableSelector.includes(selector)) {
          return testability
        }
      }
      
      return null
    }

    // Filter out already visited elements and non-navigational elements
    // Also prioritize high testability components
    const filteredElements = context.elements
      .filter((e: VisionElement) => {
        // Skip if selector already visited
        if (e.selector && visitedSelectors.has(e.selector)) {
          return false
        }

        // Skip selectors explicitly blocked by diagnosis/runtime
        if (e.selector && isSelectorBlocked(e.selector)) {
          return false
        }

        // Skip email and phone links (they're not navigational)
        if (e.href && (e.href.startsWith('mailto:') || e.href.startsWith('tel:'))) {
          return false
        }

        // Skip anchor links (skip links, same-page anchors) - not useful for automation
        if (e.href && e.href.startsWith('#')) {
          return false
        }

        // Skip if href already visited
        if (e.href && visitedHrefs.has(e.href)) {
          return false
        }

        // Skip screen-reader-only elements and skip links
        const selector = (e.selector || '').toLowerCase()
        const className = (e.className || '').toLowerCase()
        const text = (e.text || '').toLowerCase()

        // Skip elements with screen-reader-only classes
        if (className.includes('skip-link') ||
            className.includes('screen-reader-text') ||
            className.includes('sr-only') ||
            className.includes('visually-hidden') ||
            className.includes('sr-only-focusable')) {
          return false
        }

        // Skip skip-link selectors
        if (selector.includes('skip-link') || selector.includes('screen-reader')) {
          return false
        }

        // Skip elements with "skip to" text (accessibility skip links)
        if (text.includes('skip to') || text.includes('skip to content')) {
          return false
        }

        // Skip contact/support elements that are not navigation links
        if ((text.includes('support@') || text.includes('contact@') || text.includes('+91') || text.includes('call to')) && !e.href) {
          return false
        }

        return true
      })
      .map((e: VisionElement) => {
        // Add testability score to element
        const testability = getTestability(e.selector)
        return {
          ...e,
          testability, // Add testability metadata
        }
      })
      .sort((a, b) => {
        // Sort by testability: high > medium > low > null
        const testabilityOrder = { high: 3, medium: 2, low: 1, null: 0 }
        const aOrder = testabilityOrder[a.testability || 'null']
        const bOrder = testabilityOrder[b.testability || 'null']
        
        if (aOrder !== bOrder) {
          return bOrder - aOrder // Higher testability first
        }
        
        // If same testability, prefer interactive elements
        const aInteractive = a.actionable || a.href || a.type === 'button' || a.type === 'link'
        const bInteractive = b.actionable || b.href || b.type === 'button' || b.type === 'link'
        
        if (aInteractive !== bInteractive) {
          return aInteractive ? -1 : 1
        }
        
        return 0
      })

    // Create filtered context
    const filteredContext: VisionContext = {
      ...context,
      elements: filteredElements,
    }

    return {
      context,
      filteredContext,
      currentUrl,
      comprehensiveData,
    }
  }

  /**
   * Prepare tracking info for LLM action generation
   */
  prepareTrackingInfo(params: PrepareTrackingInfoParams): TrackingInfo {
    const {
      visitedUrls,
      visitedSelectors,
      discoveredPages,
      currentUrl,
      options,
      environment
    } = params

    return {
      visitedUrls: Array.from(visitedUrls),
      visitedSelectors: Array.from(visitedSelectors),
      discoveredPages,
      currentUrl,
      isAllPagesMode: options?.allPages || options?.testMode === 'all',
      browser: environment.browser as 'chromium' | 'firefox' | 'webkit',
      viewport: environment.viewport,
    }
  }
}

