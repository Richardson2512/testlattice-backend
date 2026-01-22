/**
 * DiagnosisOrchestrator
 * Orchestrates the UI Diagnosis flow for Registered tests
 * Handles testability analysis, multi-page crawl, and approval workflow
 */

import { Page } from 'playwright'
import {
    VisionContext,
    DiagnosisResult,
    DiagnosisPageSummary,
    DiagnosisProgress,
    JobData,
    BuildType,
    TestRunStatus
} from '../../../types'
import { logger } from '../../../observability'
import { DiagnosisCrawler, DiagnosisCrawlerConfig, DiagnosisCrawlerDependencies } from '../diagnosis/DiagnosisCrawler'
import { DiagnosisCancelledError } from '../../types'

// ============================================================================
// Configuration
// ============================================================================

export interface DiagnosisOrchestratorConfig {
    runId: string
    apiUrl: string
    navigationDelayMs: number
    maxPages: number
}

// ============================================================================
// Dependencies (injected from TestProcessor)
// ============================================================================

export interface DiagnosisOrchestratorDependencies {
    // Browser control
    playwrightRunner: {
        reserveSession: (profile: any) => Promise<{ id: string; page: Page }>
        releaseSession: (sessionId: string) => Promise<any>
        executeAction: (sessionId: string, action: any) => Promise<any>
        captureScreenshot: (sessionId: string, fullPage: boolean) => Promise<string>
        getDOMSnapshot: (sessionId: string) => Promise<string>
        getPageDimensions: (sessionId: string) => Promise<{ viewportHeight: number; documentHeight: number }>
        scrollToTop: (sessionId: string) => Promise<void>
        scrollToPosition: (sessionId: string, y: number) => Promise<void>
        getCurrentUrl: (sessionId: string) => Promise<string>
        getSession: (sessionId: string) => { page: Page } | null | undefined
    }

    // Services
    unifiedBrain: {
        analyzeScreenshot: (screenshot: string, dom: string, mode: string) => Promise<VisionContext>
        analyzePageTestability: (context: VisionContext) => Promise<any>
    }
    comprehensiveTesting: {
        initialize: (page: Page) => Promise<any>
        collectPerformanceMetrics: (page: Page) => Promise<any>
        checkAccessibility: (page: Page) => Promise<any>
        analyzeDOMHealth: (page: Page) => Promise<any>
        detectVisualIssues: (page: Page) => Promise<any>
        checkSecurity: (page: Page) => Promise<any>
        checkSEO: (page: Page) => Promise<any>
        analyzeThirdPartyDependencies: (page: Page) => Promise<any>
        getResults: () => any
    }
    accessibilityMapService: {
        createAccessibilityMap: (page: Page) => Promise<any>
        convertToVisionElements: (map: any) => any[]
    }
    annotatedScreenshotService: {
        createAnnotatedScreenshotWithMap: (page: Page, map: any) => Promise<{ screenshot: Buffer; elementMap: any[] }>
    }
    enhancedTestabilityService: {
        assessTestability: (flows: any[], map: any, page: Page, onLowConfidence: any) => Promise<any>
    }
    verificationService: {
        verifyTestPlan: (plans: any[], map: any, page: Page, store: any, instructions: any) => Promise<any>
    }
    riskAnalysisService: {
        analyzeRisks: (plans: any, page: Page) => Promise<any>
    }
    storageService: {
        uploadScreenshot: (runId: string, stepNumber: number, buffer: Buffer) => Promise<string>
    }

    // State management
    getTestDataStore: (runId: string) => any
    ensureDiagnosisActive: (runId: string) => Promise<void>
    updateDiagnosisProgress: (runId: string, progress: DiagnosisProgress) => Promise<void>
    getPageTitle: (session: any) => Promise<string | undefined>

    // Aggregation utilities
    aggregateDiagnosisPages: (pages: DiagnosisPageSummary[]) => DiagnosisResult
    evaluateApprovalDecision: (jobData: JobData, diagnosis: DiagnosisResult) => 'auto' | 'wait'
    notifyDiagnosisPending: (runId: string, jobData: JobData, diagnosis: DiagnosisResult) => Promise<void>
    buildDiagnosisPageSummary: (params: any) => DiagnosisPageSummary
    normalizeUrl: (url: string) => string
}

// ============================================================================
// Result Types
// ============================================================================

export interface DiagnosisSnapshotResult {
    context: VisionContext
    analysis: DiagnosisResult
    screenshotUrl?: string
    screenshotUrls?: string[]
    comprehensiveTests?: any
}

