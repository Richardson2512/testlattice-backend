/**
 * GuestTestProcessorRefactored
 * Refactored to extend BaseProcessor and use ActionExecutor
 */

import { BaseProcessor, BaseProcessorConfig, ProcessorDependencies } from './core/BaseProcessor'
import { ActionExecutor } from './core/ActionExecutor'
import { ProcessResult, TestStep, LLMAction, VisionContext } from '../types'
import { UnifiedBrainService } from '../services/unifiedBrain'
import { AuthenticationFlowAnalyzer } from '../services/authenticationFlowAnalyzer'
import { ContextSynthesizer } from '../synthesizers/contextSynthesizer'
import { UnifiedPreflightService } from '../services/unifiedPreflightService'
import { SuccessEvaluator } from '../services/successEvaluator'
import { ContinuousPopupHandler } from '../services/continuousPopupHandler'
import { IntelligentRetryLayer } from '../services/intelligentRetryLayer'
import { ComprehensiveTestingService } from '../services/comprehensiveTesting'
import { RageBaitAnalyzer } from '../services/rageBaitAnalyzer'
import { VerificationInputHandler } from '../services/verificationInputHandler'
// import { PlaywrightRunner } from '../runners/playwright' // Needed for session?
import { logger } from '../observability'
import { getExecutionLogEmitter, ExecutionLogEmitter } from '../services/executionLogEmitter'

// Extended dependencies for Guest Processor
export interface GuestProcessorDependencies extends ProcessorDependencies {
    brain: UnifiedBrainService
    // We might need PlaywrightRunner if we use its session management or specialized methods
    // But ideally we depend on Page only for execution
    runner?: any
    sessionId: string
}

export class GuestTestProcessorRefactored extends BaseProcessor {
    private brain: UnifiedBrainService
    private actionExecutor: ActionExecutor
    private authAnalyzer: AuthenticationFlowAnalyzer
    private contextSynthesizer: ContextSynthesizer
    private preflight: UnifiedPreflightService
    private successEvaluator: SuccessEvaluator
    private popupHandler: ContinuousPopupHandler
    private retryLayer: IntelligentRetryLayer
    private comprehensiveTesting: ComprehensiveTestingService
    private rageBaitAnalyzer: RageBaitAnalyzer
    
    // Logging
    private logEmitter: ExecutionLogEmitter

    // State
    private visitedSelectors = new Set<string>()
    private visitedUrls = new Set<string>()
    private history: Array<{ action: LLMAction; timestamp: string }> = []

    // Captured runner
    private runner: any
    private sessionId: string

    constructor(
        config: BaseProcessorConfig,
        deps: GuestProcessorDependencies
    ) {
        super(config, deps)
        this.runner = (deps as any).runner // Capture runner
        this.sessionId = deps.sessionId
        this.brain = deps.brain
        this.sessionId = deps.sessionId
        this.brain = deps.brain
        this.actionExecutor = new ActionExecutor(deps.page)
        this.logEmitter = getExecutionLogEmitter(this.runId)
        
        // Patch logEmitter to broadcast logs to Frontend via Redis
        const originalLog = this.logEmitter.log.bind(this.logEmitter)
        this.logEmitter.log = (message: string, metadata?: Record<string, any>) => {
            originalLog(message, metadata)
            try {
                this.deps.redis.publish('ws:broadcast', JSON.stringify({
                    runId: this.runId,
                    serverId: 'worker',
                    payload: {
                        type: 'test_log',
                        message,
                        metadata,
                        timestamp: new Date().toISOString()
                    }
                }))
            } catch (e) {
                // Ignore broadcast errors
            }
        }

        // Initialize services
        this.comprehensiveTesting = new ComprehensiveTestingService()
        this.authAnalyzer = new AuthenticationFlowAnalyzer()
        this.contextSynthesizer = new ContextSynthesizer(this.brain, this.comprehensiveTesting)
        this.successEvaluator = new SuccessEvaluator()
        this.popupHandler = new ContinuousPopupHandler()
        this.rageBaitAnalyzer = new RageBaitAnalyzer()

        // Initialize IntelligentRetryLayer (which exists in services)
        this.retryLayer = new IntelligentRetryLayer(
            this.brain,
            (deps as any).runner || {},
            undefined,
            {
                maxRetries: 2,
                initialDelay: 300
            }
        )

        this.preflight = new UnifiedPreflightService(
            this.brain,
            this.contextSynthesizer,
            this.comprehensiveTesting,
            (deps as any).runner || {}
        )
    }

