// Test job processor with step-by-step execution and pause/resume support
import { JobData, TestRunStatus, BuildType, LLMAction, TestStep } from '../types'
import { MistralService } from '../services/mistral'
import { DeepseekService } from '../services/deepseek'
import { StorageService } from '../services/storage'
import { PineconeService } from '../services/pinecone'
import { PlaywrightRunner } from '../runners/playwright'
import { AppiumRunner } from '../runners/appium'
import { config } from '../config/env'
import { formatErrorForStep } from '../utils/errorFormatter'
import { ComprehensiveTestingService, ComprehensiveTestResults } from '../services/comprehensiveTesting'

export class TestProcessor {
  private mistralService: MistralService
  private deepseekService: DeepseekService | null
  private storageService: StorageService
  private pineconeService: PineconeService | null
  private playwrightRunner: PlaywrightRunner
  private appiumRunner: AppiumRunner
  private apiUrl: string
  private comprehensiveTesting: ComprehensiveTestingService

  constructor(
    mistralService: MistralService,
    deepseekService: DeepseekService | null,
    storageService: StorageService,
    pineconeService: PineconeService | null,
    playwrightRunner: PlaywrightRunner,
    appiumRunner: AppiumRunner
  ) {
    this.mistralService = mistralService
    this.deepseekService = deepseekService
    this.storageService = storageService
    this.pineconeService = pineconeService
    this.playwrightRunner = playwrightRunner
    this.appiumRunner = appiumRunner
    this.apiUrl = config.api.url || process.env.API_URL || 'http://localhost:3001'
    this.comprehensiveTesting = new ComprehensiveTestingService()
  }

  /**
   * Check if test run is paused
   */
  private async isPaused(runId: string): Promise<boolean> {
    try {
      const fetch = (await import('node-fetch')).default
      const response = await fetch(`${this.apiUrl}/api/tests/${runId}`)
      if (!response.ok) return false
      const data = await response.json()
      return data.testRun?.paused === true
    } catch (error) {
      console.error(`[${runId}] Failed to check pause status:`, error)
      return false
    }
  }

  /**
   * Get test run status
   */
  private async getTestRunStatus(runId: string): Promise<string | null> {
    try {
      const fetch = (await import('node-fetch')).default
      const response = await fetch(`${this.apiUrl}/api/tests/${runId}`)
      if (!response.ok) return null
      const data = await response.json()
      return data.testRun?.status || null
    } catch (error) {
      console.error(`[${runId}] Failed to get test run status:`, error)
      return null
    }
  }

  /**
   * Save checkpoint after each step
   */
  private async saveCheckpoint(
    runId: string,
    stepNumber: number,
    steps: TestStep[],
    artifacts: string[]
  ): Promise<void> {
    try {
      const fetch = (await import('node-fetch')).default
      await fetch(`${this.apiUrl}/api/tests/${runId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: TestRunStatus.RUNNING,
          currentStep: stepNumber,
          steps: steps,
        }),
      })
    } catch (error) {
      console.error(`[${runId}] Failed to save checkpoint:`, error)
    }
  }

  /**
   * Process a test run job step-by-step with pause/resume support
   */
  async process(jobData: JobData): Promise<{ success: boolean; steps: TestStep[]; artifacts: string[] }> {
    const { runId, build, profile, options } = jobData
    const isAllPagesMode = options?.allPages || options?.testMode === 'all'
    const isMultiPageMode = options?.testMode === 'multi'
    const MIN_STEPS_ALL_PAGES = 50
    const MIN_STEPS_MULTI_PAGE = 20
    const DEFAULT_MAX_STEPS = 15

    const requestedMaxSteps = options?.maxSteps
    let maxSteps = requestedMaxSteps ?? (isAllPagesMode
      ? MIN_STEPS_ALL_PAGES
      : isMultiPageMode
        ? MIN_STEPS_MULTI_PAGE
        : DEFAULT_MAX_STEPS)

    if (isAllPagesMode && maxSteps < MIN_STEPS_ALL_PAGES) {
      maxSteps = MIN_STEPS_ALL_PAGES
    } else if (isMultiPageMode && maxSteps < MIN_STEPS_MULTI_PAGE) {
      maxSteps = MIN_STEPS_MULTI_PAGE
    } else if (!requestedMaxSteps && maxSteps < DEFAULT_MAX_STEPS) {
      maxSteps = DEFAULT_MAX_STEPS
    }

    const maxDuration = (profile.maxMinutes || 10) * 60 * 1000 // Convert to milliseconds
    const startTime = Date.now()

    console.log(`[${runId}] Starting test run:`, { build: build.type, device: profile.device })
    console.log(`[${runId}] Effective max steps: ${maxSteps} (requested: ${requestedMaxSteps ?? 'default'}, mode: ${options?.testMode || 'single'})`)

    let session: any = null
    const steps: TestStep[] = []
    const artifacts: string[] = []
    let stepNumber = 0

    try {
      // Select runner based on build type
      const isMobile = build.type === BuildType.ANDROID || build.type === BuildType.IOS
      const runner = isMobile ? this.appiumRunner : this.playwrightRunner

      // Reserve test runner session
      console.log(`[${runId}] Reserving ${build.type} session...`)
      session = await runner.reserveSession(profile)

      // Update status to running
      const fetch = (await import('node-fetch')).default
      await fetch(`${this.apiUrl}/api/tests/${runId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: TestRunStatus.RUNNING,
          startedAt: new Date().toISOString(),
        }),
      })

