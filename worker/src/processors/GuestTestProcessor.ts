// GuestTestProcessor - Dedicated processor for guest test flows
// Skips diagnosis phase, enforces 25-step limit, auto-approves actions
// Uses Wasabi for 24-hour artifact storage (cheap, then auto-cleanup)

import {
    JobData,
    TestRunStatus,
    LLMAction,
    TestStep,
    VisionContext,
    TestProfile,
    TestOptions,
    DeviceProfile,
} from '../types'
import { UnifiedBrainService } from '../services/unifiedBrainService'
import { StorageService } from '../services/storage'
import { PlaywrightRunner, RunnerSession } from '../runners/playwright'
import { formatErrorForStep } from '../utils/errorFormatter'
import { WebRTCStreamer } from '../services/webrtcStreamer'
import { IntelligentRetryLayer } from '../services/intelligentRetryLayer'
import { RunLogger } from '../loggers/runLogger'
import { ContextSynthesizer } from '../synthesizers/contextSynthesizer'
import { TestExecutor } from '../executors/testExecutor'
import { ComprehensiveTestingService } from '../services/comprehensiveTesting'
import { WasabiStorageService, createWasabiStorage } from '../services/wasabiStorage'
import { TraceService, createTraceService } from '../services/traceService'
import Redis from 'ioredis'

export interface GuestProcessResult {
    success: boolean
    steps: TestStep[]
    artifacts: string[]
    stage: 'execution'
}

/**
 * Guest Test Processor - Simplified processor for guest test flows
 * 
 * Key differences from TestProcessor:
 * - NO diagnosis phase - direct to execution
 * - 25-step max limit
 * - Auto-approval mode (no waiting)
 * - Simplified services (no Pinecone, no visual diff)
 * - Uses Wasabi for cheap 24-hour artifact storage
 */
export class GuestTestProcessor {
    private unifiedBrain: UnifiedBrainService
    private storageService: StorageService
    private playwrightRunner: PlaywrightRunner
    private redis: Redis
    private apiUrl: string
    private comprehensiveTesting: ComprehensiveTestingService
    private streamer: WebRTCStreamer | null = null
    private retryLayer: IntelligentRetryLayer | null = null
    private runLogger: RunLogger
    private contextSynthesizer: ContextSynthesizer
    private testExecutor: TestExecutor

    // Wasabi storage for guest artifacts (24hr retention)
    private wasabiStorage: WasabiStorageService | null = null
    private traceService: TraceService

    // Guest test constants
    private readonly MAX_GUEST_STEPS = 25
    private readonly MAX_DURATION_MS = 5 * 60 * 1000 // 5 minutes

    constructor(
        unifiedBrain: UnifiedBrainService,
        storageService: StorageService,
        playwrightRunner: PlaywrightRunner
    ) {
        this.unifiedBrain = unifiedBrain
        this.storageService = storageService
        this.playwrightRunner = playwrightRunner
        this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')
        
        // Use environment variables directly with fallbacks (don't depend on config object)
        // This prevents "config is not defined" errors if config initialization fails
        const apiUrl = process.env.API_URL || 'http://localhost:3001'
        this.apiUrl = apiUrl
        this.comprehensiveTesting = new ComprehensiveTestingService()

        // Initialize Wasabi for guest artifacts (cheaper than Supabase)
        // Check environment variables directly (don't depend on config object)
        const wasabiEnabled = !!(process.env.WASABI_ACCESS_KEY && process.env.WASABI_SECRET_KEY)
        if (wasabiEnabled) {
            this.wasabiStorage = createWasabiStorage()
            console.log('✅ GuestTestProcessor: Wasabi storage enabled for 24hr artifacts')
        }
        this.traceService = createTraceService(this.wasabiStorage)

        // Initialize Intelligent Retry Layer
        this.retryLayer = new IntelligentRetryLayer(
            unifiedBrain,
            playwrightRunner,
            undefined, // No Appium for guest tests
            {
                maxRetries: 2,
                initialDelay: 300,
                maxDelay: 2000,
                enableVisionMatching: false,
                enableAIAlternatives: true,
            }
        )

        // Initialize services
        this.runLogger = new RunLogger(storageService, null, this.apiUrl)
        this.contextSynthesizer = new ContextSynthesizer(unifiedBrain, this.comprehensiveTesting)
        this.testExecutor = new TestExecutor(playwrightRunner, null, this.retryLayer)
    }