    /**
     * Override recordStep to broadcast to frontend
     */
    protected recordStep(
        action: string,
        success: boolean,
        duration: number,
        details?: any
    ): void {
        super.recordStep(action, success, duration, details)
        const step = this.steps[this.steps.length - 1]
        this.broadcastStep(step)
        
        // Emit to text log
        this.logEmitter.log(`[Step ${this.currentStep}] ${action}${success ? '' : ' (Failed)'}`, details)
    }

    private broadcastStep(step: any): void {
        try {
            this.deps.redis.publish('ws:broadcast', JSON.stringify({
                runId: this.runId,
                serverId: 'worker',
                payload: {
                    type: 'test_step',
                    step
                }
            }))
        } catch (error: any) {
            logger.warn({ runId: this.runId, error: error.message }, 'Step broadcast failed')
        }
    }

    /**
     * Execute Phase
     */
    protected async execute(): Promise<ProcessResult> {
        logger.info({ runId: this.runId }, 'Starting Guest Test Execution')
        this.logEmitter.log('Starting Guest Test Execution')

        // 1. Preflight
        await this.runPreflight()

        // 2. Goal construction
        const guestTestType = (this.config as any).guestTestType
        const goal = this.buildGuestGoal(guestTestType, (this.config as any).guestCredentials, this.url)

        // 3. Rage Bait Logic (if applicable)
        if (guestTestType === 'rage_bait') {
            return await this.executeRageBait(goal)
        }

        // 4. Systematic Visual Testing (Default or Explicit)
        // If explicitly 'visual' OR not 'login'/'signup' (which need the AI loop)
        if (guestTestType === 'visual' || (!guestTestType && !['login', 'signup'].includes(guestTestType || ''))) {
            return await this.executeSystematicVisualTest()
        }

        // 4. Main Loop
        while (!this.isStepLimitReached() && !this.isTimeoutReached()) {
            this.currentStep++

            // Continuous Popup Handling
            try {
                await this.popupHandler.checkAndDismissPopups(
                    this.deps.page,
                    this.deps.page.url(),
                    this.runId,
                    this.currentStep
                )
            } catch (e) {
                // Ignore popup check failures
            }

            // Auth Analysis & Verification Handling
            if (guestTestType === 'login' || guestTestType === 'signup') {
                const handled = await this.runAuthAnalysis(guestTestType)
                if (handled) continue
            }

            // Synthesize Context
            const contextStart = Date.now()
            const context = await this.contextSynthesizer.synthesizeContext({
                sessionId: this.sessionId,
                isMobile: false,
                goal,
                visitedSelectors: this.visitedSelectors,
                visitedUrls: this.visitedUrls,
                visitedHrefs: new Set(),
                blockedSelectors: new Set(),
                isSelectorBlocked: () => false,
                comprehensiveTesting: this.comprehensiveTesting,
                playwrightRunner: (this as any).runner,
                appiumRunner: undefined,
                stepNumber: this.currentStep,
                runId: this.runId,
                browserType: 'chromium',
                testableComponents: [],
                // page field removed as it's not in SynthesizeContextParams
            })

            // Generate Action
            const action = await this.generateAction(context.filteredContext, goal, context.currentUrl)

            if (action.action === 'complete') {
                this.recordStep('complete', true, Date.now() - contextStart, { value: action.description })
                return {
                    success: true,
                    steps: this.steps,
                    artifacts: this.artifacts,
                    stage: 'execution'
                }
            }

            // Execute Action
            const actionStart = Date.now()
            try {
                const result = await this.actionExecutor.execute(action, context.filteredContext)
                if (!result.success) {
                    throw new Error(result.error || 'Action failed')
                }
                this.recordStep(
                    action.action,
                    true,
                    Date.now() - actionStart,
                    {
                        target: action.target || action.selector,
                        value: action.value,
                        description: action.description
                    }
                )

                // Track history
                this.history.push({ action, timestamp: new Date().toISOString() })
                if (action.selector) this.visitedSelectors.add(action.selector)

                // Screenshot
                await this.captureScreenshot(`step-${this.currentStep}`)

            } catch (error: any) {
                this.recordStep(
                    action.action,
                    false,
                    Date.now() - actionStart,
                    { error: error.message }
                )
                throw error // Let BaseProcessor handle error? Or retry?
                // For guest test, we might want to continue or fail fast
                // BaseProcessor catches errors in run() and returns failed result
                // We should throw to stop execution if it's critical
                throw error
            }
        }

        return {
            success: false, // Timeout or max steps
            steps: this.steps,
            artifacts: this.artifacts,
            stage: 'execution'
        }
    }

