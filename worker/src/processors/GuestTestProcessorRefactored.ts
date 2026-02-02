/**
 * GuestTestProcessorRefactored
 * Refactored to extend BaseProcessor and use ActionExecutor
 */

import { BaseProcessor, BaseProcessorConfig, ProcessorDependencies } from './core/BaseProcessor'
import { ActionExecutor } from './core/ActionExecutor'
import { ProcessResult, TestStep, LLMAction, VisionContext, TestReportSummary, TestIssue, IssueSeverity, IssueCategory } from '../types'
import { UnifiedBrainService } from '../services/unifiedBrain'
import { AuthenticationFlowAnalyzer } from '../services/authenticationFlowAnalyzer'
import { ContextSynthesizer } from '../synthesizers/contextSynthesizer'
import { UnifiedPreflightService } from '../services/unifiedPreflightService'
import { SuccessEvaluator } from '../services/successEvaluator'
import { ContinuousPopupHandler } from '../services/continuousPopupHandler'
import { IntelligentRetryLayer } from '../services/intelligentRetryLayer'
import { AuditService } from '../services/audit'
import { RageBaitAnalyzer } from '../services/rageBaitAnalyzer'
import { VerificationInputHandler } from '../services/verificationInputHandler'
// import { PlaywrightRunner } from '../runners/playwright' // Needed for session?
import { logger } from '../observability'
import { getExecutionLogEmitter, ExecutionLogEmitter } from '../services/executionLogEmitter'
import { getStepDescription } from '../utils/stepDescriptions'

// Import modular executors
import { VisualTestExecutor } from './guest/executors/VisualTestExecutor'
import { RageBaitExecutor } from './guest/executors/RageBaitExecutor'
import { NavigationTestExecutor } from './guest/executors/NavigationTestExecutor'
import { FormTestExecutor } from './guest/executors/FormTestExecutor'
import { AccessibilityTestExecutor } from './guest/executors/AccessibilityTestExecutor'
import { AuthFlowExecutor } from './guest/executors/AuthFlowExecutor'


// Extended dependencies for Guest Processor
export interface GuestProcessorDependencies extends ProcessorDependencies {
    brain: UnifiedBrainService | null
    // We might need PlaywrightRunner if we use its session management or specialized methods
    // But ideally we depend on Page only for execution
    runner?: any
    sessionId: string
}

export class GuestTestProcessorRefactored extends BaseProcessor {
    private brain: UnifiedBrainService | null
    private actionExecutor: ActionExecutor
    private authAnalyzer: AuthenticationFlowAnalyzer | null = null
    private contextSynthesizer: ContextSynthesizer | null = null
    private preflight: UnifiedPreflightService | null = null
    private successEvaluator: SuccessEvaluator
    private popupHandler: ContinuousPopupHandler
    private retryLayer: IntelligentRetryLayer | null = null
    private auditService: AuditService
    private rageBaitAnalyzer: RageBaitAnalyzer | null = null

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

        this.auditService = new AuditService()
        this.successEvaluator = new SuccessEvaluator()
        this.popupHandler = new ContinuousPopupHandler()