    /**
     * Process a guest test run - NO DIAGNOSIS, direct to execution
     */
    async process(jobData: JobData): Promise<GuestProcessResult> {
        const { runId, build, profile, options } = jobData

        console.log(`[${runId}] 🎯 GUEST TEST: Starting (skipDiagnosis=true, maxSteps=${this.MAX_GUEST_STEPS})`)

        // Update status to running immediately
        await this.updateTestRunStatus(runId, TestRunStatus.RUNNING)

        const steps: TestStep[] = []
        const artifacts: string[] = []
        let session: RunnerSession | null = null
        let testStatus: 'completed' | 'failed' = 'completed'

        // Initialize trace for this run (will be saved to Wasabi)
        const trace = this.traceService.createTrace(
            runId,
            build.url || '',
            'chromium', // Guest tests are Chrome-only
            '1280x720'
        )

        try {
            // Reserve browser session with proper TestProfile
            session = await this.playwrightRunner.reserveSession(profile)

            console.log(`[${runId}] Browser session reserved: ${session.id}`)

            // Navigate to target URL using executeAction
            await this.playwrightRunner.executeAction(session.id, {
                action: 'navigate',
                value: build.url || '',
                description: 'Navigate to target URL',
            })
            console.log(`[${runId}] Navigated to: ${build.url}`)

            // DEBUG: File logging
            try {
                const fs = await import('fs');
                const path = await import('path');
                const logPath = path.resolve(process.cwd(), 'guest-debug.log');
                const log = (msg: string) => fs.appendFileSync(logPath, `[${new Date().toISOString()}] [${runId}] ${msg}\n`);

                log(`Starting guest test for ${build.url} (Type: ${options?.guestTestType || 'default'})`);

                // Add navigation step to trace
                this.traceService.addStep(runId, {
                    action: 'navigate',
                    target: build.url || '',
                    success: true,
                    description: 'Navigate to target URL',
                })
                log('Navigation step added to trace');

                // Start WebRTC stream if page available
                if (session.page) {
                    await this.startStreaming(runId, session)
                    log('WebRTC stream started');
                }

                // Execute guest test flow
                log('Starting executeGuestFlow...');
                const result = await this.executeGuestFlow(
                    runId,
                    session,
                    build.url || '',
                    options || {},
                    steps,
                    artifacts
                )
                log(`executeGuestFlow returned: success=${result.success}`);

                return result;
            } catch (err: any) {
                const fs = await import('fs');
                const path = await import('path');
                const logPath = path.resolve(process.cwd(), 'guest-debug.log');
                fs.appendFileSync(logPath, `[${new Date().toISOString()}] [${runId}] CRITICAL ERROR in process: ${err.message}\n${err.stack}\n`);
                throw err;
            }
        } catch (error: any) {
            console.error(`[${runId}] Guest test failed:`, error.message)
            testStatus = 'failed'

            // Mark trace as failed
            this.traceService.markFailed(runId, steps.length, error.message)

            await this.updateTestRunStatus(runId, TestRunStatus.FAILED, error.message)

            return {
                success: false,
                steps,
                artifacts,
                stage: 'execution',
            }
        } finally {
            // Cleanup and save artifacts
            if (session) {
                await this.stopStreaming()
                await this.uploadVideo(runId, session.id)
                await this.playwrightRunner.releaseSession(session.id)
            }

            // Save trace to Wasabi (24hr retention for guest tests)
            try {
                const traceUrl = await this.traceService.saveTrace(runId, testStatus)
                if (traceUrl) {
                    console.log(`[${runId}] Trace saved to Wasabi: ${traceUrl}`)
                    artifacts.push(traceUrl)
                }
            } catch (err: any) {
                console.warn(`[${runId}] Failed to save trace:`, err.message)
            }
        }
    }

