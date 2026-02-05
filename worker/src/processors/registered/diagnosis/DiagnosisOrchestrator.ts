import {
    JobData,
    BuildType,
    TestRunStatus,
    VisionContext,
    DiagnosisPageSummary,
    DiagnosisResult,
} from '../../../types'
import { logger } from '../../../utils/logger'
import { Page } from 'playwright'
import { DiagnosisCrawler, DiagnosisCrawlerDependencies } from './DiagnosisCrawler'
import { DiagnosisCancelledError } from '../../../errors'
import {
    TestabilityAnalyzerService,
    TestabilityContract,
    FrontendTestType,
    TEST_TYPE_MAPPINGS
} from '../../../services/testabilityAnalyzer'
import { DiagnosisByTestType, AggregatedDiagnosis } from '../../../services/diagnosis'
import Redis from 'ioredis'
import { ProgressTracker, ProgressPhase } from '../../../services/ProgressTracker'

// Diagnosis Phases with relative execution weights
const DIAGNOSIS_PHASES: ProgressPhase[] = [
    { id: 'init', label: 'Initializing browser session', weight: 5 },
    { id: 'navigate', label: 'Loading page', weight: 15 },
    { id: 'screenshot', label: 'Capturing screenshots', weight: 20 },
    { id: 'per_type', label: 'Running specialized diagnosis', weight: 10 },
    { id: 'ai_analysis', label: 'Running AI analysis', weight: 30 }, // Heavy weight for 26s call
    { id: 'contract', label: 'Generating testability contract', weight: 10 },
    { id: 'verify', label: 'Verifying test plans', weight: 10 },
    { id: 'complete', label: 'Diagnosis complete', weight: 0 }
]

// ============================================================================
// Configuration
// ============================================================================

export interface DiagnosisOrchestratorConfig {
    runId: string
    apiUrl: string
    maxPages: number
    navigationDelayMs: number
}

// Local types not exported globally
export type TestType = FrontendTestType // Alias for consistency

export interface DiagnosisSnapshotResult {
    context: VisionContext
    analysis: DiagnosisResult
    screenshotUrl?: string
    screenshotUrls: string[]
    comprehensiveTests?: any
    perTypeDiagnosis?: AggregatedDiagnosis
}

export interface DiagnosisOrchestratorDependencies {
    unifiedBrain: any
    playwrightRunner: any
    storageService: any
    accessibilityMapService: any
    annotatedScreenshotService: any
    enhancedTestabilityService: any
    verificationService: any
    riskAnalysisService: any
    redis: Redis
    auditService: any
    testabilityAnalyzer: TestabilityAnalyzerService

    getTestDataStore: (runId: string) => any
    ensureDiagnosisActive: (runId: string) => Promise<void>
    getPageTitle: (session: any) => Promise<string | undefined>
    normalizeUrl: (url: string) => string
    buildDiagnosisPageSummary: (params: any) => DiagnosisPageSummary
    aggregateDiagnosisPages: (pages: DiagnosisPageSummary[]) => DiagnosisResult
    evaluateApprovalDecision: (jobData: JobData, diagnosis: DiagnosisResult) => 'auto' | 'wait'
    notifyDiagnosisPending: (runId: string, jobData: JobData, diagnosis: DiagnosisResult) => Promise<void>
    updateDiagnosisProgress: (runId: string, progress: any) => Promise<void>
}

export interface DiagnosisSnippet {
    // Legacy support if needed, or remove
    id: string
}


export class DiagnosisOrchestrator {
    private config: DiagnosisOrchestratorConfig
    private deps: DiagnosisOrchestratorDependencies

    constructor(config: DiagnosisOrchestratorConfig, deps: DiagnosisOrchestratorDependencies) {
        this.config = config
        this.deps = deps
    }