        if (this.brain) {
            this.contextSynthesizer = new ContextSynthesizer(this.brain, this.auditService)
            this.authAnalyzer = new AuthenticationFlowAnalyzer()
            this.actionExecutor = new ActionExecutor(this.deps.page)
            this.retryLayer = new IntelligentRetryLayer(
                this.brain,
                (deps as any).runner || undefined
            )
            this.rageBaitAnalyzer = new RageBaitAnalyzer()
            this.preflight = new UnifiedPreflightService(
                this.brain,
                this.contextSynthesizer,
                this.auditService,
                (deps as any).runner || {}
            )
        } else {
            // Fallback or null for visual-only tests
            this.contextSynthesizer = null
            this.authAnalyzer = null
            this.actionExecutor = new ActionExecutor(this.deps.page) // Basic executor always works
            this.retryLayer = null
            this.rageBaitAnalyzer = null
            this.preflight = null
        }
    }

    /**
     * Override recordStep to broadcast to frontend with human-readable description
     */
    protected recordStep(
        action: string,
        success: boolean,
        duration: number,
        details?: any
    ): void {
        // Add human-readable description using shared utility
        const enrichedDetails = {
            ...details,
            description: getStepDescription(action, details, this.url)
        }

        super.recordStep(action, success, duration, enrichedDetails)
        const step = this.steps[this.steps.length - 1]
        this.broadcastStep(step)

        // Emit to text log with description
        const desc = enrichedDetails.description
        this.logEmitter.log(`[Step ${this.currentStep}] ${action}${success ? '' : ' (FAILED)'}: ${desc}`)

        // Broadcast prominent issue notification for failures (to entice users)
        if (!success) {
            const issueTitle = this.getIssueTitleFromAction(action, details)
            this.logEmitter.log(`🔴 Issue Found: ${issueTitle}`, {
                isIssue: true,
                severity: 'high',
                action
            })

            // Also broadcast as a separate issue notification
            try {
                this.deps.redis.publish('ws:broadcast', JSON.stringify({
                    runId: this.runId,
                    serverId: 'worker',
                    payload: {
                        type: 'issue_found',
                        title: issueTitle,
                        action,
                        stepNumber: this.currentStep,
                        timestamp: new Date().toISOString()
                    }
                }))
            } catch (e) {
                // Ignore broadcast errors
            }
        }
    }

    private getIssueTitleFromAction(action: string, details?: any): string {
        const titles: Record<string, string> = {
            'check_errors': 'Console errors detected',
            'network_error': 'Network request failed',
            'validate_load': 'Page load issue',
            'responsive_check': 'Responsive layout problem',
            'check_popups': 'Popup/modal issue',
            'validate_links': 'Broken link detected',
            'check_media': 'Media loading failure',
            'visual_regression': 'Visual difference detected',
            'accessibility': 'Accessibility issue',
            'form_validation': 'Form validation error',
            'click': 'Click action failed',
            'type': 'Input typing failed',
            'navigate': 'Navigation failed'
        }
        return titles[action] || `${action.replace(/_/g, ' ')} issue`
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
        if (this.preflight) {
            await this.runPreflight()
        } else {
            this.logEmitter.log('Skipping advanced preflight (non-AI mode)')
        }

        // 2. Goal construction
        const guestTestType = (this.config as any).guestTestType
        const goal = this.buildGuestGoal(guestTestType, (this.config as any).guestCredentials, this.url)

        // 3. Route to appropriate executor based on test type
        switch (guestTestType) {
            case 'rage_bait':
                return await this.executeRageBait(goal)

            case 'visual':
                return await this.executeSystematicVisualTest()

            case 'navigation':
                return await this.executeNavigationTest()

            case 'form':
                return await this.executeFormTest()

            case 'accessibility':
                return await this.executeAccessibilityTest()

            case 'login':
            case 'signup':
                return await this.executeAuthFlowTest(guestTestType)

            default:
                // Default to visual test for unknown types
                return await this.executeSystematicVisualTest()
        }
    }

    /**
     * Override captureScreenshot to provide low-latency live streaming
     * Broadcasts base64 image immediately via WS, then uploads to S3 in background
     */
    protected async captureScreenshot(label?: string): Promise<string | undefined> {
        try {
            // 1. Capture Buffer
            const screenshot = await this.deps.page.screenshot({
                type: 'jpeg', // Use JPEG for smaller payload/faster stream
                quality: 60   // Compress for speed
            })

            // 2. Broadcast immediately (Fire-and-forget)
            // This enables "Real-time" feel without waiting for S3
            try {
                const base64 = screenshot.toString('base64')
                this.deps.redis.publish('ws:broadcast', JSON.stringify({
                    runId: this.runId,
                    serverId: 'worker',
                    payload: {
                        type: 'page_state',
                        state: {
                            screenshot: `data:image/jpeg;base64,${base64}`,
                            url: this.url,
                            timestamp: new Date().toISOString()
                        }
                    }
                }))
            } catch (e) {
                // Ignore broadcast errors
            }

            // 3. Upload to Wasabi/S3 (Standard Artifact Retention)
            // Re-using BaseProcessor's logic but we need to implement it here since we have the buffer
            // and BaseProcessor.captureScreenshot does both capture and upload tightly coupled.

            // We can't easily call super.captureScreenshot because it would re-take the screenshot (slow).
            // So we call storage directly.

            const UPLOAD_TIMEOUT_MS = 30000
            const uploadPromise = this.deps.storage.uploadScreenshot(
                this.runId,
                this.currentStep,
                screenshot
            )

            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Screenshot upload timed out')), UPLOAD_TIMEOUT_MS)
            )

            const url = await Promise.race([uploadPromise, timeoutPromise]) as string

            this.artifacts.push(url)
            return url

        } catch (e: any) {
            logger.warn({ runId: this.runId, error: e.message }, 'Screenshot capture/upload failed')
            return undefined
        }
    }

    /**
     * Execute Navigation Test using modular executor
     */
    private async executeNavigationTest(): Promise<ProcessResult> {
        this.logEmitter.log('Starting Navigation Test Contract...')

        const executor = new NavigationTestExecutor(
            {
                page: this.deps.page,
                logEmitter: this.logEmitter,
                recordStep: (action, success, duration, metadata) => this.recordStep(action, success, duration, metadata),
                captureScreenshot: async (label) => { await this.captureScreenshot(label) }
            },
            { runId: this.runId, url: this.url }
        )

        const result = await executor.execute()

        return {
            success: true,
            steps: this.steps,
            artifacts: this.artifacts,
            stage: 'execution'
        }
    }

    /**
     * Execute Form Test using modular executor
     */
    private async executeFormTest(): Promise<ProcessResult> {
        this.logEmitter.log('Starting Form Test Contract...')

        const executor = new FormTestExecutor(
            {
                page: this.deps.page,
                logEmitter: this.logEmitter,
                recordStep: (action, success, duration, metadata) => this.recordStep(action, success, duration, metadata),
                captureScreenshot: async (label) => { await this.captureScreenshot(label) }
            },
            { runId: this.runId, url: this.url }
        )

        const result = await executor.execute()

        return {
            success: true,
            steps: this.steps,
            artifacts: this.artifacts,
            stage: 'execution'
        }
    }

    /**
     * Execute Accessibility Test using modular executor
     */
    private async executeAccessibilityTest(): Promise<ProcessResult> {
        this.logEmitter.log('Starting Accessibility Test Contract...')

        const executor = new AccessibilityTestExecutor(
            {
                page: this.deps.page,
                logEmitter: this.logEmitter,
                recordStep: (action, success, duration, metadata) => this.recordStep(action, success, duration, metadata),
                captureScreenshot: async (label) => { await this.captureScreenshot(label) }
            },
            { runId: this.runId, url: this.url }
        )

        const result = await executor.execute()

        return {
            success: true,
            steps: this.steps,
            artifacts: this.artifacts,
            stage: 'execution'
        }
    }

    /**
     * Execute Auth Flow (Login/Signup) using modular executor
     */
    private async executeAuthFlowTest(flowType: 'login' | 'signup'): Promise<ProcessResult> {
        this.logEmitter.log(`Starting ${flowType === 'login' ? 'Login' : 'Signup'} Test Contract...`)

        const credentials = (this.config as any).guestCredentials || {}

        const executor = new AuthFlowExecutor(
            {
                runId: this.runId,
                testType: flowType,
                url: this.url,
                credentials: {
                    username: credentials.username || credentials.email,
                    password: credentials.password
                }
            },
            {
                page: this.deps.page,
                redis: null,
                logEmitter: this.logEmitter,
                recordStep: (action, success, duration, metadata) => this.recordStep(action, success, duration, metadata),
                captureScreenshot: async (label) => this.captureScreenshot(label)
            }
        )


        const result = await executor.execute()
        this.steps.push(...result.steps)
        this.artifacts.push(...result.artifacts)

        return {
            success: true,
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

        if (!this.preflight) return

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
            if (!this.rageBaitAnalyzer) {
                return { success: true, steps: this.steps, artifacts: this.artifacts, stage: 'execution' } // Always complete
            }

            // Use modular executor
            const executor = new RageBaitExecutor(
                { runId: this.runId, url: this.url, startingStep: this.currentStep },
                {
                    page: this.deps.page,
                    logEmitter: this.logEmitter,
                    rageBaitAnalyzer: this.rageBaitAnalyzer,
                    broadcastStep: (step) => this.broadcastStep(step),
                    captureScreenshot: async (label?: string) => this.captureScreenshot(label),
                    recordStep: (action, success, duration, details) => this.recordStep(action, success, duration, details)
                }
            )


            const result = await executor.execute()

            // Merge steps
            this.steps.push(...result.steps)
            this.artifacts.push(...result.artifacts)

            return {
                success: true, // Always true - findings are tracked at step level
                steps: this.steps,
                artifacts: this.artifacts,
                stage: 'execution'
            }
        } catch (error: any) {
            logger.error({ runId: this.runId, error: error.message }, 'Rage Bait Test Failed')
            return {
                success: true, // Always complete - errors are findings, not failures
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
                if (!this.authAnalyzer) return false
                const analysis = await this.authAnalyzer.detectAuthMethods(this.deps.page, this.runId, this.currentStep)
            } catch (e: any) {
                logger.warn({ runId: this.runId, error: e.message }, 'Auth detection failed')
            }
        }

        // 2. Signup / Verification
        if (guestTestType === 'signup') {
            try {
                if (!this.authAnalyzer) return false
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

    /**
     * Show cursor status bubble for live streaming
     * Displays action name near the cursor for better streaming experience
     */
    private async showCursorStatus(status: string, duration: number = 0): Promise<void> {
        try {
            await this.deps.page.evaluate(({ text, dur }) => {
                // Show cursor at center if not visible
                if ((window as any).__playwrightShowCursor) {
                    const centerX = window.innerWidth / 2
                    const centerY = window.innerHeight / 3  // Upper third for better visibility
                        ; (window as any).__playwrightShowCursor(centerX, centerY)
                }
                // Show status bubble
                if ((window as any).__playwrightShowStatus) {
                    (window as any).__playwrightShowStatus(text, dur)
                }
            }, { text: status, dur: duration })
        } catch {
            // Ignore if page context is unavailable
        }
    }

    private async hideCursorStatus(): Promise<void> {
        try {
            await this.deps.page.evaluate(() => {
                if ((window as any).__playwrightHideStatus) {
                    (window as any).__playwrightHideStatus()
                }
                if ((window as any).__playwrightHideCursor) {
                    (window as any).__playwrightHideCursor()
                }
            })
        } catch {
            // Ignore if page context is unavailable
        }
    }

    private async generateAction(
        context: VisionContext,
        goal: string,
        currentUrl?: string
    ): Promise<LLMAction> {
        if (!this.brain) {
            throw new Error('Brain service not available for action generation')
        }
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
     * Systematic Visual Testing Flow - Uses Modular VisualTestExecutor
     */
    private async executeSystematicVisualTest(): Promise<ProcessResult> {
        logger.info({ runId: this.runId }, 'Starting Systematic Visual Test Flow')
        this.logEmitter.log('Starting Visual Test (16-Step Authoritative Contract)...')

        // Use modular executor (no feature flag - this is the default)
        const executor = new VisualTestExecutor(
            { runId: this.runId, url: this.url, startingStep: this.currentStep },
            {
                page: this.deps.page,
                logEmitter: this.logEmitter,
                captureScreenshot: (label) => this.captureScreenshot(label),
                recordStep: (action, success, duration, metadata) =>
                    this.recordStep(action, success, duration, metadata)
            }
        )

        const result = await executor.execute()
        this.steps.push(...result.steps)
        this.artifacts.push(...result.artifacts)

        return {
            success: true, // Always true - findings are tracked at step level
            steps: this.steps,
            artifacts: this.artifacts,
            stage: 'execution'
        }
    }
    /**
     * Generate a comprehensive AI summary of test findings
     * Similar to ScoutQA's report format
     */
    async generateReportSummary(startTime: Date): Promise<TestReportSummary> {
        const duration = `${Math.round((Date.now() - startTime.getTime()) / 1000)}s`

        // Analyze steps and categorize issues
        const issues: TestIssue[] = []
        let issueId = 1

        for (const step of this.steps) {
            if (!step.success) {
                const issue = this.categorizeIssue(step, issueId++)
                if (issue) {
                    issues.push(issue)
                }
            }
        }

        // Group by severity
        const criticalIssues = issues.filter(i => i.severity === 'Critical')
        const highIssues = issues.filter(i => i.severity === 'High')
        const mediumIssues = issues.filter(i => i.severity === 'Medium')
        const lowIssues = issues.filter(i => i.severity === 'Low')
        const infoIssues = issues.filter(i => i.severity === 'Info')

        // Generate testing methodology
        const methodology = this.generateMethodology()

        // Generate narrative (template-based for better performance)
        const narrative = this.generateNarrative(issues, criticalIssues, highIssues)

        return {
            target: this.url,
            issuesFound: issues.length,
            started: startTime.toISOString(),
            duration,
            narrative,
            criticalIssues,
            highIssues,
            mediumIssues,
            lowIssues,
            infoIssues,
            methodology,
            stepsCompleted: this.steps.length,
            errorsFound: this.steps.filter(s => !s.success).length,
            warningsFound: this.steps.filter(s => s.metadata?.warning).length
        }
    }

    /**
     * Categorize a failed step as an issue
     */
    private categorizeIssue(step: TestStep, id: number): TestIssue | null {
        const action = step.action.toLowerCase()

        // Determine category based on action/error
        let category: IssueCategory = 'Functionality'
        let severity: IssueSeverity = 'Medium'

        if (action.includes('error') || action.includes('console') || step.error?.includes('TypeError')) {
            category = 'Performance'
            severity = 'High'
        } else if (action.includes('accessibility') || action.includes('aria') || action.includes('alt')) {
            category = 'Accessibility'
            severity = 'Medium'
        } else if (action.includes('xss') || action.includes('sanitiz') || action.includes('security')) {
            category = 'Security'
            severity = 'Critical'
        } else if (action.includes('form') || action.includes('validation') || action.includes('input')) {
            category = 'Usability'
            severity = 'High'
        } else if (action.includes('load') || action.includes('response') || action.includes('network')) {
            category = 'Performance'
            severity = step.error ? 'Critical' : 'Medium'
        }

        const title = this.generateIssueTitle(step, category)

        return {
            id,
            category,
            title,
            severity,
            evidence: [step.error || step.metadata?.description || `Failed during ${step.action}`],
            affects: step.target || step.value || 'Page functionality',
            impact: this.generateImpactDescription(severity, category),
            screenshotUrl: step.screenshotUrl,
            timestamp: step.timestamp
        }
    }

    private generateIssueTitle(step: TestStep, category: IssueCategory): string {
        const action = step.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        return `${category} - ${action} issue detected`
    }

    private generateImpactDescription(severity: IssueSeverity, category: IssueCategory): string {
        const impacts: Record<IssueSeverity, string> = {
            'Critical': 'Blocks core functionality',
            'High': 'Significantly affects user experience',
            'Medium': 'May cause user confusion',
            'Low': 'Minor issue with minimal impact',
            'Info': 'Informational observation'
        }
        return impacts[severity]
    }

    private generateNarrative(issues: TestIssue[], critical: TestIssue[], high: TestIssue[]): string {
        const domain = new URL(this.url).hostname

        if (issues.length === 0) {
            return `Comprehensive testing of ${domain} completed successfully. No issues were identified that require immediate attention. The website appears to be functioning as expected.`
        }

        const criticalCount = critical.length
        const highCount = high.length

        let intro = `Comprehensive testing of ${domain} has been completed. `

        if (criticalCount > 0) {
            intro += `I have identified ${criticalCount} critical and ${highCount} high-severity issues that need to be fixed. `
        } else if (highCount > 0) {
            intro += `I have identified ${highCount} high-severity issues that should be addressed. `
        } else {
            intro += `I have identified ${issues.length} issues that may impact user experience. `
        }

        // Add category breakdown
        const categories = new Map<IssueCategory, number>()
        for (const issue of issues) {
            categories.set(issue.category, (categories.get(issue.category) || 0) + 1)
        }

        const categoryParts: string[] = []
        if (categories.get('Security')) categoryParts.push(`${categories.get('Security')} security`)
        if (categories.get('Performance')) categoryParts.push(`${categories.get('Performance')} performance`)
        if (categories.get('Usability')) categoryParts.push(`${categories.get('Usability')} usability`)
        if (categories.get('Accessibility')) categoryParts.push(`${categories.get('Accessibility')} accessibility`)

        if (categoryParts.length > 0) {
            intro += `Issues include ${categoryParts.join(', ')} concerns.`
        }

        return intro
    }

    private generateMethodology(): string[] {
        const methodology: string[] = []
        const stepActions = new Set(this.steps.map(s => s.action))

        if (stepActions.has('validate_load') || stepActions.has('navigate')) {
            methodology.push('✅ Navigated and validated page loading')
        }
        if (stepActions.has('check_errors') || stepActions.has('console')) {
            methodology.push('✅ Monitored console errors and network failures')
        }
        if (stepActions.has('responsive_check')) {
            methodology.push('✅ Tested responsive layouts across devices')
        }
        if (stepActions.has('scroll_behavior')) {
            methodology.push('✅ Tested scroll behavior and lazy loading')
        }
        if (stepActions.has('check_popups')) {
            methodology.push('✅ Checked for popups, modals, and overlays')
        }
        if (stepActions.has('validate_links')) {
            methodology.push('✅ Validated hyperlinks and navigation')
        }
        if (stepActions.has('check_media')) {
            methodology.push('✅ Verified images and media loading')
        }
        if (stepActions.has('visual_regression')) {
            methodology.push('✅ Captured visual regression screenshots')
        }

        return methodology.length > 0 ? methodology : ['✅ Completed automated testing']
    }
}