    /**
     * Execute the guest test flow - step-by-step AI-driven testing
     */
    private async executeGuestFlow(
        runId: string,
        session: RunnerSession,
        targetUrl: string,
        options: Partial<TestOptions>,
        steps: TestStep[],
        artifacts: string[]
    ): Promise<GuestProcessResult> {
        const startTime = Date.now()
        let stepNumber = 0

        // Build goal based on guest test type
        const guestTestType = options.guestTestType
        const guestCredentials = options.guestCredentials

        const goal = this.buildGuestGoal(guestTestType, guestCredentials, targetUrl)
        console.log(`[${runId}] Guest test goal: ${goal.substring(0, 100)}...`)

        // Test-specific pre-checks
        if (guestTestType === 'signup') {
            // Check for CAPTCHA early - if detected, mark test as BLOCKED
            const captchaCheck = await this.detectCaptcha(session.id)
            if (captchaCheck.detected) {
                console.log(`[${runId}] CAPTCHA detected (${captchaCheck.type}), marking test as BLOCKED`)
                const blockedStep: TestStep = {
                    id: `step_${runId}_blocked`,
                    stepNumber: 0,
                    action: 'blocked',
                    target: 'CAPTCHA/Verification Blocker',
                    timestamp: new Date().toISOString(),
                    success: false,
                    error: `Test blocked: CAPTCHA or verification blocker detected (type: ${captchaCheck.type}, selector: ${captchaCheck.selector}). Automated testing cannot proceed.`,
                    environment: { browser: 'chromium', viewport: '1280x720' },
                }
                steps.push(blockedStep)
                await this.updateTestRunStatus(runId, TestRunStatus.FAILED, 'BLOCKED: CAPTCHA detected', steps)
                return {
                    success: false,
                    steps,
                    artifacts,
                    stage: 'execution',
                }
            }
        }

        // Track visited elements
        const visitedSelectors = new Set<string>()
        const visitedUrls = new Set<string>([targetUrl])
        const history: Array<{ action: LLMAction; timestamp: string }> = []
        
        // Track mobile viewport testing for visual tests
        let mobileViewportTested = false
        
        // Track attempted selectors for fallback guard (prevent infinite loops)
        const attemptedSelectors = new Set<string>()
        
        // Track progress to detect stuck states
        let lastSuccessfulStep = 0
        let consecutiveFailures = 0
        const MAX_CONSECUTIVE_FAILURES = 5

        // Main execution loop
        while (stepNumber < this.MAX_GUEST_STEPS && Date.now() - startTime < this.MAX_DURATION_MS) {
            stepNumber++

            try {
                // Synthesize context
                // DEBUG: File logging
                const fs = await import('fs');
                const path = await import('path');
                const logPath = path.resolve(process.cwd(), 'guest-debug.log');
                const log = (msg: string) => fs.appendFileSync(logPath, `[${new Date().toISOString()}] [${runId}] [Step ${stepNumber}] ${msg}\n`);

                log('Synthesizing context...');
                const contextResult = await this.contextSynthesizer.synthesizeContext({
                    sessionId: session.id,
                    isMobile: false,
                    goal,
                    visitedSelectors,
                    visitedUrls,
                    visitedHrefs: new Set(),
                    blockedSelectors: new Set(),
                    isSelectorBlocked: () => false,
                    comprehensiveTesting: this.comprehensiveTesting,
                    playwrightRunner: this.playwrightRunner,
                    appiumRunner: undefined,
                    stepNumber,
                    runId,
                    browserType: 'chromium',
                    testableComponents: [],
                })
                log(`Context synthesized. URL: ${contextResult.currentUrl}`);

                const { filteredContext, currentUrl, comprehensiveData } = contextResult

                // Generate next action
                log('Generating AI action...');
                const action = await this.generateAction(
                    runId,
                    filteredContext,
                    history,
                    goal,
                    visitedSelectors,
                    visitedUrls,
                    currentUrl,
                    attemptedSelectors
                )
                log(`AI Action generated: ${action.action} ${action.selector || ''}`);

                // Check for completion
                if (action.action === 'complete') {
                    console.log(`[${runId}] Guest test completed at step ${stepNumber}`)
                    log('Action is complete. Breaking loop.');
                    break
                }

                // Execute action
                console.log(`[${runId}] Step ${stepNumber}: ${action.action} ${action.target || action.selector || ''}`)
                log('Executing action...');

                const executionResult = await this.testExecutor.executeAction({
                    sessionId: session.id,
                    action,
                    context: filteredContext,
                    isMobile: false,
                    enableIRL: true,
                    retryLayer: this.retryLayer,
                    playwrightRunner: this.playwrightRunner,
                    appiumRunner: undefined,
                    runId,
                    browserType: 'chromium',
                    stepNumber,
                })
                log('Action executed.');

                // Capture state
                log('Capturing state...');
                const stateResult = await this.testExecutor.captureState(session.id, false)
                log('State captured.');

                // Broadcast frame via Redis
                if (stateResult?.screenshot) {
                    this.broadcastPageState(runId, stateResult.screenshot, currentUrl || '')
                }

                // Upload artifacts
                const screenshotBuffer = Buffer.isBuffer(stateResult.screenshot)
                    ? stateResult.screenshot
                    : Buffer.from(stateResult.screenshot, 'base64')

                log('Logging artifacts/checkpoint...');
                const artifactResult = await this.runLogger.logArtifacts({
                    runId,
                    stepNumber,
                    screenshot: screenshotBuffer,
                    domSnapshot: stateResult.domSnapshot,
                    metadata: { browser: 'chromium', viewport: '1280x720' },
                })

                // Extract visual issues from comprehensiveData if available
                let visualIssues = comprehensiveData?.visualIssues || []
                
                // Test-specific enhancements
                let enhancedAccessibilityIssues = comprehensiveData?.accessibility || []
                
                // Accessibility: Add heading hierarchy and keyboard trap validation
                if (guestTestType === 'accessibility') {
                    const headingIssues = await this.validateHeadingHierarchy(session.id)
                    const keyboardTraps = await this.detectKeyboardTraps(session.id)
                    
                    // Convert to accessibility issue format
                    enhancedAccessibilityIssues = [
                        ...enhancedAccessibilityIssues,
                        ...headingIssues.map(issue => ({
                            id: `heading-${Date.now()}-${Math.random()}`,
                            type: (issue.type === 'heading-hierarchy' ? 'error' : 'warning') as 'error' | 'warning',
                            message: issue.message,
                            element: issue.selector,
                            selector: issue.selector,
                            impact: (issue.severity === 'high' ? 'serious' : issue.severity === 'medium' ? 'moderate' : 'minor') as 'critical' | 'serious' | 'moderate' | 'minor',
                        })),
                        ...keyboardTraps.map(trap => ({
                            id: `keyboard-trap-${Date.now()}-${Math.random()}`,
                            type: 'warning' as const,
                            message: trap.message,
                            element: trap.selector,
                            selector: trap.selector,
                            impact: (trap.severity === 'high' ? 'serious' : trap.severity === 'medium' ? 'moderate' : 'minor') as 'critical' | 'serious' | 'moderate' | 'minor',
                        })),
                    ]
                }
                
                // Navigation: Explicitly check for 404 errors and console errors
                if (guestTestType === 'navigation' && action.action === 'navigate') {
                    const currentUrlAfterNav = await this.playwrightRunner.getCurrentUrl(session.id).catch(() => currentUrl || '')
                    const is404 = currentUrlAfterNav.includes('404') || 
                                 (await session.page?.evaluate(() => {
                                     const bodyText = document.body.textContent?.toLowerCase() || ''
                                     return bodyText.includes('404') || bodyText.includes('not found') || bodyText.includes('page not found')
                                 }).catch(() => false)) || false
                    
                    if (is404) {
                        // Add navigation error to step
                        const navError = {
                            type: 'missing-element' as const,
                            description: `404 error detected at ${currentUrlAfterNav}`,
                            severity: 'high' as const,
                        }
                        visualIssues = [...visualIssues, navError]
                    }
                }

                // Create step record with comprehensive data persistence
                const step: TestStep = {
                    id: `step_${runId}_${stepNumber}`,
                    stepNumber,
                    action: action.action,
                    target: action.target,
                    value: action.value,
                    timestamp: new Date().toISOString(),
                    screenshotUrl: artifactResult.screenshotUrl,
                    domSnapshot: artifactResult.domUrl,
                    success: true,
                    mode: 'llm',
                    selfHealing: executionResult.healing,
                    // Persist comprehensive testing data (same pattern as TestProcessor)
                    consoleErrors: comprehensiveData?.consoleErrors?.map(e => ({
                        type: e.type,
                        message: e.message,
                        timestamp: e.timestamp,
                    })),
                    networkErrors: comprehensiveData?.networkErrors?.map(e => ({
                        url: e.url,
                        status: e.status,
                        timestamp: e.timestamp,
                    })),
                    accessibilityIssues: enhancedAccessibilityIssues.length > 0
                        ? enhancedAccessibilityIssues.map(a => ({
                            type: a.type,
                            message: a.message,
                            impact: a.impact,
                        }))
                        : undefined,
                    visualIssues: visualIssues.length > 0
                        ? visualIssues.map(v => ({
                            type: v.type,
                            description: v.description,
                            severity: v.severity,
                        }))
                        : undefined,
                    environment: {
                        browser: 'chromium',
                        viewport: '1280x720',
                    },
                }

                steps.push(step)
                artifacts.push(artifactResult.screenshotUrl, artifactResult.domUrl)

                // Update history
                history.push({ action, timestamp: step.timestamp })
                if (action.selector) {
                    visitedSelectors.add(action.selector)
                }
                
                // Track successful progress
                lastSuccessfulStep = stepNumber
                consecutiveFailures = 0

                // Save checkpoint (ensure persistence even if Redis/WebSocket fails)
                try {
                    await this.runLogger.saveCheckpoint(runId, stepNumber, steps, artifacts)
                } catch (checkpointError: any) {
                    // Log but don't fail - steps are already in memory and will be saved on completion
                    console.warn(`[${runId}] Checkpoint save failed (non-blocking):`, checkpointError.message)
                }

            } catch (stepError: any) {
                console.error(`[${runId}] Step ${stepNumber} failed:`, stepError.message)

                // Track consecutive failures for progress detection
                consecutiveFailures++
                
                // Record failed step
                const failedStep: TestStep = {
                    id: `step_${runId}_${stepNumber}`,
                    stepNumber,
                    action: 'error',
                    timestamp: new Date().toISOString(),
                    success: false,
                    error: formatErrorForStep(stepError),
                    environment: { browser: 'chromium', viewport: '1280x720' },
                }
                steps.push(failedStep)
                
                // Try to save checkpoint even on failure (non-blocking)
                try {
                    await this.runLogger.saveCheckpoint(runId, stepNumber, steps, artifacts)
                } catch (checkpointError: any) {
                    console.warn(`[${runId}] Checkpoint save failed on error step (non-blocking):`, checkpointError.message)
                }

                // Break if critical error or too many consecutive failures (stuck state)
                if (stepError.message.includes('Navigation failed') || 
                    stepError.message.includes('Page crashed') ||
                    consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                    console.log(`[${runId}] Breaking execution loop: ${consecutiveFailures} consecutive failures or critical error`)
                    break
                }
            }
        }

        // Visual Testing: Add mobile viewport pass if not already tested
        if (guestTestType === 'visual' && !mobileViewportTested && steps.length > 0) {
            try {
                console.log(`[${runId}] Starting mobile viewport pass (375x812) for visual testing`)
                
                // Switch to mobile viewport
                await this.playwrightRunner.executeAction(session.id, {
                    action: 'setViewport',
                    value: '375x812',
                    description: 'Switch to mobile viewport for responsive testing',
                })
                
                // Wait for layout to stabilize
                await new Promise(resolve => setTimeout(resolve, 1000))
                
                // Navigate back to target URL to test mobile layout
                await this.playwrightRunner.executeAction(session.id, {
                    action: 'navigate',
                    value: targetUrl,
                    description: 'Navigate to target URL in mobile viewport',
                })
                
                await new Promise(resolve => setTimeout(resolve, 2000))
                
                // Capture mobile screenshot and context
                const mobileStateResult = await this.testExecutor.captureState(session.id, false)
                const mobileScreenshotBuffer = Buffer.isBuffer(mobileStateResult.screenshot)
                    ? mobileStateResult.screenshot
                    : Buffer.from(mobileStateResult.screenshot, 'base64')
                
                // Get comprehensive data for mobile viewport
                const mobileContextResult = await this.contextSynthesizer.synthesizeContext({
                    sessionId: session.id,
                    isMobile: false,
                    goal: 'VISUAL TESTING: Check for visual issues in mobile viewport (375x812). Look for layout breaks, overflow, misaligned elements, and responsive design issues.',
                    visitedSelectors: new Set(),
                    visitedUrls: new Set([targetUrl]),
                    visitedHrefs: new Set(),
                    blockedSelectors: new Set(),
                    isSelectorBlocked: () => false,
                    comprehensiveTesting: this.comprehensiveTesting,
                    playwrightRunner: this.playwrightRunner,
                    appiumRunner: undefined,
                    stepNumber: stepNumber + 1,
                    runId,
                    browserType: 'chromium',
                    testableComponents: [],
                })
                
                const mobileComprehensiveData = mobileContextResult.comprehensiveData
                const mobileVisualIssues = mobileComprehensiveData?.visualIssues || []
                
                // Log mobile artifacts
                const mobileArtifactResult = await this.runLogger.logArtifacts({
                    runId,
                    stepNumber: stepNumber + 1,
                    screenshot: mobileScreenshotBuffer,
                    domSnapshot: mobileStateResult.domSnapshot,
                    metadata: { browser: 'chromium', viewport: '375x812' },
                })
                
                // Create mobile viewport step
                const mobileStep: TestStep = {
                    id: `step_${runId}_mobile`,
                    stepNumber: stepNumber + 1,
                    action: 'visual-mobile',
                    target: 'Mobile Viewport (375x812)',
                    value: '375x812',
                    timestamp: new Date().toISOString(),
                    screenshotUrl: mobileArtifactResult.screenshotUrl,
                    domSnapshot: mobileArtifactResult.domUrl,
                    success: true,
                    mode: 'llm',
                    consoleErrors: mobileComprehensiveData?.consoleErrors?.map(e => ({
                        type: e.type,
                        message: e.message,
                        timestamp: e.timestamp,
                    })),
                    networkErrors: mobileComprehensiveData?.networkErrors?.map(e => ({
                        url: e.url,
                        status: e.status,
                        timestamp: e.timestamp,
                    })),
                    accessibilityIssues: mobileComprehensiveData?.accessibility?.map(a => ({
                        type: a.type,
                        message: a.message,
                        impact: a.impact,
                    })),
                    visualIssues: mobileVisualIssues.length > 0
                        ? mobileVisualIssues.map(v => ({
                            type: v.type,
                            description: `[Mobile] ${v.description}`,
                            severity: v.severity,
                        }))
                        : undefined,
                    environment: {
                        browser: 'chromium',
                        viewport: '375x812',
                    },
                }
                
                steps.push(mobileStep)
                artifacts.push(mobileArtifactResult.screenshotUrl, mobileArtifactResult.domUrl)
                mobileViewportTested = true
                
                console.log(`[${runId}] Mobile viewport testing completed`)
            } catch (mobileError: any) {
                console.warn(`[${runId}] Mobile viewport testing failed:`, mobileError.message)
                // Don't fail the test if mobile viewport testing fails
            }
        }

        // Update final status
        const success = steps.filter(s => s.success).length > steps.length * 0.5
        await this.updateTestRunStatus(
            runId,
            success ? TestRunStatus.COMPLETED : TestRunStatus.FAILED,
            undefined,
            steps
        )

        console.log(`[${runId}] Guest test finished: ${steps.length} steps, ${success ? 'SUCCESS' : 'FAILED'}`)

        return {
            success,
            steps,
            artifacts,
            stage: 'execution',
        }
    }