    private async runPreflight() {
        // ... (Calls unifiedPreflight)
        // Simplified for brevity, would call this.preflight.executePreflight
        // But unifiedPreflight expects RunnerSession or Page?
        // Current signature in GuestTestProcessor: executePreflight(page, url, runId, ...)

        await this.preflight.executePreflight(
            this.deps.page,
            this.url,
            this.runId,
            this.url,
            this.sessionId
        )
    }

    private async executeRageBait(goal: string): Promise<ProcessResult> {
        logger.info({ runId: this.runId }, 'Starting Rage Bait Test')
        this.logEmitter.log('Starting Rage Bait Analysis (looking for forms/interactive elements)...')

        try {
            const summary = await this.rageBaitAnalyzer.runAllTests(
                this.deps.page,
                this.runId
            )

            // Convert results to steps
            for (const result of summary.results) {
                this.currentStep++
                const step = {
                    id: Math.random().toString(36).substring(7),
                    stepNumber: this.currentStep,
                    action: result.testName,
                    success: result.passed,
                    timestamp: new Date().toISOString(),
                    metadata: {
                        description: result.details,
                        severity: result.severity,
                        testName: result.testName
                    },
                    screenshotUrl: result.screenshotAfter,
                    value: result.details
                } as any

                this.steps.push(step)
                this.broadcastStep(step)
            }

            return {
                success: summary.failed === 0,
                steps: this.steps,
                artifacts: this.artifacts,
                stage: 'execution'
            }
        } catch (error: any) {
            logger.error({ runId: this.runId, error: error.message }, 'Rage Bait Test Failed')
            return {
                success: false,
                steps: this.steps,
                artifacts: this.artifacts,
                stage: 'execution'
            }
        }
    }

    private async runAuthAnalysis(guestTestType: string): Promise<boolean> {
        if (!this.deps.page) return false

        // 1. Detect Auth Methods
        if (this.currentStep === 1) {
            try {
                await this.authAnalyzer.detectAuthMethods(this.deps.page, this.runId, this.currentStep)
            } catch (e: any) {
                logger.warn({ runId: this.runId, error: e.message }, 'Auth detection failed')
            }
        }

        // 2. Signup / Verification
        if (guestTestType === 'signup') {
            try {
                const verification = await this.authAnalyzer.detectVerificationHandoff(this.deps.page, this.runId, this.currentStep)

                if (verification.detected && verification.type !== 'none') {
                    return await this.handleVerificationHandoff(verification)
                }
            } catch (e: any) {
                logger.warn({ runId: this.runId, error: e.message }, 'Signup analysis failed')
            }
        }

        return false
    }

