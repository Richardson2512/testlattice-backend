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
import { config } from '../config/env'
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
        this.apiUrl = config.api.url || process.env.API_URL || 'http://localhost:3001'
        this.comprehensiveTesting = new ComprehensiveTestingService()

        // Initialize Wasabi for guest artifacts (cheaper than Supabase)
        if (config.wasabi.enabled) {
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

            // Add navigation step to trace
            this.traceService.addStep(runId, {
                action: 'navigate',
                target: build.url || '',
                success: true,
                description: 'Navigate to target URL',
            })

            // Start WebRTC stream if page available
            if (session.page) {
                await this.startStreaming(runId, session)
            }

            // Execute guest test flow
            const result = await this.executeGuestFlow(
                runId,
                session,
                build.url || '',
                options || {},
                steps,
                artifacts
            )

            return result
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

        // Track visited elements
        const visitedSelectors = new Set<string>()
        const visitedUrls = new Set<string>([targetUrl])
        const history: Array<{ action: LLMAction; timestamp: string }> = []

        // Main execution loop
        while (stepNumber < this.MAX_GUEST_STEPS && Date.now() - startTime < this.MAX_DURATION_MS) {
            stepNumber++

            try {
                // Synthesize context
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

                const { filteredContext, currentUrl, comprehensiveData } = contextResult

                // Generate next action
                const action = await this.generateAction(
                    runId,
                    filteredContext,
                    history,
                    goal,
                    visitedSelectors,
                    visitedUrls,
                    currentUrl
                )

                // Check for completion
                if (action.action === 'complete') {
                    console.log(`[${runId}] Guest test completed at step ${stepNumber}`)
                    break
                }

                // Execute action
                console.log(`[${runId}] Step ${stepNumber}: ${action.action} ${action.target || action.selector || ''}`)

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

                // Capture state
                const stateResult = await this.testExecutor.captureState(session.id, false)

                // Broadcast frame via Redis
                if (stateResult?.screenshot) {
                    this.broadcastPageState(runId, stateResult.screenshot, currentUrl || '')
                }

                // Upload artifacts
                const screenshotBuffer = Buffer.isBuffer(stateResult.screenshot)
                    ? stateResult.screenshot
                    : Buffer.from(stateResult.screenshot, 'base64')

                const artifactResult = await this.runLogger.logArtifacts({
                    runId,
                    stepNumber,
                    screenshot: screenshotBuffer,
                    domSnapshot: stateResult.domSnapshot,
                    metadata: { browser: 'chromium', viewport: '1280x720' },
                })

                // Create step record
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

                // Save checkpoint
                await this.runLogger.saveCheckpoint(runId, stepNumber, steps, artifacts)

            } catch (stepError: any) {
                console.error(`[${runId}] Step ${stepNumber} failed:`, stepError.message)

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

                // Continue if not critical
                if (stepError.message.includes('Navigation failed') || stepError.message.includes('Page crashed')) {
                    break
                }
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
        switch (testType) {
            case 'login':
                return `LOGIN FLOW TEST: Find the login form on this page, enter the provided credentials (username: ${credentials?.username || credentials?.email || 'test@example.com'}, password: ***), submit, and verify if login succeeds or fails. Look for login buttons, sign-in links, or authentication forms.`

            case 'signup':
                return `SIGNUP FLOW TEST: Find the registration/signup form, fill in fields with demo data (email: ${credentials?.email || credentials?.username || 'test@example.com'}, password: ***), submit the form, and verify the result.`

            case 'visual':
                return `VISUAL TESTING: Explore the main UI elements on this page. Take screenshots of key areas, check for visual consistency, broken layouts, missing images, or rendering issues. Navigate to at most 2-3 additional pages for comparison.`

            case 'navigation':
                return `NAVIGATION TEST: Click on main navigation links, test menu items, and verify page transitions work correctly. Check for broken links, 404 errors, or navigation failures. Visit 5-8 different pages.`

            case 'form':
                return `FORM TESTING: Find forms on this page (search, contact, newsletter, etc.), fill them with test data, submit, and verify validation messages and success/error states.`

            case 'accessibility':
                return `ACCESSIBILITY AUDIT: Check for common accessibility issues - missing alt text on images, proper heading hierarchy, form labels, color contrast issues, and keyboard navigation. Report findings.`

            default:
                return `VISUAL TESTING: Explore the main UI elements on ${url || 'this page'} and perform general testing.`
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
        currentUrl: string | undefined
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

            // Fallback: find first clickable element
            const clickable = context.elements.find(e =>
                (e.type === 'button' || e.type === 'link') &&
                e.selector &&
                !visitedSelectors.has(e.selector)
            )

            if (clickable) {
                return {
                    action: 'click',
                    target: clickable.text || 'Element',
                    selector: clickable.selector,
                    description: 'Fallback click action',
                }
            }

            return { action: 'scroll', value: 'down', description: 'Fallback scroll' }
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
     * Broadcast page state via Redis
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
        } catch (err: any) {
            // Silent - frame broadcast is best-effort
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