    /**
     * Build goal string based on guest test type
     */
    private buildGuestGoal(
        testType: string | undefined,
        credentials: { username?: string; email?: string; password?: string } | undefined,
        url: string | undefined
    ): string {
        // Use provided credentials or fall back to demo defaults
        const username = credentials?.username || credentials?.email || 'demo@example.com'
        const password = credentials?.password || 'DemoPass123!'
        
        switch (testType) {
            case 'login':
                return `LOGIN FLOW TEST: First, test negative paths: (1) Try submitting the login form with empty username/email field and verify error message appears and is visible. (2) Try submitting with empty password field and verify error message appears. (3) Try submitting with invalid credentials (use "invalid@test.com" and "wrongpass") and verify error message appears. Then test positive path: Find the login form, enter valid credentials (username/email: ${username}, password: ${password}), submit, and verify if login succeeds or fails. Look for login buttons, sign-in links, or authentication forms. When you find a username/email field, type "${username}". When you find a password field, type "${password}". Always check for error messages, loading states, and disabled submit buttons.`

            case 'signup':
                return `SIGNUP FLOW TEST: First, check for CAPTCHA or verification blockers - if detected, mark test as BLOCKED. Then test required field validation: Try submitting the form with empty required fields and verify validation error messages appear and are visible near the affected fields. Test client-side validation: Enter invalid email format (e.g., "notanemail") and verify error message. Enter weak password if policy is visible and verify error message. Then test positive path: Find the registration/signup form, fill in all required fields with valid data (email: ${username}, password: ${password}), submit the form, and verify the result. When you find an email field, type "${username}". When you find a password field, type "${password}". Check for password policy hints (min length, special chars, etc.) and ensure all validation errors are clearly displayed.`

            case 'visual':
                return `VISUAL TESTING: Explore the main UI elements on this page. Take screenshots of key areas, check for visual consistency, broken layouts, missing images, or rendering issues. Classify visual issues by severity (cosmetic vs blocking). Navigate to at most 2-3 additional pages for comparison. After desktop testing, switch to mobile viewport (375x812) and repeat visual checks to ensure responsive design works correctly.`

            case 'navigation':
                return `NAVIGATION TEST: Click on main navigation links, test menu items, and verify page transitions work correctly. Explicitly check for broken links, 404 errors, redirect failures, blank pages, and console errors. Classify navigation failures by severity (broken link vs dead-end vs redirect loop). Visit 5-8 different pages. If a 404 error is detected, record it with the URL and mark the navigation step as FAILED. If console errors occur during navigation, record them in the step results.`

            case 'form':
                return `FORM TESTING: Find forms on this page (search, contact, newsletter, etc.). Test autofocus behavior (first field should receive focus). Test tab order (Tab key should move through fields in logical order). Test disabled submit state (submit button should be disabled when required fields are empty). Fill forms with test data, submit, and verify validation messages and success/error states. Ensure error messages are visible and positioned close to the affected fields. Validate that disabled submit buttons become enabled when form is valid.`

            case 'accessibility':
                return `ACCESSIBILITY AUDIT: Check for common accessibility issues - missing alt text on images, proper heading hierarchy (exactly one h1, no skipped heading levels), form labels, color contrast issues, and keyboard navigation. Validate ARIA attributes (aria-label, aria-describedby, aria-required, role attributes). Check for keyboard traps (elements that prevent Tab navigation). Map issues to WCAG levels (A / AA / AAA). Report findings with severity and WCAG compliance level.`

            default:
                return `VISUAL TESTING: Explore the main UI elements on ${url || 'this page'} and perform general testing.`
        }
    }