      // Navigate to initial URL if web
      if (build.type === BuildType.WEB && build.url) {
        const navigateAction: LLMAction = {
          action: 'navigate',
          value: build.url,
          description: `Navigate to ${build.url}`,
        }
        await runner.executeAction(session.id, navigateAction)
        await new Promise(resolve => setTimeout(resolve, 2000)) // Wait for page load
        
        // Capture initial screenshot after navigation
        try {
          console.log(`[${runId}] Capturing initial screenshot after navigation...`)
          const initialScreenshot = await runner.captureScreenshot(session.id)
          const screenshotBuffer = Buffer.from(initialScreenshot, 'base64')
          const screenshotUrl = await this.storageService.uploadScreenshot(
            runId,
            0, // Step 0 = initial state
            screenshotBuffer
          )
          
          // Create initial step to show page loaded
          const initialStep: TestStep = {
            id: `step_${runId}_0`,
            stepNumber: 0,
            action: 'navigate',
            target: build.url,
            timestamp: new Date().toISOString(),
            screenshotUrl,
            success: true,
          }
          steps.push(initialStep)
          artifacts.push(screenshotUrl)
          await this.saveCheckpoint(runId, 0, steps, artifacts)
        } catch (screenshotError: any) {
          console.warn(`[${runId}] Failed to capture initial screenshot:`, screenshotError.message)
        }
      }

      // Main test loop - step by step
      // Step 1: Use Deepseek to understand user instructions
      const userInstructions = options?.coverage?.[0] || ''
      let parsedInstructions = null
      let goal = ''
      