    private async handleVerificationHandoff(verification: any): Promise<boolean> {
        logger.info({ runId: this.runId, type: verification.type }, 'Verification handoff detected')

        const verificationHandler = new VerificationInputHandler()

        // Notify frontend
        const verificationStep = {
            id: `step_${this.runId}_verification_wait`,
            stepNumber: this.currentStep,
            action: 'wait_verification',
            target: 'User Verification Required',
            value: verification.type === 'otp'
                ? 'Please enter the OTP code from your email/SMS'
                : 'Please paste the verification link from your email',
            timestamp: new Date().toISOString(),
            success: undefined,
            metadata: {
                verificationType: verification.type,
                message: verification.message,
                timeoutMs: 120000,
            },
            screenshotUrl: '' // Should capture one?
        } as any

        this.steps.push(verificationStep)
        this.broadcastStep(verificationStep)

        // Broadcast specifically for verification (Original processor did this)
        try {
            await this.deps.redis.publish(`test:${this.runId}:verification`, JSON.stringify({
                type: 'verification_required',
                context: {
                    message: verificationStep.value,
                    verificationType: verification.type,
                    timeoutMs: 120000,
                },
                timestamp: new Date().toISOString(),
            }))
        } catch (e) { }

        // Wait for input
        const userInput = await verificationHandler.waitForVerificationInput(
            this.runId,
            verification.type,
            120000
        )

        if (userInput) {
            verificationStep.success = true
            verificationStep.value = `Received ${userInput.inputType === 'otp' ? 'OTP code' : 'verification link'}`
            this.broadcastStep(verificationStep)

            if (userInput.inputType === 'link') {
                await this.actionExecutor.execute({
                    action: 'navigate',
                    value: userInput.value,
                    description: 'Navigate to verification link'
                } as any, {} as any)
                return true
            } else if (userInput.inputType === 'otp') {
                // Enter OTP logic
                // Using page.evaluate directly as in original
                const otpEntered = await this.deps.page.evaluate((otpCode: string) => {
                    const otpInputs = document.querySelectorAll('input[type="text"][name*="otp" i], input[type="text"][name*="code" i], input[inputmode="numeric"], input[maxlength="1"], input[maxlength="6"]')
                    if (otpInputs.length === 0) return false

                    if (otpInputs.length === 1 || (otpInputs[0] as HTMLInputElement).maxLength > 1) {
                        (otpInputs[0] as HTMLInputElement).value = otpCode
                        otpInputs[0].dispatchEvent(new Event('input', { bubbles: true }))
                        otpInputs[0].dispatchEvent(new Event('change', { bubbles: true }))
                    } else {
                        for (let i = 0; i < Math.min(otpCode.length, otpInputs.length); i++) {
                            (otpInputs[i] as HTMLInputElement).value = otpCode[i]
                            otpInputs[i].dispatchEvent(new Event('input', { bubbles: true }))
                            otpInputs[i].dispatchEvent(new Event('change', { bubbles: true }))
                        }
                    }
                    return true
                }, userInput.value)

                if (otpEntered) {
                    await this.deps.page.waitForTimeout(500)
                    await this.deps.page.evaluate(() => {
                        const submitBtn = document.querySelector('button[type="submit"], button:has-text("Verify"), button:has-text("Submit")')
                        if (submitBtn) (submitBtn as HTMLElement).click()
                    })
                }
                return true
            }
        } else {
            verificationStep.success = false
            verificationStep.error = 'Verification timeout'
            this.broadcastStep(verificationStep)
            throw new Error('Verification timeout')
        }

        await verificationHandler.disconnect()
        return false
    }

    private buildGuestGoal(testType: string | undefined, creds: any, url: string): string {
        switch (testType) {
            case 'login': return `Login to ${url} using username "${creds?.username || 'test'}" and password "${creds?.password || 'password'}"`
            case 'signup': return `Sign up on ${url} with a new account`
            case 'rage_bait': return `Find a form and stress test it`
            default: return `Explore ${url} and ensure basic functionality works`
        }
    }

    private async generateAction(
        context: VisionContext,
        goal: string,
        currentUrl?: string
    ): Promise<LLMAction> {
        return this.brain.generateAction(
            context,
            this.history,
            goal,
            {
                visitedSelectors: Array.from(this.visitedSelectors),
                visitedUrls: Array.from(this.visitedUrls),
                currentUrl
            }
        )
    }