    /**
     * Run full diagnosis flow
     * Returns 'auto' if test should proceed, 'wait' if approval needed
     */
    async run(jobData: JobData): Promise<'auto' | 'wait'> {
        const { runId, build, profile } = jobData

        if (build.type !== BuildType.WEB || !build.url) {
            logger.info({ runId }, 'Diagnosis skipped (unsupported build type or missing URL)')
            return 'auto'
        }

        logger.info({ runId }, 'Starting UI Diagnosis...')

        let session: { id: string; page: Page } | null = null
        const maxPages = this.config.maxPages
        const isMultiPage = maxPages > 1
        const totalSteps = isMultiPage ? 6 : 5

        // Initialize Progress Tracker
        const tracker = new ProgressTracker(
            runId,
            DIAGNOSIS_PHASES,
            this.deps.redis,
            this.deps.updateDiagnosisProgress
        )

        try {
            // STEP 1: Initialize
            await tracker.startPhase('init', 'Reserving browser instance')

            session = await this.deps.playwrightRunner.reserveSession(profile)

            await tracker.updateSubPhase('Session ready')
            await tracker.completePhase('init')

            // Update status to DIAGNOSING
            await this.updateTestStatus(runId, TestRunStatus.DIAGNOSING)
            await this.deps.ensureDiagnosisActive(runId)

            // STEP 2: Navigate
            await tracker.startPhase('navigate', `Navigating to ${build.url}`)

            // Resilient navigation - catch errors and flag them instead of failing
            let navigationError: Error | null = null
            try {
                if (!session) throw new Error('Session not initialized')
                await this.deps.playwrightRunner.executeAction(session.id, {
                    action: 'navigate',
                    value: build.url,
                    description: `Navigate to ${build.url}`,
                })
                await this.delay(this.config.navigationDelayMs)
            } catch (error: any) {
                // Flag the navigation error but DON'T fail the diagnosis
                navigationError = error
                logger.warn({ runId, error: error.message }, '⚠️ Navigation failed - flagging as critical issue and continuing')
            }

            // If navigation failed, create partial diagnosis with error flagged as critical finding
            if (navigationError) {
                const errorDiagnosis: DiagnosisResult = {
                    testableComponents: [],
                    nonTestableComponents: [],
                    highRiskAreas: [{
                        name: 'Navigation Failure',
                        description: `Unable to load ${build.url}: ${navigationError.message}`,
                        riskLevel: 'critical',
                        type: 'complex_state',  // Using complex_state as closest match for navigation issues
                        requiresManualIntervention: true,
                        reason: 'The page could not be loaded. This may indicate slow page performance, network issues, or the site being unavailable.',
                        selector: 'document'
                    }],
                    pages: [{
                        id: 'page-0',
                        label: 'Landing page',
                        url: build.url,
                        action: 'Navigation failed',
                        summary: `Failed to load ${build.url}`,
                        testableComponents: [],
                        nonTestableComponents: [],
                        recommendedTests: [],
                    }],
                    summary: `Navigation to ${build.url} failed. The page may be slow, unavailable, or blocking automated access.`,
                    recommendedTests: [],
                }

                // Update progress to show error was captured
                await tracker.startPhase('complete', 'Navigation issue detected - awaiting review')
                await tracker.completePhase('complete')

                // Update test with partial diagnosis (error flagged as critical finding)
                await this.updateTestWithDiagnosis(runId, errorDiagnosis, 'wait', null, null)
                await this.deps.notifyDiagnosisPending(runId, jobData, errorDiagnosis)

                logger.info({ runId }, 'Navigation error captured as critical finding. Awaiting user review.')
                return 'wait'  // Return to user for review instead of failing
            }

            await tracker.completePhase('navigate')

            await this.deps.ensureDiagnosisActive(runId)

            // Capture snapshot (handles screenshot, per-type, AI analysis phases)
            if (!session) throw new Error('Session lost before capture')
            const baseSnapshot = await this.captureDiagnosisSnapshot(
                {
                    sessionId: session.id,
                    pageIndex: 0,
                    upload: true,
                },
                tracker
            )

            // STEP 4: Generate Testability Contract
            await tracker.startPhase('contract', 'Analyzing page structure')

            let testabilityContract: TestabilityContract | null = null
            if (this.deps.testabilityAnalyzer && session) {
                try {
                    const frontendTestTypes = (jobData.options?.selectedTestTypes || ['navigation']) as FrontendTestType[]
                    // Map frontend simplified types to backend granular types
                    const backendTestTypes = frontendTestTypes.flatMap(type => TEST_TYPE_MAPPINGS[type] || [])

                    testabilityContract = await this.deps.testabilityAnalyzer.generateContract(
                        {
                            urls: [build.url],
                            selectedTestTypes: backendTestTypes,
                            executionMode: isMultiPage ? 'multi-page' : 'single',
                        },
                        session.page
                    )
                    logger.info({ runId, confidence: testabilityContract.overallConfidence }, 'Testability contract generated')

                    await tracker.updateSubPhase('Contract generated')
                } catch (error: any) {
                    logger.warn({ runId, error: error.message }, 'Testability contract generation failed')
                }
            }

            await tracker.completePhase('contract')

            // STEP 5: Verification & Aggregation
            await tracker.startPhase('verify', 'Building page summary')

            const currentUrl = await this.deps.playwrightRunner.getCurrentUrl(session.id).catch(() => build.url)
            const visitedUrls = new Set<string>()
            if (currentUrl) {
                visitedUrls.add(this.deps.normalizeUrl(currentUrl))
            }

            const pageSummaries: DiagnosisPageSummary[] = [
                this.deps.buildDiagnosisPageSummary({
                    id: 'page-0',
                    label: 'Landing page',
                    url: currentUrl || build.url,
                    action: 'Initial view',
                    title: session ? await this.deps.getPageTitle(session) : 'Unknown',
                    screenshotUrl: baseSnapshot.screenshotUrl,
                    screenshotUrls: baseSnapshot.screenshotUrls,
                    diagnosis: baseSnapshot.analysis,
                })
            ]

            // STEP 4: Explore (multi-page) or Analyze (single)
            if (isMultiPage && maxPages > 1) {
                await this.deps.ensureDiagnosisActive(runId)

                const crawler = new DiagnosisCrawler(
                    {
                        runId,
                        baseUrl: build.url,
                        maxPages,
                        navigationDelayMs: this.config.navigationDelayMs,
                    },
                    this.buildCrawlerDeps(session!, tracker)
                )

                const crawlPages = await crawler.crawl(
                    baseSnapshot.context,
                    1,
                    Math.max(0, maxPages - 1)
                )
                pageSummaries.push(...crawlPages)
            }

            // Aggregate and finalize
            await tracker.updateSubPhase('Aggregating results')

            const aggregatedDiagnosis = this.deps.aggregateDiagnosisPages(pageSummaries)
            const decision = this.deps.evaluateApprovalDecision(jobData, aggregatedDiagnosis)

            await tracker.completePhase('verify')
            await tracker.startPhase('complete', decision === 'wait' ? 'Awaiting approval' : 'Auto-approved')
            await tracker.completePhase('complete')

            // Update with diagnosis results (including per-test-type can/cannot)
            await this.updateTestWithDiagnosis(runId, aggregatedDiagnosis, decision, testabilityContract, baseSnapshot.perTypeDiagnosis)

            if (decision === 'wait') {
                logger.info({ runId }, 'Diagnosis complete. Waiting for approval.')
                await this.deps.notifyDiagnosisPending(runId, jobData, aggregatedDiagnosis)
            } else {
                logger.info({ runId }, 'Diagnosis auto-approved.')
            }

            return decision

        } catch (error: any) {
            if (error instanceof DiagnosisCancelledError) {
                logger.info({ runId }, 'Diagnosis cancelled by user.')
                throw error
            }
            logger.error({ runId, error: error.message }, 'Diagnosis failed')
            throw error
        } finally {
            if (session) {
                await this.deps.playwrightRunner.releaseSession(session.id).catch(() => { })
            }
        }
    }