      if (userInstructions && this.deepseekService) {
        try {
          console.log(`[${runId}] Using Deepseek to parse user instructions: "${userInstructions}"`)
          parsedInstructions = await this.deepseekService.parseInstructions(userInstructions, build.url)
          console.log(`[${runId}] Deepseek parsed instructions:`, JSON.stringify(parsedInstructions, null, 2))
          
          // Build comprehensive goal from parsed instructions
          const instructionsSummary = `
🎯 PRIMARY GOAL: ${parsedInstructions.primaryGoal}

📋 SPECIFIC ACTIONS TO PERFORM:
${parsedInstructions.specificActions.map((a, i) => `${i + 1}. ${a}`).join('\n')}

🔍 ELEMENTS TO CHECK:
${parsedInstructions.elementsToCheck.map((e, i) => `${i + 1}. ${e}`).join('\n')}

✅ EXPECTED OUTCOMES:
${parsedInstructions.expectedOutcomes.length > 0 
  ? parsedInstructions.expectedOutcomes.map((o, i) => `${i + 1}. ${o}`).join('\n')
  : 'Verify all actions complete successfully'}

📝 STRUCTURED PLAN:
${parsedInstructions.structuredPlan}
`
          
          // Combine with test mode requirements
          if (options?.allPages || options?.testMode === 'all') {
            goal = `USER INSTRUCTIONS (PARSED BY DEEPSEEK - HIGHEST PRIORITY):\n${instructionsSummary}\n\nAdditionally, discover and test all pages on the website starting from ${build.url}. Navigate through all internal links, test each page, and ensure all pages are functional.`
          } else if (options?.testMode === 'multi') {
            goal = `USER INSTRUCTIONS (PARSED BY DEEPSEEK - HIGHEST PRIORITY):\n${instructionsSummary}\n\nAdditionally, navigate through all specified pages and test functionality.`
          } else {
            goal = `USER INSTRUCTIONS (PARSED BY DEEPSEEK - HIGHEST PRIORITY):\n${instructionsSummary}`
          }
        } catch (error: any) {
          console.error(`[${runId}] Deepseek parsing failed:`, error.message)
          console.log(`[${runId}] Falling back to direct instruction usage`)
          // Fallback to direct instructions
          goal = `USER INSTRUCTIONS (PRIORITY): ${userInstructions}`
        }
      } else if (userInstructions) {
        // Deepseek not available, use instructions directly
        console.log(`[${runId}] Deepseek not available, using instructions directly: ${userInstructions}`)
        if (options?.allPages || options?.testMode === 'all') {
          goal = `USER INSTRUCTIONS (PRIORITY): ${userInstructions}\n\nAdditionally, discover and test all pages on the website starting from ${build.url}. Navigate through all internal links, test each page, and ensure all pages are functional.`
        } else if (options?.testMode === 'multi') {
          goal = `USER INSTRUCTIONS (PRIORITY): ${userInstructions}\n\nAdditionally, navigate through all specified pages and test functionality.`
        } else {
          goal = `USER INSTRUCTIONS (PRIORITY): ${userInstructions}`
        }
      } else {
        // No user instructions - use default based on mode
        if (options?.allPages || options?.testMode === 'all') {
          goal = `Discover and test all pages on the website starting from ${build.url}. Navigate through all internal links, test each page, and ensure all pages are functional.`
          console.log(`[${runId}] All pages mode enabled - will discover and test all pages`)
        } else if (options?.testMode === 'multi') {
          goal = 'Navigate through all specified pages and test functionality.'
        } else {
          goal = 'Perform basic user flow test'
        }
      }
      
      const history: Array<{ action: LLMAction; timestamp: string }> = []
      
      // Track visited URLs and elements to prevent repetition
      const visitedUrls = new Set<string>([build.url || ''])
      const visitedSelectors = new Set<string>()
      const visitedHrefs = new Set<string>()
      
      // Site discovery for "all pages" mode
      let discoveredPages: Array<{ url: string; title: string; selector: string }> = []
      let siteDiscoveryComplete = false
      
      // Store user instructions for logging in each step
      const hasUserInstructions = !!userInstructions
      
      // Site discovery phase for "all pages" mode
      if ((options?.allPages || options?.testMode === 'all') && !siteDiscoveryComplete) {
        try {
          console.log(`[${runId}] Starting site discovery phase - mapping all pages from landing page...`)
          const discoveryDom = await (isMobile 
            ? this.appiumRunner.getPageSource(session.id)
            : this.playwrightRunner.getDOMSnapshot(session.id))
          
          // Extract all internal links from the page
          const baseUrl = new URL(build.url || '').origin
          const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi
          let linkMatch
          const uniqueLinks = new Set<string>()
          
          while ((linkMatch = linkRegex.exec(discoveryDom)) !== null) {
            const href = linkMatch[1]
            const text = linkMatch[2].trim()
            
            // Only include internal links
            if (href && !href.startsWith('mailto:') && !href.startsWith('tel:') && !href.startsWith('javascript:')) {
              let fullUrl = href
              if (href.startsWith('/')) {
                fullUrl = `${baseUrl}${href}`
              } else if (href.startsWith('http')) {
                try {
                  const linkUrl = new URL(href)
                  if (linkUrl.origin === baseUrl) {
                    fullUrl = href
                  } else {
                    continue // Skip external links
                  }
                } catch {
                  continue
                }
              } else if (!href.startsWith('#')) {
                fullUrl = `${baseUrl}/${href}`
              } else {
                continue // Skip anchor links
              }
              
              if (!uniqueLinks.has(fullUrl) && !fullUrl.includes('#')) {
                uniqueLinks.add(fullUrl)
                discoveredPages.push({
                  url: fullUrl,
                  title: text || fullUrl,
                  selector: `a[href="${href.replace(/"/g, '\\"')}"]`
                })
              }
            }
          }
          
          console.log(`[${runId}] Site discovery complete: Found ${discoveredPages.length} unique pages to test`)
          siteDiscoveryComplete = true
        } catch (discoveryError: any) {
          console.warn(`[${runId}] Site discovery failed:`, discoveryError.message)
        }
      }