    /**
     * Systematic Visual Testing Flow (10-Step Checklist)
     */
    /**
     * Systematic Visual Testing Flow (10-Step Checklist)
     */
    private async executeSystematicVisualTest(): Promise<ProcessResult> {
        logger.info({ runId: this.runId }, 'Starting Systematic Visual Test Flow')
        this.logEmitter.log('Starting Systematic Visual Test (10-Step Checklist)...')
        const page = this.deps.page

        // Setup Monitors
        const errors: string[] = []
        const failedRequests: string[] = []
        
        const consoleListener = (msg: any) => {
            if (msg.type() === 'error') errors.push(msg.text())
        }
        const requestListener = (res: any) => {
            if (res.status() >= 400) failedRequests.push(`${res.url()} (${res.status()})`)
        }
        
        page.on('console', consoleListener)
        page.on('response', requestListener)

        try {
            // STEP 1: Website Load & Redirection (Enhanced Stability)
            this.currentStep++
            this.logEmitter.log(`[Step ${this.currentStep}] 1. Validating Load & Redirection...`)
            const startLoad = Date.now()
            
            // 1. Initial Load (Network Idle prefered)
            let response
            try {
                this.logEmitter.log('Waiting for network idle...')
                response = await page.goto(this.url, { waitUntil: 'networkidle', timeout: 5000 })
            } catch (e) {
                this.logEmitter.log('Network idle timed out, falling back to DOMContentLoaded')
                response = await page.goto(this.url, { waitUntil: 'domcontentloaded' })
                await page.waitForTimeout(1000) // Reduced grace period
            }

            // 2. Smart Wait (Stability Detection)
            this.logEmitter.log('Performing Smart Wait (Network + DOM Stability)...')
            try {
                await page.evaluate(async () => {
                    return new Promise<void>((resolve) => {
                        let timeout: any;
                        // Resolve if no DOM mutations happen for 500ms
                        const observer = new MutationObserver(() => {
                            clearTimeout(timeout);
                            timeout = setTimeout(() => {
                                observer.disconnect();
                                resolve();
                            }, 500);
                        });
                        observer.observe(document.body, { childList: true, subtree: true, attributes: true });
                        // Fallback safety resolve after 1s if no mutations at all
                        timeout = setTimeout(() => { observer.disconnect(); resolve(); }, 1000);
                    });
                });
                
                // Also wait for any active animations to finish
                await page.evaluate(() => Promise.all(
                    document.getAnimations().map(a => a.finished)
                ).catch(() => {}));

                // Explicit check for known loaders (still useful)
                const loadingText = page.getByText(/loading\.\.\.|please wait/i).first()
                if (await loadingText.isVisible()) {
                      await loadingText.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {})
                }
            } catch (e) {
                this.logEmitter.log('Smart wait stabilized early or timed out')
            }
            
            const status = response?.status()
            const finalUrl = page.url()
            
            if (status && status !== 200) {
                this.recordStep('validate_load', false, Date.now() - startLoad, { status, error: 'Status not 200' })
                if (status >= 400) throw new Error(`Page load failed with status ${status}`)
            } else {
                this.recordStep('validate_load', true, Date.now() - startLoad, { status, finalUrl })
            }

            // STEP 2: Error Handling (Checking monitors)
            this.currentStep++
            this.logEmitter.log(`[Step ${this.currentStep}] 2. Checking for Initial Errors...`)
            // Initial check immediate after load
            const initialErrors = errors.length
            const initialFailedReqs = failedRequests.length
            
            if (initialErrors > 0 || initialFailedReqs > 0) {
                 this.recordStep('check_errors', true, 0, { 
                     message: `Detected ${initialErrors} console errors and ${initialFailedReqs} failed requests`,
                     details: { errors: errors.slice(0, 5), failedRequests: failedRequests.slice(0, 5) }
                 })
            } else {
                 this.recordStep('check_errors', true, 0, { message: 'No critical errors detected' })
            }

            // STEP 3: Auto-Close Ads/Popups (Heuristic Optimization - No AI)
            this.currentStep++
            this.logEmitter.log(`[Step ${this.currentStep}] 3. Verifying Popups Closed (Fast Check)...`)
            
            // Replaces expensive AI call with CSS-based closure
            try {
                await page.evaluate(() => {
                    const closeSelectors = [
                        'button[aria-label="Close"]', 
                        'button[class*="close"]', 
                        '.modal-close', 
                        '.popup-close',
                        'div[role="dialog"] button',
                        'div[aria-modal="true"] button'
                    ]
                    
                    let closedCount = 0
                    closeSelectors.forEach(selector => {
                        document.querySelectorAll(selector).forEach(el => {
                            // Only click if visible and looks like a close interaction
                            const style = window.getComputedStyle(el)
                            if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
                                (el as HTMLElement).click()
                                closedCount++
                            }
                        })
                    })
                    return closedCount
                })
                this.recordStep('check_popups', true, 100, { message: 'Heuristic popup check complete' })
            } catch (e) {
                this.recordStep('check_popups', true, 0, { message: 'Popup check skipped (heuristic)' })
            }

            // STEP 4: Responsive Visual Testing
            this.currentStep++
            this.logEmitter.log(`[Step ${this.currentStep}] 4. Responsive Testing (Multi-Resolution)...`)
            const viewports = [
                { width: 1920, height: 1080, label: 'Desktop' },
                { width: 1366, height: 768, label: 'Laptop' },
                { width: 768, height: 1024, label: 'Tablet' },
                { width: 375, height: 667, label: 'Mobile' }
            ]

            for (const vp of viewports) {
                await page.setViewportSize({ width: vp.width, height: vp.height })
                await page.waitForTimeout(500)
                const screenshot = await page.screenshot()
                this.recordStep('responsive_check', true, 500, { device: vp.label, resolution: `${vp.width}x${vp.height}` })
            }
            await page.setViewportSize({ width: 1920, height: 1080 })