    /**
     * Capture diagnosis snapshot (screenshots, accessibility, analysis)
     */
    private async captureDiagnosisSnapshot(
        params: {
            sessionId: string
            pageIndex: number
            upload: boolean
        },
        tracker?: ProgressTracker // Optional to support existing crawler usage without refactoring crawler yet
    ): Promise<DiagnosisSnapshotResult> {
        const { runId } = this.config
        const { sessionId, pageIndex, upload } = params

        await this.deps.ensureDiagnosisActive(runId)

        // START SCREENSHOT PHASE
        if (tracker) await tracker.startPhase('screenshot')

        // Get page dimensions
        const dimensions = await this.deps.playwrightRunner.getPageDimensions(sessionId)
        const { viewportHeight, documentHeight } = dimensions

        await this.deps.playwrightRunner.scrollToTop(sessionId)
        await this.delay(300)

        // Calculate scroll positions
        const scrollIncrement = Math.floor(viewportHeight * 0.8)
        const totalScrollPositions = Math.max(1, Math.ceil((documentHeight - viewportHeight) / scrollIncrement) + 1)

        // Capture screenshots at each position
        const screenshots: Array<{ position: number; screenshot: string }> = []

        for (let i = 0; i < totalScrollPositions; i++) {
            await this.deps.ensureDiagnosisActive(runId)

            const scrollY = Math.min(i * scrollIncrement, Math.max(0, documentHeight - viewportHeight))
            await this.deps.playwrightRunner.scrollToPosition(sessionId, scrollY)

            if (tracker) {
                await tracker.updateSubPhase(`Capturing screenshot ${i + 1}/${totalScrollPositions}`, i + 1, totalScrollPositions)
            }

            const screenshot = await this.deps.playwrightRunner.captureScreenshot(sessionId, false)
            screenshots.push({ position: scrollY, screenshot })
        }

        await this.deps.playwrightRunner.scrollToTop(sessionId)
        await this.delay(200)

        if (tracker) await tracker.completePhase('screenshot')

        // Get DOM and session
        const domSnapshot = await this.deps.playwrightRunner.getDOMSnapshot(sessionId)
        const session = this.deps.playwrightRunner.getSession(sessionId)
        if (!session) {
            throw new Error(`Session ${sessionId} not found`)
        }

        // Create accessibility map
        const accessibilityMap = await this.deps.accessibilityMapService.createAccessibilityMap(session.page)

        // Create annotated screenshot
        const annotatedScreenshotData = await this.deps.annotatedScreenshotService.createAnnotatedScreenshotWithMap(
            session.page,
            accessibilityMap
        )

        // Convert to VisionContext
        const visionElements = this.deps.accessibilityMapService.convertToVisionElements(accessibilityMap)
        const context: VisionContext = {
            elements: visionElements,
            metadata: {
                totalElements: visionElements.length,
                truncated: false,
                pageUrl: session.page.url(),
                pageTitle: await session.page.title(),
            },
        }

        // Run per-test-type diagnosis
        if (tracker) await tracker.startPhase('per_type')

        // Get selectedTestTypes from job data or default to navigation
        const selectedTestTypes = (this.config as any).selectedTestTypes as FrontendTestType[] || ['navigation']
        logger.info({ runId, selectedTestTypes }, `Running per-test-type diagnosis (${DiagnosisByTestType.getStepCount(selectedTestTypes)} steps)...`)

        let perTypeDiagnosis: AggregatedDiagnosis | null = null
        try {
            perTypeDiagnosis = await DiagnosisByTestType.run(session.page, selectedTestTypes)
            logger.info({
                runId,
                totalSteps: perTypeDiagnosis.totalSteps,
                canTest: perTypeDiagnosis.combined.allCanTest.length,
                cannotTest: perTypeDiagnosis.combined.allCannotTest.length
            }, 'Per-test-type diagnosis completed')
        } catch (error: any) {
            logger.warn({ runId, error: error.message }, 'Per-test-type diagnosis failed')
        }

        if (tracker) await tracker.completePhase('per_type')

        const comprehensiveTests: any = null

        // Semantic analysis (AI call)
        if (tracker) await tracker.startPhase('ai_analysis')

        // Emit progress update BEFORE the slow call so users see movement
        if (tracker) await tracker.updateSubPhase('Running AI analysis (this may take 20s)...', 1, 1)

        let semanticAnalysis: any = {
            testableComponents: [],
            nonTestableComponents: [],
            recommendedTests: [],
            summary: 'Semantic analysis skipped.'
        }

        try {
            semanticAnalysis = await this.deps.unifiedBrain.analyzePageTestability(context)
        } catch (error: any) {
            logger.warn({ runId, error: error.message }, 'Semantic analysis failed')
        }

        // Testability assessment
        const flows = (semanticAnalysis.testableComponents || []).map((comp: any, idx: number) => ({
            name: comp.name || `flow_${idx + 1}`,
            description: comp.description,
            elements: [0],
            priority: comp.testability === 'high' ? 'high' : comp.testability === 'medium' ? 'medium' : 'low'
        }))

        // Validate critical dependencies before proceeding
        if (!accessibilityMap || !accessibilityMap.elements) {
            logger.error({ runId }, 'DIAGNOSIS FAILURE: accessibilityMap is undefined or has no elements')
            throw new Error('accessibilityMap is undefined or missing elements')
        }
        if (!session || !session.page) {
            logger.error({ runId }, 'DIAGNOSIS FAILURE: session or session.page is undefined')
            throw new Error('session.page is undefined')
        }

        logger.info({
            runId,
            flowsCount: flows.length,
            accessibilityMapElementsCount: accessibilityMap.elements?.length || 0
        }, 'Starting testability assessment')

        const testabilityAssessment = await this.deps.enhancedTestabilityService.assessTestability(
            flows,
            accessibilityMap,
            session.page,
            () => { } // onLowConfidence callback - simplified
        )

        logger.info({
            runId,
            testableCount: testabilityAssessment.testable?.length || 0,
            nonTestableCount: testabilityAssessment.nonTestable?.length || 0
        }, 'Testability assessment complete')

        // Verification
        const testDataStore = this.deps.getTestDataStore(runId)
        const verifiedPlans = await this.deps.verificationService.verifyTestPlan(
            testabilityAssessment.testable.map((flow: any) => ({
                name: flow.name,
                elements: flow.elements,
                description: flow.description,
            })),
            accessibilityMap,
            session.page,
            testDataStore,
            undefined
        )

        logger.info({ runId, verifiedPlansCount: verifiedPlans?.length || 0 }, 'Verification complete')

        // Risk analysis
        await this.deps.riskAnalysisService.analyzeRisks(verifiedPlans, session.page)

        logger.info({ runId }, 'Risk analysis complete')

        if (tracker) await tracker.completePhase('ai_analysis')

        // Build analysis result
        const analysis: DiagnosisResult = {
            ...semanticAnalysis,
            testableComponents: testabilityAssessment.testable.map((flow: any) => ({
                name: flow.name,
                selector: '',
                description: flow.description || '',
                testability: flow.confidence >= 0.7 ? 'high' : flow.confidence >= 0.5 ? 'medium' : 'low',
            })),
            nonTestableComponents: [
                ...semanticAnalysis.nonTestableComponents,
                ...(testabilityAssessment.nonTestable || []).map((flow: any) => ({
                    name: flow.name,
                    reason: (flow.blockers || []).map((b: any) => b.message).join('; '),
                })),
            ],
            recommendedTests: [
                ...semanticAnalysis.recommendedTests,
                ...(testabilityAssessment.recommendations || [])
                    .filter((r: any) => r.type === 'ready')
                    .map((r: any) => r.message),
            ],
            comprehensiveTests: comprehensiveTests || undefined,
        }

        // Upload screenshots
        let screenshotUrl: string | undefined
        let screenshotUrls: string[] = []

        if (upload && screenshots.length > 0) {
            for (let i = 0; i < screenshots.length; i++) {
                const buffer = Buffer.from(screenshots[i].screenshot, 'base64')
                const stepNumber = -1000 - pageIndex - (i * 0.1)
                const url = await this.deps.storageService.uploadScreenshot(runId, stepNumber, buffer)
                screenshotUrls.push(url)
                if (i === 0) screenshotUrl = url
            }

            // Upload annotated screenshot
            try {
                const annotatedUrl = await this.deps.storageService.uploadScreenshot(
                    runId,
                    -2000 - pageIndex,
                    annotatedScreenshotData.screenshot
                )
                screenshotUrls.unshift(annotatedUrl)
            } catch (error: any) {
                logger.warn({ runId, error: error.message }, 'Failed to upload annotated screenshot')
            }
        }

        return {
            context,
            analysis,
            screenshotUrl,
            screenshotUrls,
            comprehensiveTests,
            perTypeDiagnosis: perTypeDiagnosis || undefined,
        }
    }