      while (stepNumber < maxSteps && Date.now() - startTime < maxDuration) {
        // Check if test run has been stopped or cancelled
        const testRunStatus = await this.getTestRunStatus(runId)
        if (testRunStatus === 'completed' || testRunStatus === 'cancelled' || testRunStatus === 'failed') {
          console.log(`[${runId}] Test run has been ${testRunStatus}. Stopping execution.`)
          break
        }
        
        // Check if paused before each step
        const paused = await this.isPaused(runId)
        if (paused) {
          console.log(`[${runId}] Test is paused at step ${stepNumber}. Waiting...`)
          // Wait and check again
          await new Promise(resolve => setTimeout(resolve, 2000))
          continue
        }

        stepNumber++

        // Declare action outside try block so it's accessible in catch
        let action: LLMAction | null = null

        try {
          // Capture screenshot
          console.log(`[${runId}] Step ${stepNumber}: Capturing screenshot...`)
          const screenshot = await runner.captureScreenshot(session.id)
          console.log(`[${runId}] Step ${stepNumber}: Screenshot captured (${screenshot.length} chars)`)
          
          // Get DOM snapshot to extract real elements
          console.log(`[${runId}] Step ${stepNumber}: Getting DOM snapshot...`)
          const domSnapshot = await (isMobile 
            ? this.appiumRunner.getPageSource(session.id)
            : this.playwrightRunner.getDOMSnapshot(session.id))
          console.log(`[${runId}] Step ${stepNumber}: DOM snapshot captured (${domSnapshot.length} chars)`)
          
          // Collect comprehensive testing data (only for web, not mobile)
          let comprehensiveData: ComprehensiveTestResults | null = null
          if (!isMobile && this.playwrightRunner) {
            try {
              const sessionData = this.playwrightRunner.getSession(session.id)
              if (sessionData?.page) {
                // Initialize comprehensive testing if not already done
                if (stepNumber === 1) {
                  await this.comprehensiveTesting.initialize(sessionData.page)
                }
                
                // Collect data at key steps (every 3 steps or on first step)
                if (stepNumber === 1 || stepNumber % 3 === 0) {
                  console.log(`[${runId}] Step ${stepNumber}: Collecting comprehensive test data...`)
                  await Promise.all([
                    this.comprehensiveTesting.collectPerformanceMetrics(sessionData.page),
                    this.comprehensiveTesting.checkAccessibility(sessionData.page),
                    this.comprehensiveTesting.analyzeDOMHealth(sessionData.page),
                    this.comprehensiveTesting.detectVisualIssues(sessionData.page),
                  ])
                  comprehensiveData = this.comprehensiveTesting.getResults()
                  console.log(`[${runId}] Step ${stepNumber}: Comprehensive data collected - ${comprehensiveData.consoleErrors.length} console errors, ${comprehensiveData.networkErrors.length} network errors`)
                }
              }
            } catch (compError: any) {
              console.warn(`[${runId}] Step ${stepNumber}: Failed to collect comprehensive data:`, compError.message)
            }
          }
          
          // Analyze screenshot and DOM with Mistral
          console.log(`[${runId}] Step ${stepNumber}: Analyzing with Mistral...`)
          const context = await this.mistralService.analyzeScreenshot(screenshot, domSnapshot, goal)
          console.log(`[${runId}] Step ${stepNumber}: Found ${context.elements.length} interactive elements`)
          
          // Log user instructions if present (remind AI of priority)
          if (hasUserInstructions) {
            console.log(`[${runId}] Step ${stepNumber}: 🎯 Following user instructions: "${userInstructions}"`)
          }

          // Get current URL to track navigation
          const currentUrl = await (isMobile 
            ? this.appiumRunner.getCurrentUrl(session.id).catch(() => build.url || '')
            : this.playwrightRunner.getCurrentUrl(session.id).catch(() => build.url || ''))
          visitedUrls.add(currentUrl)
          
          // Filter out already visited elements and non-navigational elements
          const filteredElements = context.elements.filter((e: any) => {
            // Skip if selector already visited
            if (e.selector && visitedSelectors.has(e.selector)) {
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
          
          // Create filtered context
          const filteredContext = {
            ...context,
            elements: filteredElements,
          }
          
          // Generate next action with filtered context and visited tracking info
          console.log(`[${runId}] Step ${stepNumber}: Generating action with Mistral... (${filteredElements.length} unvisited elements available)`)
          action = await this.mistralService.generateAction(
            filteredContext, 
            history, 
            goal,
            {
              visitedUrls: Array.from(visitedUrls),
              visitedSelectors: Array.from(visitedSelectors),
              discoveredPages: discoveredPages,
              currentUrl: currentUrl,
              isAllPagesMode: options?.allPages || options?.testMode === 'all',
            }
          )
          console.log(`[${runId}] Step ${stepNumber}: Action generated: ${action.action} ${action.target || ''} ${action.selector || ''}`)

          // Prevent getting stuck on "wait" actions
          // If we've had too many consecutive waits, force an interaction
          const recentWaits = history.slice(-3).filter(h => h.action.action === 'wait').length
          if (action.action === 'wait' && recentWaits >= 2 && context.elements.length > 0) {
            console.log(`[${runId}] Too many consecutive waits (${recentWaits}), forcing interaction...`)
            // Find first clickable element
            const clickableElement = context.elements.find(e => 
              e.type === 'button' || e.type === 'link' || e.text
            )
            if (clickableElement) {
              action = {
                action: 'click',
                target: clickableElement.text || 'element',
                selector: clickableElement.selector,
                description: `Click ${clickableElement.text || clickableElement.type} to explore page`,
                confidence: 0.7,
              }
              console.log(`[${runId}] Forced action: ${action.action} on ${action.target}`)
            } else if (history.filter(h => h.action.action === 'scroll').length < 3) {
              action = {
                action: 'scroll',
                description: 'Scroll down to see more content',
                confidence: 0.8,
              }
              console.log(`[${runId}] Forced action: scroll`)
            }
          }

          // Check if test should complete
          // For "all pages" mode, don't complete early - need to discover all pages
          if (action.action === 'complete') {
            const minStepsForAllPages = MIN_STEPS_ALL_PAGES
            
            if (isAllPagesMode && stepNumber < minStepsForAllPages) {
              console.log(`[${runId}] All pages mode: Ignoring early completion at step ${stepNumber}, continuing discovery...`)
              // Override complete action - continue testing
              action = {
                action: 'scroll',
                description: 'Continue exploring to discover more pages',
                confidence: 0.8,
              }
            } else {
              console.log(`[${runId}] Test completed at step ${stepNumber}`)
              break
            }
          }

          // Execute action
          console.log(`[${runId}] Step ${stepNumber}: Executing action:`, action.action, action.target)
          await runner.executeAction(session.id, action)

          // Capture artifacts after action
          const screenshotAfter = await runner.captureScreenshot(session.id)
          const domSnapshotAfter = await (isMobile 
            ? this.appiumRunner.getPageSource(session.id)
            : this.playwrightRunner.getDOMSnapshot(session.id))

          // Store screenshot
          const screenshotBuffer = Buffer.from(screenshotAfter, 'base64')
          const screenshotUrl = await this.storageService.uploadScreenshot(
            runId,
            stepNumber,
            screenshotBuffer
          )
          // Save artifact to database via API
          try {
            const fetch = (await import('node-fetch')).default
            const response = await fetch(`${this.apiUrl}/api/tests/${runId}/artifacts`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'screenshot',
                url: screenshotUrl,
                path: screenshotUrl.split('/').slice(-2).join('/'),
                size: screenshotBuffer.length,
              }),
            })
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${await response.text()}`)
            }
          } catch (artifactError: any) {
            console.warn(`[${runId}] Failed to save screenshot artifact to database:`, artifactError.message)
          }

          // Store DOM snapshot
          const domBuffer = Buffer.from(domSnapshotAfter)
          const domUrl = await this.storageService.uploadDOMSnapshot(
            runId,
            stepNumber,
            domSnapshotAfter
          )
          // Save artifact to database via API
          try {
            const fetch = (await import('node-fetch')).default
            const response = await fetch(`${this.apiUrl}/api/tests/${runId}/artifacts`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'dom',
                url: domUrl,
                path: domUrl.split('/').slice(-2).join('/'),
                size: domBuffer.length,
              }),
            })
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${await response.text()}`)
            }
          } catch (artifactError: any) {
            console.warn(`[${runId}] Failed to save DOM artifact to database:`, artifactError.message)
          }