    /**
     * Detect CAPTCHA or verification blockers in the DOM
     */
    private async detectCaptcha(sessionId: string): Promise<{ detected: boolean; type?: string; selector?: string }> {
        try {
            const session = this.playwrightRunner.getSession(sessionId)
            if (!session?.page) return { detected: false }

            const captchaInfo = await session.page.evaluate(() => {
                // Common CAPTCHA selectors and patterns
                const captchaSelectors = [
                    '[class*="captcha" i]',
                    '[class*="recaptcha" i]',
                    '[class*="hcaptcha" i]',
                    '[id*="captcha" i]',
                    '[id*="recaptcha" i]',
                    '[id*="hcaptcha" i]',
                    'iframe[src*="recaptcha"]',
                    'iframe[src*="hcaptcha"]',
                    '[data-sitekey]', // reCAPTCHA
                    '[data-callback]', // reCAPTCHA
                ]

                for (const selector of captchaSelectors) {
                    const element = document.querySelector(selector)
                    if (element) {
                        const tagName = element.tagName.toLowerCase()
                        const id = element.id || ''
                        const className = (element.className?.toString() || '').toLowerCase()
                        
                        let type = 'unknown'
                        if (className.includes('recaptcha') || id.includes('recaptcha') || selector.includes('recaptcha')) {
                            type = 'recaptcha'
                        } else if (className.includes('hcaptcha') || id.includes('hcaptcha') || selector.includes('hcaptcha')) {
                            type = 'hcaptcha'
                        } else if (className.includes('captcha') || id.includes('captcha')) {
                            type = 'captcha'
                        }

                        return {
                            detected: true,
                            type,
                            selector: element.id ? `#${element.id}` : selector,
                        }
                    }
                }

                // Check for CAPTCHA-related text
                const bodyText = document.body.textContent?.toLowerCase() || ''
                if (bodyText.includes('captcha') || bodyText.includes('verify you are human') || bodyText.includes('i am not a robot')) {
                    return {
                        detected: true,
                        type: 'text-based',
                        selector: 'body',
                    }
                }

                return { detected: false }
            })

            return captchaInfo
        } catch (error: any) {
            console.warn(`[GuestTestProcessor] CAPTCHA detection failed:`, error.message)
            return { detected: false }
        }
    }