    /**
     * Build crawler dependencies from session
     */
    private buildCrawlerDeps(session: { id: string; page: Page }, tracker?: ProgressTracker): DiagnosisCrawlerDependencies {
        return {
            page: session.page,
            captureSnapshot: async (pageIndex: number) => {
                const result = await this.captureDiagnosisSnapshot({
                    sessionId: session.id,
                    pageIndex,
                    upload: true,
                }, tracker)
                return {
                    context: result.context,
                    analysis: result.analysis,
                    screenshotUrl: result.screenshotUrl,
                }
            },
            executeClick: async (selector: string) => {
                await session.page.click(selector, { timeout: 10000 })
            },
            navigateTo: async (url: string) => {
                await session.page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
            },
            getCurrentUrl: async () => session.page.url(),
            getPageTitle: async () => await session.page.title(),
        }
    }

    /**
     * Update test status via API
     */
    private async updateTestStatus(runId: string, status: TestRunStatus): Promise<void> {
        const fetch = (await import('node-fetch')).default
        const response = await fetch(`${this.config.apiUrl}/api/tests/${runId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status,
                startedAt: new Date().toISOString(),
            }),
        })
        if (!response.ok) {
            const errorText = await response.text()
            logger.warn({ runId, status: response.status, body: errorText }, '⚠️ Diagnosis status update failed')
        }
    }

    /**
     * Update test with diagnosis results
     */
    private async updateTestWithDiagnosis(
        runId: string,
        diagnosis: DiagnosisResult,
        decision: 'auto' | 'wait',
        testabilityContract?: TestabilityContract | null,
        perTypeDiagnosis?: AggregatedDiagnosis | null
    ): Promise<void> {
        const fetch = (await import('node-fetch')).default
        const payload: any = { diagnosis }
        if (testabilityContract) {
            payload.testabilityContract = testabilityContract
        }
        if (perTypeDiagnosis) {
            payload.perTypeDiagnosis = perTypeDiagnosis
        }
        if (decision === 'wait') {
            payload.status = TestRunStatus.WAITING_APPROVAL
        }
        const response = await fetch(`${this.config.apiUrl}/api/tests/${runId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })
        if (!response.ok) {
            const errorText = await response.text()
            logger.warn({ runId, status: response.status, body: errorText }, '⚠️ Diagnosis result update failed')
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms))
    }
}