          // Create test step with comprehensive testing data
          const step: TestStep = {
            id: `step_${runId}_${stepNumber}`,
            stepNumber,
            action: action.action,
            target: action.target,
            value: action.value,
            timestamp: new Date().toISOString(),
            screenshotUrl,
            domSnapshot: domUrl,
            success: true,
            // Include comprehensive testing data if available
            consoleErrors: comprehensiveData?.consoleErrors.map(e => ({
              type: e.type,
              message: e.message,
              timestamp: e.timestamp,
            })),
            networkErrors: comprehensiveData?.networkErrors.map(e => ({
              url: e.url,
              status: e.status,
              timestamp: e.timestamp,
            })),
            performance: comprehensiveData?.performance ? {
              pageLoadTime: comprehensiveData.performance.pageLoadTime,
              firstContentfulPaint: comprehensiveData.performance.firstContentfulPaint,
            } : undefined,
            accessibilityIssues: comprehensiveData?.accessibility.map(a => ({
              type: a.type,
              message: a.message,
              impact: a.impact,
            })),
            visualIssues: comprehensiveData?.visualIssues.map(v => ({
              type: v.type,
              description: v.description,
              severity: v.severity,
            })),
          }

          steps.push(step)
          artifacts.push(screenshotUrl, domUrl)