    /**
     * Validate heading hierarchy (exactly one h1, no skipped levels)
     */
    private async validateHeadingHierarchy(sessionId: string): Promise<Array<{ type: string; message: string; severity: 'high' | 'medium' | 'low'; selector?: string }>> {
        try {
            const session = this.playwrightRunner.getSession(sessionId)
            if (!session?.page) return []

            const issues = await session.page.evaluate(() => {
                const results: Array<{ type: string; message: string; severity: 'high' | 'medium' | 'low'; selector?: string }> = []
                
                const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
                const h1Count = headings.filter(h => h.tagName.toLowerCase() === 'h1').length
                
                // Check for exactly one h1
                if (h1Count === 0) {
                    results.push({
                        type: 'heading-hierarchy',
                        message: 'No h1 heading found. Page should have exactly one h1 for proper document structure.',
                        severity: 'high',
                    })
                } else if (h1Count > 1) {
                    results.push({
                        type: 'heading-hierarchy',
                        message: `Multiple h1 headings found (${h1Count}). Page should have exactly one h1.`,
                        severity: 'high',
                    })
                }

                // Check for skipped heading levels
                let previousLevel = 0
                headings.forEach((heading) => {
                    const level = parseInt(heading.tagName.charAt(1))
                    if (previousLevel > 0 && level > previousLevel + 1) {
                        results.push({
                            type: 'heading-hierarchy',
                            message: `Heading level skipped: ${heading.tagName} follows h${previousLevel}. Heading hierarchy should not skip levels.`,
                            severity: 'medium',
                            selector: heading.id ? `#${heading.id}` : heading.tagName.toLowerCase(),
                        })
                    }
                    previousLevel = level
                })

                return results
            })

            return issues
        } catch (error: any) {
            console.warn(`[GuestTestProcessor] Heading hierarchy validation failed:`, error.message)
            return []
        }
    }