// ============================================================================
// DiagnosisOrchestrator Class
// ============================================================================

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

        try {
            // STEP 1: Initialize
            await this.deps.updateDiagnosisProgress(runId, {
                step: 1,
                totalSteps,
                stepLabel: 'Initializing secure browser session',
                subStep: 1,
                totalSubSteps: 2,
                subStepLabel: 'Reserving browser instance',
                percent: 5,
            })

            session = await this.deps.playwrightRunner.reserveSession(profile)

            await this.deps.updateDiagnosisProgress(runId, {
                step: 1,
                totalSteps,
                stepLabel: 'Session ready',
                subStep: 2,
                totalSubSteps: 2,
                subStepLabel: 'Session ready',
                percent: 10,
            })

            // Update status to DIAGNOSING
            await this.updateTestStatus(runId, TestRunStatus.DIAGNOSING)
            await this.deps.ensureDiagnosisActive(runId)

            // STEP 2: Navigate
            await this.deps.updateDiagnosisProgress(runId, {
                step: 2,
                totalSteps,
                stepLabel: `Loading ${build.url}`,
                subStep: 1,
                totalSubSteps: 2,
                subStepLabel: 'Navigating to URL',
                percent: 15,
            })

            await this.deps.playwrightRunner.executeAction(session.id, {
                action: 'navigate',
                value: build.url,
                description: `Navigate to ${build.url}`,
            })
            await this.delay(this.config.navigationDelayMs)

            await this.deps.updateDiagnosisProgress(runId, {
                step: 2,
                totalSteps,
                stepLabel: 'Page loaded successfully',
                subStep: 2,
                totalSubSteps: 2,
                subStepLabel: 'Page loaded',
                percent: 25,
            })

            await this.deps.ensureDiagnosisActive(runId)

            // STEP 3: Capture
            const baseSnapshot = await this.captureDiagnosisSnapshot({
                sessionId: session.id,
                pageIndex: 0,
                upload: true,
                onProgress: (progress) => {
                    const scanProgress = 30 + (progress.current / progress.total) * 20
                    this.deps.updateDiagnosisProgress(runId, {
                        step: 3,
                        totalSteps,
                        stepLabel: `Capturing screenshot ${progress.current}/${progress.total}`,
                        subStep: progress.current,
                        totalSubSteps: progress.total,
                        subStepLabel: `Position ${progress.position}px`,
                        percent: Math.min(50, Math.floor(scanProgress)),
                    }).catch(() => { })
                }
            })

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
                    title: await this.deps.getPageTitle(session),
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
                    this.buildCrawlerDeps(session)
                )

                const crawlPages = await crawler.crawl(
                    baseSnapshot.context,
                    1,
                    Math.max(0, maxPages - 1)
                )
                pageSummaries.push(...crawlPages)
            }

            // Aggregate and finalize
            const aggregatedDiagnosis = this.deps.aggregateDiagnosisPages(pageSummaries)
            const decision = this.deps.evaluateApprovalDecision(jobData, aggregatedDiagnosis)

            await this.deps.updateDiagnosisProgress(runId, {
                step: totalSteps,
                totalSteps,
                stepLabel: decision === 'wait' ? 'Awaiting approval' : 'Auto-approved',
                subStep: 1,
                totalSubSteps: 1,
                subStepLabel: 'Complete',
                percent: 100,
            })

            // Update with diagnosis results
            await this.updateTestWithDiagnosis(runId, aggregatedDiagnosis, decision)

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
    private async captureDiagnosisSnapshot(params: {
        sessionId: string
        pageIndex: number
        upload: boolean
        onProgress?: (progress: { current: number; total: number; position: number }) => void
    }): Promise<DiagnosisSnapshotResult> {
        const { runId } = this.config
        const { sessionId, pageIndex, upload, onProgress } = params

        await this.deps.ensureDiagnosisActive(runId)

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

            if (onProgress) {
                onProgress({ current: i + 1, total: totalScrollPositions, position: scrollY })
            }

            const screenshot = await this.deps.playwrightRunner.captureScreenshot(sessionId, false)
            screenshots.push({ position: scrollY, screenshot })
        }

        await this.deps.playwrightRunner.scrollToTop(sessionId)
        await this.delay(200)

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

        // Comprehensive testing
        let comprehensiveTests: any = null
        try {
            await this.deps.comprehensiveTesting.initialize(session.page)
            await Promise.all([
                this.deps.comprehensiveTesting.collectPerformanceMetrics(session.page),
                this.deps.comprehensiveTesting.checkAccessibility(session.page),
                this.deps.comprehensiveTesting.analyzeDOMHealth(session.page),
                this.deps.comprehensiveTesting.detectVisualIssues(session.page),
                this.deps.comprehensiveTesting.checkSecurity(session.page),
                this.deps.comprehensiveTesting.checkSEO(session.page),
                this.deps.comprehensiveTesting.analyzeThirdPartyDependencies(session.page),
            ])
            comprehensiveTests = this.deps.comprehensiveTesting.getResults()
        } catch (error: any) {
            logger.warn({ runId, error: error.message }, 'Comprehensive testing failed')
        }

        // Semantic analysis
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

        const testabilityAssessment = await this.deps.enhancedTestabilityService.assessTestability(
            flows,
            accessibilityMap,
            session.page,
            () => { } // onLowConfidence callback - simplified
        )

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

        // Risk analysis
        await this.deps.riskAnalysisService.analyzeRisks(verifiedPlans, session.page)

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
        }
    }

    /**
     * Build crawler dependencies from session
     */
    private buildCrawlerDeps(session: { id: string; page: Page }): DiagnosisCrawlerDependencies {
        return {
            page: session.page,
            captureSnapshot: async (pageIndex: number) => {
                const result = await this.captureDiagnosisSnapshot({
                    sessionId: session.id,
                    pageIndex,
                    upload: true,
                })
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
        await fetch(`${this.config.apiUrl}/api/tests/${runId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status,
                startedAt: new Date().toISOString(),
            }),
        })
    }

    /**
     * Update test with diagnosis results
     */
    private async updateTestWithDiagnosis(
        runId: string,
        diagnosis: DiagnosisResult,
        decision: 'auto' | 'wait'
    ): Promise<void> {
        const fetch = (await import('node-fetch')).default
        const payload: any = { diagnosis }
        if (decision === 'wait') {
            payload.status = TestRunStatus.WAITING_APPROVAL
        }
        await fetch(`${this.config.apiUrl}/api/tests/${runId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms))
    }
}