          // Save checkpoint after each step
          await this.saveCheckpoint(runId, stepNumber, steps, artifacts)

          // Store embedding (if Pinecone is available)
          if (this.pineconeService) {
            await this.pineconeService.storeEmbedding(
              runId,
              stepNumber,
              screenshotAfter,
              action.description,
              {
                action: action.action,
                target: action.target,
                success: true,
              }
            )
          }

          // Add to history
          history.push({
            action,
            timestamp: new Date().toISOString(),
          })

          // Wait between steps
          await new Promise(resolve => setTimeout(resolve, 1000))

        } catch (stepError: any) {
          console.error(`[${runId}] Step ${stepNumber} failed:`, stepError)

          // Try to capture screenshot even on error to see what went wrong
          let errorScreenshotUrl: string | undefined
          try {
            console.log(`[${runId}] Capturing screenshot after error...`)
            const errorScreenshot = await runner.captureScreenshot(session.id)
            const screenshotBuffer = Buffer.from(errorScreenshot, 'base64')
            errorScreenshotUrl = await this.storageService.uploadScreenshot(
              runId,
              stepNumber,
              screenshotBuffer
            )
            artifacts.push(errorScreenshotUrl)
          } catch (screenshotError: any) {
            console.warn(`[${runId}] Failed to capture error screenshot:`, screenshotError.message)
          }

          // Format error with natural language explanation
          const formattedError = formatErrorForStep(stepError, {
            action: action?.action || 'unknown',
            selector: action?.selector,
          })

          const errorStep: TestStep = {
            id: `step_${runId}_${stepNumber}`,
            stepNumber,
            action: action?.action || 'error',
            target: action?.target,
            timestamp: new Date().toISOString(),
            screenshotUrl: errorScreenshotUrl,
            success: false,
            error: formattedError,
          }

          steps.push(errorStep)
          await this.saveCheckpoint(runId, stepNumber, steps, artifacts)

        // If too many consecutive errors, try to recover
        const recentErrors = steps.slice(-5).filter(s => !s.success).length
        if (recentErrors >= 3) {
          console.warn(`[${runId}] Too many consecutive errors (${recentErrors}), attempting recovery...`)
          
          // Try multiple recovery strategies
          let recovered = false
          
          // Strategy 1: Scroll to find new elements
          try {
            await runner.executeAction(session.id, {
              action: 'scroll',
              description: 'Scroll to find new interactive elements',
              confidence: 0.8,
            })
            await new Promise(resolve => setTimeout(resolve, 1000))
            recovered = true
            console.log(`[${runId}] Recovery: Scrolled successfully`)
          } catch (scrollError: any) {
            console.warn(`[${runId}] Recovery scroll failed:`, scrollError.message)
          }
          
          // Strategy 2: If still failing, try navigating back or refreshing
          if (!recovered && recentErrors >= 5) {
            try {
              const currentUrl = await (isMobile 
                ? this.appiumRunner.getCurrentUrl(session.id).catch(() => build.url || '')
                : this.playwrightRunner.getCurrentUrl(session.id).catch(() => build.url || ''))
              
              // Try navigating to a different page or refreshing
              if (currentUrl && currentUrl !== build.url) {
                console.log(`[${runId}] Recovery: Attempting to navigate to a different page`)
                await runner.executeAction(session.id, {
                  action: 'navigate',
                  value: build.url || currentUrl,
                  description: 'Navigate to recover from errors',
                  confidence: 0.7,
                })
                await new Promise(resolve => setTimeout(resolve, 2000))
                recovered = true
              }
            } catch (navError: any) {
              console.warn(`[${runId}] Recovery navigation failed:`, navError.message)
            }
          }
          
          // Only fail if we have many total errors and recovery didn't help
          const totalErrors = steps.filter(s => !s.success).length
          if (totalErrors >= 10 && !recovered) {
            const errorMsg = `Too many errors (${totalErrors}) in test run - test failed after recovery attempts`
            const formattedError = formatErrorForStep(new Error(errorMsg))
            throw new Error(formattedError)
          } else if (totalErrors >= 15) {
            // Hard limit - fail regardless of recovery
            const errorMsg = `Too many errors (${totalErrors}) in test run - test failed (hard limit reached)`
            const formattedError = formatErrorForStep(new Error(errorMsg))
            throw new Error(formattedError)
          }
        }
        }
      }

      // Note: Video will be uploaded in finally block when session is released

      // Store test trace in Pinecone (if available)
      if (this.pineconeService) {
        await this.pineconeService.storeTestTrace(
          runId,
          steps.map(s => ({
            stepNumber: s.stepNumber,
            action: s.action,
            screenshot: s.screenshotUrl || '',
            success: s.success,
          }))
        )
      }

      console.log(`[${runId}] Test run completed: ${steps.length} steps, ${artifacts.length} artifacts`)

      return {
        success: true,
        steps,
        artifacts,
      }

    } catch (error: any) {
      console.error(`[${runId}] Test run failed:`, error)
      
      // Record final error step
      steps.push({
        id: `step_${runId}_error`,
        stepNumber: stepNumber + 1,
        action: 'error',
        timestamp: new Date().toISOString(),
        success: false,
        error: error.message,
      })

      return {
        success: false,
        steps,
        artifacts,
      }
    } finally {
      // Release session and finalize video
      if (session) {
        const runner = build.type === BuildType.WEB 
          ? this.playwrightRunner 
          : this.appiumRunner
        
        if (build.type === BuildType.WEB) {
          // For Playwright, releaseSession returns video path
          const videoPath = await this.playwrightRunner.releaseSession(session.id)
          
          // Upload video if we have it
          if (videoPath) {
            try {
              const fs = await import('fs/promises')
              const videoBuffer = await fs.readFile(videoPath)
              
              const videoUrl = await this.storageService.uploadVideo(runId, videoBuffer)
              
              // Save video artifact to database via API
              try {
                const fetch = (await import('node-fetch')).default
                const artifactResponse = await fetch(`${this.apiUrl}/api/tests/${runId}/artifacts`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    type: 'video',
                    url: videoUrl,
                    path: videoUrl.split('/').slice(-2).join('/'),
                    size: videoBuffer.length,
                  }),
                })
                if (!artifactResponse.ok) {
                  throw new Error(`HTTP ${artifactResponse.status}: ${await artifactResponse.text()}`)
                }
              } catch (artifactError: any) {
                console.warn(`[${runId}] Failed to save video artifact to database:`, artifactError.message)
              }
              
              // Always store latest video URL on the test run (even if artifact creation failed)
              try {
                const fetch = (await import('node-fetch')).default
                await fetch(`${this.apiUrl}/api/tests/${runId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    artifactsUrl: videoUrl,
                  }),
                })
              } catch (updateError: any) {
                console.warn(`[${runId}] Failed to update test run with video URL:`, updateError.message)
              }
              
              // Clean up local video file
              await fs.unlink(videoPath).catch(() => {})
              console.log(`[${runId}] Video finalized and uploaded: ${videoUrl}`)
            } catch (videoError: any) {
              console.error(`[${runId}] Failed to upload video:`, videoError.message)
            }
          }
        } else {
          await runner.releaseSession(session.id)
        }
        
        console.log(`[${runId}] Session released`)
      }
    }
  }
}