    /**
     * Check for keyboard traps (elements that prevent Tab navigation)
     */
    private async detectKeyboardTraps(sessionId: string): Promise<Array<{ type: string; message: string; severity: 'high' | 'medium' | 'low'; selector?: string }>> {
        try {
            const session = this.playwrightRunner.getSession(sessionId)
            if (!session?.page) return []

            const traps = await session.page.evaluate(() => {
                const results: Array<{ type: string; message: string; severity: 'high' | 'medium' | 'low'; selector?: string }> = []
                
                // Check for elements with tabindex that might trap focus
                const focusableElements = document.querySelectorAll('button, a, input, select, textarea, [tabindex]')
                
                focusableElements.forEach((el) => {
                    const tabIndex = el.getAttribute('tabindex')
                    // Elements with tabindex > 0 can create navigation issues
                    if (tabIndex && parseInt(tabIndex) > 0) {
                        const selector = el.id ? `#${el.id}` : el.tagName.toLowerCase()
                        results.push({
                            type: 'keyboard-trap',
                            message: `Element with tabindex="${tabIndex}" may create keyboard navigation issues. Prefer tabindex="0" or natural tab order.`,
                            severity: 'medium',
                            selector,
                        })
                    }
                })

                return results
            })

            return traps
        } catch (error: any) {
            console.warn(`[GuestTestProcessor] Keyboard trap detection failed:`, error.message)
            return []
        }
    }