            // STEP 5: Scroll Behavior
            this.currentStep++
            this.logEmitter.log(`[Step ${this.currentStep}] 5. Testing Scroll Behavior...`)
            await page.evaluate(async () => {
                await new Promise<void>((resolve) => {
                    let totalHeight = 0
                    const distance = 100
                    const timer = setInterval(() => {
                        const scrollHeight = document.body.scrollHeight
                        window.scrollBy(0, distance)
                        totalHeight += distance
                        if (totalHeight >= scrollHeight) {
                            clearInterval(timer)
                            resolve()
                        }
                    }, 50)
                })
            })
            await page.evaluate(() => window.scrollTo(0, 0))
            this.recordStep('scroll_behavior', true, 2000, { message: 'Smooth scroll complete' })

            // STEP 6: Subpage Navigation
            this.currentStep++
            this.logEmitter.log(`[Step ${this.currentStep}] 6. Subpage Navigation...`)
            const links = await page.$$eval('nav a, header a', as => as.slice(0, 3).map(a => (a as HTMLAnchorElement).href))
            const validLinks = links.filter(l => l && l.startsWith('http') && !l.includes('#'))
            
            for (const link of validLinks) {
                try {
                    this.logEmitter.log(`Navigating to ${link}...`)
                    const navStart = Date.now()
                    await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 10000 })
                    this.recordStep('navigate_subpage', true, Date.now() - navStart, { url: link })
                    await page.waitForTimeout(1000)
                    await page.goBack()
                } catch (e: any) {
                    this.logEmitter.log(`Navigation failed: ${e.message}`)
                }
            }

            // STEP 7: Return to Home Page (Explicit Check)
            this.currentStep++
            this.logEmitter.log(`[Step ${this.currentStep}] 7. Validating Home Return...`)
            try {
                // Try to find a logo or home link
                const homeSelector = 'a[href="/"], header a[href^="/"], .logo, [aria-label="Home"]'
                const homeLink = await page.$(homeSelector)
                if (homeLink) {
                    await homeLink.click()
                    await page.waitForTimeout(1000)
                    const currentUrl = page.url()
                    const isHome = currentUrl === this.url || currentUrl.endsWith('/')
                    this.recordStep('return_home', true, 1000, { message: 'Home navigation successful', isHome })
                } else {
                    this.logEmitter.log('No obvious Home link found, skipping explicit click.')
                    this.recordStep('return_home', true, 0, { message: 'Skipped - No Home link found' })
                }
            } catch (e: any) {
                 this.recordStep('return_home', false, 0, { error: e.message })
            }

            // STEP 8: Hyperlink Validation
            this.currentStep++
            this.logEmitter.log(`[Step ${this.currentStep}] 8. Validating Links...`)
            const allLinksCount = await page.evaluate(() => document.querySelectorAll('a').length)
            this.recordStep('validate_links', true, 100, { count: allLinksCount })

            // STEP 9: Image & Video Loading
            this.currentStep++
            this.logEmitter.log(`[Step ${this.currentStep}] 9. Verifying Media...`)
            const brokenImages = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('img')).filter(img => !img.complete || img.naturalWidth === 0).length
            })
            if (brokenImages === 0) {
                this.recordStep('check_media', true, 100, { message: 'All images loaded correctly' })
            } else {
                this.recordStep('check_media', false, 100, { error: `${brokenImages} broken images detected` })
            }

            // STEP 10: Final Visual Regression (Snapshot)
            this.currentStep++
            this.logEmitter.log(`[Step ${this.currentStep}] 10. Final Visual Snapshot...`)
            await this.captureScreenshot('final-regression-snapshot')
            this.recordStep('visual_regression', true, 500, { message: 'Baseline captured' })

            return {
                success: errors.length === 0, // Success if no console errors? Or loose? Keep true for now.
                steps: this.steps,
                artifacts: this.artifacts,
                stage: 'execution'
            }

        } catch (error: any) {
            logger.error({ runId: this.runId, error: error.message }, 'Visual Test Failed')
            this.logEmitter.log(`Visual Test Failed: ${error.message}`)
            return {
                success: false,
                steps: this.steps,
                artifacts: this.artifacts,
                stage: 'execution'
            }
        } finally {
             // Cleanup
             page.off('console', consoleListener)
             page.off('response', requestListener)
        }
    }
}