    /**
     * Generate next action using AI
     */
    private async generateAction(
        runId: string,
        context: VisionContext,
        history: Array<{ action: LLMAction; timestamp: string }>,
        goal: string,
        visitedSelectors: Set<string>,
        visitedUrls: Set<string>,
        currentUrl: string | undefined,
        attemptedSelectors: Set<string>
    ): Promise<LLMAction> {
        try {
            const action = await this.unifiedBrain.generateAction(
                context,
                history,
                goal,
                {
                    visitedUrls: Array.from(visitedUrls),
                    visitedSelectors: Array.from(visitedSelectors),
                    currentUrl,
                    browser: 'chromium',
                    viewport: '1280x720',
                }
            )
            return action
        } catch (error: any) {
            console.warn(`[${runId}] AI action generation failed:`, error.message)

            // Fallback: find first clickable element that is visible, enabled, and not already attempted
            // This prevents infinite loops by ensuring we never repeat the same non-actionable element
            const clickable = context.elements.find(e => {
                // Must be clickable type
                if (!(e.type === 'button' || e.type === 'link')) return false
                
                // Must have selector
                if (!e.selector) return false
                
                // Must not be already visited
                if (visitedSelectors.has(e.selector)) return false
                
                // Must not be already attempted (fallback guard)
                if (attemptedSelectors.has(e.selector)) return false
                
                // Must be visible (check isHidden flag)
                if (e.isHidden) return false
                
                // Additional visibility check via bounds (if available)
                if (e.bounds) {
                    const { width, height } = e.bounds
                    if (width === 0 || height === 0) return false
                }
                
                return true
            })

            if (clickable && clickable.selector) {
                // Mark as attempted to prevent retry loops
                attemptedSelectors.add(clickable.selector)
                
                return {
                    action: 'click',
                    target: clickable.text || 'Element',
                    selector: clickable.selector,
                    description: 'Fallback click action (AI unavailable)',
                }
            }

            // If no valid clickable element found, try scroll as safe fallback
            // Only if we haven't scrolled recently (check history)
            const recentScrolls = history.filter(h => h.action.action === 'scroll').length
            if (recentScrolls < 3) {
                return { action: 'scroll', value: 'down', description: 'Fallback scroll (no actionable elements)' }
            }
            
            // If stuck (no clickable elements, already scrolled), mark as complete to exit gracefully
            return { action: 'complete', description: 'No actionable elements found, test complete' }
        }
    }

    /**
     * Update test run status via API
     */
    private async updateTestRunStatus(
        runId: string,
        status: TestRunStatus,
        error?: string,
        steps?: TestStep[]
    ): Promise<void> {
        try {
            const fetch = (await import('node-fetch')).default
            await fetch(`${this.apiUrl}/api/tests/${runId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status,
                    error,
                    steps,
                    ...(status === TestRunStatus.COMPLETED || status === TestRunStatus.FAILED
                        ? { completedAt: new Date().toISOString() }
                        : {}),
                }),
            })
        } catch (err: any) {
            console.error(`[${runId}] Failed to update status:`, err.message)
        }
    }

    /**
     * Start WebRTC streaming
     */
    private async startStreaming(runId: string, session: RunnerSession): Promise<void> {
        if (!session.page) return

        try {
            this.streamer = new WebRTCStreamer()
            await this.streamer.startStream({
                runId,
                sessionId: session.id,
                page: session.page,
            })
            console.log(`[${runId}] WebRTC stream started`)
        } catch (err: any) {
            console.warn(`[${runId}] WebRTC stream failed to start:`, err.message)
            this.streamer = null
        }
    }

    /**
     * Stop WebRTC streaming
     */
    private async stopStreaming(): Promise<void> {
        if (this.streamer) {
            await this.streamer.stopStream()
            this.streamer = null
        }
    }

    /**
     * Broadcast page state via Redis (non-blocking - failures don't affect test execution)
     */
    private broadcastPageState(runId: string, screenshot: Buffer | string, url: string): void {
        try {
            const base64 = Buffer.isBuffer(screenshot)
                ? screenshot.toString('base64')
                : screenshot

            this.redis.publish(`test:${runId}:frame`, JSON.stringify({
                type: 'frame',
                screenshot: base64,
                url,
                timestamp: Date.now(),
            }))
        } catch (error: any) {
            // Redis broadcast failure is non-blocking - steps are still saved via API
            // This ensures test execution continues even if Redis is unavailable
            console.warn(`[${runId}] Redis broadcast failed (non-blocking):`, error.message)
        }
    }

    /**
     * Upload session video to Wasabi (24hr retention) or Supabase fallback
     */
    private async uploadVideo(runId: string, sessionId: string): Promise<void> {
        try {
            const videoPath = await this.playwrightRunner.getVideoPath(sessionId)
            if (videoPath) {
                // Read video file into buffer
                const fs = await import('fs')
                const videoBuffer = fs.readFileSync(videoPath)

                let videoUrl: string

                // Prefer Wasabi for guest tests (cheaper, 24hr retention)
                if (this.wasabiStorage) {
                    videoUrl = await this.wasabiStorage.uploadVideoBuffer(runId, videoBuffer)
                    console.log(`[${runId}] Video uploaded to Wasabi: ${videoUrl}`)
                } else {
                    // Fallback to Supabase
                    videoUrl = await this.storageService.uploadVideo(runId, videoBuffer)
                    console.log(`[${runId}] Video uploaded to Supabase: ${videoUrl}`)
                }

                // Clean up local file
                try {
                    fs.unlinkSync(videoPath)
                } catch {
                    // Ignore cleanup errors
                }

                // Save video artifact metadata to API
                const fetch = (await import('node-fetch')).default
                await fetch(`${this.apiUrl}/api/tests/${runId}/artifacts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'video',
                        url: videoUrl,
                        path: videoPath,
                        size: videoBuffer.length,
                        storage: this.wasabiStorage ? 'wasabi' : 'supabase',
                    }),
                })
            }
        } catch (err: any) {
            console.warn(`[${runId}] Video upload failed:`, err.message)
        }
    }
}


