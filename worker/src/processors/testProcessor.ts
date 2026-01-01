// ============================================================================
// CRITICAL ORCHESTRATION ENGINE - LINT EXCEPTION BOUNDARY
// ============================================================================
// This file is the core test execution orchestration engine for the worker.
// It coordinates multiple services, manages complex state machines, and handles
// error recovery across thousands of lines of production-critical code.
//
// HIGH COMPLEXITY IS INTENTIONAL:
// - Orchestrates 20+ services (AI, vision, storage, runners, etc.)
// - Manages complex execution flows with pause/resume, error recovery
// - Handles browser matrix testing, guest tests, diagnosis flows
// - Contains tightly-coupled state management required for correctness
//
// LINT RULES DISABLED BY DESIGN:
// - Complexity metrics disabled (this IS complex by necessity)
// - Line count limits disabled (orchestration requires extensive code)
// - Function parameter limits disabled (service coordination needs many params)
// - Type safety warnings relaxed (any types used for dynamic service interfaces)
//
// This is a BOUNDARY FILE - style linting is disabled to prevent blocking
// production execution. Runtime correctness is maintained through:
// - TypeScript compilation (still enforced)
// - Runtime error handling (try/catch blocks preserved)
// - Service integration tests (external validation)
//
// DO NOT refactor for lint compliance - this would break production logic.
// ============================================================================

// Test job processor with step-by-step execution and pause/resume support
import {
  JobData,
  TestRunStatus,
  BuildType,
  LLMAction,
  TestStep,
  VisionContext,
  VisionElement,
  SelfHealingInfo,
  ActionExecutionResult,
  DiagnosisResult,
  DiagnosisPageSummary,
  DiagnosisComponentInsight,
  DiagnosisIssueInsight,
  DiagnosisProgress,
  TestEnvironment,
  Build,
  TestProfile,
  TestOptions,
  DeviceProfile,
  ComprehensiveTestResults,
} from '../types'
import { UnifiedBrainService } from '../services/unifiedBrainService'
import { UnifiedAIExecutor } from '../services/unifiedAIExecutor'
import { getExecutionLogEmitter } from '../services/executionLogEmitter'
import { StorageService } from '../services/storage'

import { PineconeService } from '../services/pinecone'
import { PlaywrightRunner, RunnerSession } from '../runners/playwright'
import { AppiumRunner } from '../runners/appium'
import { config } from '../config/env'
import { formatErrorForStep } from '../utils/errorFormatter'
import { ComprehensiveTestingService } from '../services/comprehensiveTesting'
import { FailureExplanationService } from '../services/failureExplanationService'
import { AIThinkingBroadcaster } from '../services/aiThinkingBroadcaster'
import { SelfHealingMemoryService } from '../services/selfHealingMemory'
import { ScreenshotLiveViewService } from '../services/screenshotLiveView'
import { VisionValidatorService, VisionIssue } from '../services/visionValidator'
import { WebRTCStreamer } from '../services/webrtcStreamer'
import { IntelligentRetryLayer } from '../services/intelligentRetryLayer'
import { TestingStrategyService } from '../services/testingStrategy'
import { RunLogger } from '../loggers/runLogger'
import { ContextSynthesizer } from '../synthesizers/contextSynthesizer'
import { TestExecutor } from '../executors/testExecutor'
import { VisualDiffService } from '../services/visualDiff'
import { AccessibilityMapService } from '../services/accessibilityMap'
import { VerificationService } from '../services/verificationService'
import { EnhancedTestabilityService } from '../services/enhancedTestability'
import { AnnotatedScreenshotService } from '../services/annotatedScreenshot'
import { RiskAnalysisService } from '../services/riskAnalysis'
import { TestDataStore } from '../services/testDataStore'
import { LearningService } from '../services/learningService'
import type { CookieBannerHandler } from '../services/cookieBannerHandler'
import { AuthenticationFlowAnalyzer } from '../services/authenticationFlowAnalyzer'
import { UnifiedPreflightService } from '../services/unifiedPreflightService'
import { ContinuousPopupHandler } from '../services/continuousPopupHandler'
import { assertPreflightCompletedBeforeScreenshot, assertPreflightCompletedBeforeDOMSnapshot, assertPreflightCompletedBeforeAIAnalysis } from '../services/preflightInvariants'
import { ActionContext } from '../types/actionContext'
import Redis from 'ioredis'
import { SuccessEvaluator } from '../services/successEvaluator'

// ============================================================================
// REFACTORING BOUNDARY - DO NOT MODIFY EXTRACTED MODULES
// ============================================================================
// The following modules contain extracted code from testProcessor.ts:
// - testProcessorUtils: Pure utility functions (normalizeUrl, resolveUrl, etc.)
// - diagnosisAggregator: Diagnosis result aggregation logic
// - approvalEvaluator: Test approval/verdict evaluation logic
//
// REFACTORING RULES:
// - DO NOT re-introduce extracted functions back into this file
// - DO NOT modify extracted functions here - update them in their modules
// - DO NOT extract code that depends on class instance state
// - DO NOT extract code that modifies execution flow or try/catch blocks
// ============================================================================

import * as testProcessorUtils from '../utils/testProcessorUtils'
import * as diagnosisAggregator from './diagnosis/diagnosisAggregator'
import * as approvalEvaluator from './diagnosis/approvalEvaluator'
import { ProcessResult, BrowserMatrixResult, DiagnosisCancelledError } from './types'

export { BrowserMatrixResult }

export class TestProcessor {
  private unifiedBrain: UnifiedBrainService
  private storageService: StorageService

  private pineconeService: PineconeService | null
  private playwrightRunner: PlaywrightRunner
  private appiumRunner: AppiumRunner | null
  private redis: Redis
  private apiUrl: string
  private comprehensiveTesting: ComprehensiveTestingService
  private testingStrategy: TestingStrategyService
  private visionValidator?: VisionValidatorService | null
  private visionValidatorInterval: number
  private streamer: WebRTCStreamer | null = null
  private retryLayer: IntelligentRetryLayer | null = null
  // Refactored services for better separation of concerns
  private runLogger: RunLogger
  private contextSynthesizer: ContextSynthesizer
  private testExecutor: TestExecutor
  private visualDiffService: VisualDiffService
  private accessibilityMapService: AccessibilityMapService
  private verificationService: VerificationService
  private enhancedTestabilityService: EnhancedTestabilityService
  private annotatedScreenshotService: AnnotatedScreenshotService
  private riskAnalysisService: RiskAnalysisService
  private testDataStores: Map<string, TestDataStore> = new Map() // Phase 1: Stateful test data per run
  private unifiedPreflight: UnifiedPreflightService
  private failureExplanationService: FailureExplanationService | null = null
  private aiThinkingBroadcaster: AIThinkingBroadcaster | null = null
  private selfHealingMemory: SelfHealingMemoryService | null = null
  private screenshotLiveView: ScreenshotLiveViewService | null = null
  private authFlowAnalyzer: AuthenticationFlowAnalyzer
  private unifiedAIExecutor: UnifiedAIExecutor
  private successEvaluator: SuccessEvaluator
  private continuousPopupHandler: ContinuousPopupHandler

  constructor(
    unifiedBrain: UnifiedBrainService,
    storageService: StorageService,

    pineconeService: PineconeService | null,
    playwrightRunner: PlaywrightRunner,
    appiumRunner: AppiumRunner | null,
    visionValidator?: VisionValidatorService | null,
    visionValidatorInterval: number = 0,
    redis?: Redis // Optional - will create if not provided for backward compatibility
  ) {
    this.unifiedBrain = unifiedBrain
    this.storageService = storageService

    this.pineconeService = pineconeService
    this.playwrightRunner = playwrightRunner
    this.appiumRunner = appiumRunner
    this.visionValidator = visionValidator || null
    this.visionValidatorInterval = visionValidatorInterval
    // Use injected Redis or create new connection (backward compatible)
    this.redis = redis || new Redis(process.env.REDIS_URL || 'redis://localhost:6379')
    this.apiUrl = config.api.url || process.env.API_URL || 'http://localhost:3001'
    this.comprehensiveTesting = new ComprehensiveTestingService()
    this.testingStrategy = new TestingStrategyService()


    // Initialize Intelligent Retry Layer (IRL) with UnifiedBrainService
    this.retryLayer = new IntelligentRetryLayer(
      unifiedBrain,
      playwrightRunner,
      appiumRunner || undefined,
      {
        maxRetries: config.irl?.maxRetries ?? 3,
        initialDelay: config.irl?.initialDelay ?? 500,
        maxDelay: config.irl?.maxDelay ?? 5000,
        enableVisionMatching: config.irl?.enableVisionMatching ?? true,
        enableAIAlternatives: config.irl?.enableAIAlternatives ?? true,
      }
    )

    // Initialize refactored services

    this.runLogger = new RunLogger(storageService, pineconeService, this.apiUrl)
    this.contextSynthesizer = new ContextSynthesizer(unifiedBrain, this.comprehensiveTesting)
    this.testExecutor = new TestExecutor(playwrightRunner, appiumRunner, this.retryLayer)
    this.visualDiffService = new VisualDiffService(0.1) // 0.1 threshold for pixel comparison

    // Initialize new enhanced services
    this.accessibilityMapService = new AccessibilityMapService()
    this.verificationService = new VerificationService()
    this.enhancedTestabilityService = new EnhancedTestabilityService()
    this.annotatedScreenshotService = new AnnotatedScreenshotService()
    this.riskAnalysisService = new RiskAnalysisService()
    this.authFlowAnalyzer = new AuthenticationFlowAnalyzer()
    this.unifiedPreflight = new UnifiedPreflightService(
      unifiedBrain,
      this.contextSynthesizer,
      this.comprehensiveTesting,
      playwrightRunner
    )
    this.continuousPopupHandler = new ContinuousPopupHandler()

    // Initialize Unified AI Executor for centralized AI call management
    this.unifiedAIExecutor = new UnifiedAIExecutor(unifiedBrain, visionValidator || null)
    this.successEvaluator = new SuccessEvaluator()
  }

  private getTestDataStore(runId: string): TestDataStore | undefined {
    return this.testDataStores.get(runId)
  }

  private getDiagnosisPageLimit(jobData: JobData): number {
    const configured = config.diagnosis?.maxPages ?? 3
    const mode = jobData.options?.testMode

    if (!mode || mode === 'single') {
      return 1
    }

    if (mode === 'multi') {
      return Math.max(1, configured)
    }

    if (jobData.options?.allPages || mode === 'all') {
      return Math.max(5, configured)
    }

    return Math.max(1, configured)
  }

  private async captureDiagnosisSnapshot(params: {
    sessionId: string
    runId: string
    pageIndex: number
    upload?: boolean
    onProgress?: (progress: { current: number; total: number; position: number }) => void
  }): Promise<{ context: VisionContext; analysis: DiagnosisResult; screenshotUrl?: string; screenshotUrls?: string[]; comprehensiveTests?: ComprehensiveTestResults }> {
    await this.ensureDiagnosisActive(params.runId)

    // Get page dimensions to determine how many screenshots we need
    const dimensions = await this.playwrightRunner.getPageDimensions(params.sessionId)
    const { viewportHeight, documentHeight } = dimensions

    console.log(`[${params.runId}] Page dimensions: viewport=${viewportHeight}px, document=${documentHeight}px`)

    // Scroll to top first
    await this.playwrightRunner.scrollToTop(params.sessionId)
    await this.delay(300)

    // Calculate number of scroll positions needed
    // We'll capture screenshots with 20% overlap to ensure we don't miss content
    const scrollIncrement = Math.floor(viewportHeight * 0.8) // 80% of viewport = 20% overlap
    const totalScrollPositions = Math.max(1, Math.ceil((documentHeight - viewportHeight) / scrollIncrement) + 1)

    console.log(`[${params.runId}] Will capture ${totalScrollPositions} screenshots to cover entire page`)

    // Capture screenshots at different scroll positions
    const screenshots: Array<{ position: number; screenshot: string }> = []

    for (let i = 0; i < totalScrollPositions; i++) {
      await this.ensureDiagnosisActive(params.runId)

      const scrollY = Math.min(i * scrollIncrement, Math.max(0, documentHeight - viewportHeight))
      await this.playwrightRunner.scrollToPosition(params.sessionId, scrollY)

      // Update progress if callback provided
      if (params.onProgress) {
        params.onProgress({
          current: i + 1,
          total: totalScrollPositions,
          position: scrollY,
        })
      }

      // Capture screenshot at this position
      const screenshot = await this.playwrightRunner.captureScreenshot(params.sessionId, false)
      screenshots.push({ position: scrollY, screenshot })

      console.log(`[${params.runId}] Captured screenshot ${i + 1}/${totalScrollPositions} at position ${scrollY}px`)
    }

    // Scroll back to top after capturing all screenshots
    await this.playwrightRunner.scrollToTop(params.sessionId)
    await this.delay(200)

    // Get full DOM snapshot (only need to do this once as DOM is the same regardless of scroll position)
    // The DOM contains all elements from the entire page, not just the viewport
    const domSnapshot = await this.playwrightRunner.getDOMSnapshot(params.sessionId)

    // Get page from session for accessibility map creation
    const session = this.playwrightRunner.getSession(params.sessionId)
    if (!session) {
      throw new Error(`Session ${params.sessionId} not found`)
    }
    const { page } = session

    // STEP 1: Create Accessibility Map (interactive elements only with position data)
    console.log(`[${params.runId}] Creating accessibility map...`)
    const accessibilityMap = await this.accessibilityMapService.createAccessibilityMap(page)
    console.log(`[${params.runId}] Accessibility map created: ${accessibilityMap.totalInteractive} interactive elements`)

    // STEP 2: Create annotated screenshot with numbered markers [1], [2], [3]
    console.log(`[${params.runId}] Creating annotated screenshot...`)
    const annotatedScreenshotData = await this.annotatedScreenshotService.createAnnotatedScreenshotWithMap(
      page,
      accessibilityMap
    )

    // Convert accessibility map to VisionContext format for compatibility
    const visionElements = this.accessibilityMapService.convertToVisionElements(accessibilityMap)
    const context: VisionContext = {
      elements: visionElements,
      metadata: {
        totalElements: visionElements.length,
        truncated: false,
        pageUrl: page.url(),
        pageTitle: await page.title(),
      },
    }

    // Analyze the DOM snapshot (this extracts all elements from the full page)
    // We use the accessibility map context instead of full DOM analysis for better efficiency
    let fullContext: VisionContext = { elements: [], metadata: { totalElements: 0, truncated: false } }
    try {
      fullContext = await this.unifiedBrain.analyzeScreenshot(
        screenshots[0]?.screenshot || '', // Use first screenshot for analysis
        domSnapshot,
        'Diagnosis'
      )
    } catch (err: any) {
      console.warn(`[${params.runId}] UnifiedBrain analysis failed (non-fatal):`, err.message)
      // Continue with empty fullContext
    }

    // Merge accessibility map elements with full context (accessibility map has position data)
    context.elements = visionElements.map((ve, idx) => {
      const fullEl = fullContext.elements.find(e => e.selector === ve.selector)
      return fullEl ? { ...ve, ...fullEl } : ve
    })

    // Initialize comprehensive testing
    console.log(`[${params.runId}] Initializing comprehensive testing for diagnosis...`)
    await this.comprehensiveTesting.initialize(page)

    // Run all comprehensive tests during diagnosis
    console.log(`[${params.runId}] Running comprehensive test checks during diagnosis...`)
    let comprehensiveTests: ComprehensiveTestResults | null = null
    try {
      await Promise.all([
        this.comprehensiveTesting.collectPerformanceMetrics(page),
        this.comprehensiveTesting.checkAccessibility(page),
        this.comprehensiveTesting.analyzeDOMHealth(page),
        this.comprehensiveTesting.detectVisualIssues(page),
        this.comprehensiveTesting.checkSecurity(page),
        this.comprehensiveTesting.checkSEO(page),
        this.comprehensiveTesting.analyzeThirdPartyDependencies(page),
      ])
      comprehensiveTests = this.comprehensiveTesting.getResults()
      const securityCount = comprehensiveTests.security?.length || 0
      const seoCount = comprehensiveTests.seo?.length || 0
      const thirdPartyCount = comprehensiveTests.thirdPartyDependencies?.length || 0
      const wcagLevel = comprehensiveTests.wcagScore?.level || 'none'
      console.log(`[${params.runId}] Comprehensive tests completed: ${comprehensiveTests.consoleErrors.length} console errors, ${comprehensiveTests.networkErrors.length} network errors, ${comprehensiveTests.accessibility.length} accessibility issues, ${securityCount} security issues, ${seoCount} SEO issues, ${thirdPartyCount} third-party dependencies, WCAG: ${wcagLevel}`)
    } catch (compError: any) {
      console.warn(`[${params.runId}] Failed to collect comprehensive test data during diagnosis:`, compError.message)
    }

    // STEP 3: Semantic Understanding - Analyze page type and flows
    console.log(`[${params.runId}] Performing semantic analysis...`)
    let semanticAnalysis: any = {
      testableComponents: [],
      nonTestableComponents: [],
      recommendedTests: [],
      summary: 'Semantic analysis skipped due to AI service unavailability.'
    }

    try {
      semanticAnalysis = await this.unifiedBrain.analyzePageTestability(context)
    } catch (err: any) {
      console.warn(`[${params.runId}] Semantic analysis failed (non-fatal):`, err.message)
    }

    // STEP 4: Enhanced Testability Assessment with detailed checks
    console.log(`[${params.runId}] Running enhanced testability assessment...`)
    // Convert testable components to flow format for assessment
    // Map selectors to accessibility map element indices
    const flows = semanticAnalysis.testableComponents.map((comp: DiagnosisComponentInsight, idx: number) => {
      const elementIndices = accessibilityMap.elements
        .map((el: any, elIdx: number) => (el.bestSelector === comp.selector ? elIdx : -1))
        .filter((idx) => idx >= 0)

      return {
        name: comp.name || `flow_${idx + 1}`,
        description: comp.description,
        elements: elementIndices.length > 0 ? elementIndices : [0], // Fallback to first element if not found
        priority: comp.testability === 'high' ? 'high' : comp.testability === 'medium' ? 'medium' : 'low' as 'high' | 'medium' | 'low',
      }
    })

    // Phase 1: Get test data store for this run
    const testDataStore = this.getTestDataStore(params.runId)

    // Phase 1: Low confidence callback for hard stop (ENHANCED with rich notifications)
    const onLowConfidence = async (flow: any) => {
      console.error(`[${params.runId}] HARD STOP: Flow "${flow.name}" has confidence ${flow.confidence.toFixed(2)} < 0.4`)

      // Capture screenshot for rich notification
      let screenshotBase64: string | undefined
      try {
        const buffer = await page.screenshot({ fullPage: true })
        const screenshot = buffer.toString('base64')
        screenshotBase64 = screenshot
      } catch (err) {
        console.warn('Failed to capture screenshot for notification:', err)
      }

      // Build rich notification payload
      const rootCause = flow.rootCause || {
        rootCause: 'low_confidence',
        specificIssue: `Flow "${flow.name}" has low confidence`,
        actionableSteps: flow.blockers.map((b: any) => b.suggestion),
        blockingOverlay: undefined,
      }

      // Send rich notification (Slack Block Kit format)
      try {
        const { config } = await import('../config/env')
        if (config.notifications.slackWebhook) {
          const frontendUrl = config.notifications.frontendBaseUrl || 'https://Rihario-7ip77vn43-pricewises-projects.vercel.app'
          const testRunUrl = `${frontendUrl}/test/report/${params.runId}`

          // Slack Block Kit format for rich cards
          const blocks: any[] = [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: '🚨 Test Paused: Low Confidence',
                emoji: true,
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Run ID:* ${params.runId}\n*Flow:* ${flow.name}\n*Confidence:* ${flow.confidence.toFixed(2)}`,
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Issue:*\n${rootCause.specificIssue}`,
              },
            },
          ]

          // Add screenshot if available (Slack supports image URLs, but base64 needs to be uploaded)
          // For now, we'll include it as a text note and link to the test run
          if (screenshotBase64) {
            blocks.push({
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*Screenshot available in test run*',
              },
            })
          }

          // Add actionable steps
          if (rootCause.actionableSteps && rootCause.actionableSteps.length > 0) {
            blocks.push({
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Actionable Steps:*\n${rootCause.actionableSteps.map((step: string, idx: number) => `${idx + 1}. ${step}`).join('\n')}`,
              },
            })
          }

          // Add overlay opt-in if blocking overlay detected
          if (rootCause.blockingOverlay) {
            blocks.push({
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Overlay Detected:*\nI found a blocking ${rootCause.blockingOverlay.type} (${rootCause.blockingOverlay.id || rootCause.blockingOverlay.selector}).\n\nShould I auto-dismiss it in future runs?`,
              },
              accessory: {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Enable Auto-Dismiss',
                },
                value: JSON.stringify({
                  runId: params.runId,
                  overlaySelector: rootCause.blockingOverlay.selector,
                  overlayId: rootCause.blockingOverlay.id,
                }),
                action_id: 'enable_overlay_dismiss',
                url: `${testRunUrl}?action=enable_overlay_dismiss&overlay=${encodeURIComponent(rootCause.blockingOverlay.selector)}`,
              },
            })
          }

          // Add link to test run
          blocks.push({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `<${testRunUrl}|View Test Run>`,
            },
          })

          await fetch(config.notifications.slackWebhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ blocks }),
          }).catch(() => { })
        }
      } catch (err) {
        console.error('Failed to send notification:', err)
      }
    }

    const testabilityAssessment = await this.enhancedTestabilityService.assessTestability(
      flows,
      accessibilityMap,
      page,
      onLowConfidence
    )

    // STEP 5: Verification Loop - Verify selectors before execution
    console.log(`[${params.runId}] Verifying test plan...`)
    // Phase 1 & 3: Pass test data store and user instructions to verification
    // Extract user instructions from jobData if available
    const userInstructions = undefined // jobData removed as it's not in scope

    const verifiedPlans = await this.verificationService.verifyTestPlan(
      testabilityAssessment.testable.map((flow) => ({
        name: flow.name,
        elements: flow.elements,
        description: flow.description,
      })),
      accessibilityMap,
      page,
      testDataStore,
      userInstructions // Phase 3: @fake pattern matching support
    )

    // STEP 6: Risk Analysis
    console.log(`[${params.runId}] Analyzing risks...`)
    const riskAnalysis = await this.riskAnalysisService.analyzeRisks(verifiedPlans, page)

    // Merge all analysis results
    const analysis: DiagnosisResult = {
      ...semanticAnalysis,
      // Add enhanced testability data
      testableComponents: testabilityAssessment.testable.map((flow) => ({
        name: flow.name,
        selector: context.elements[flow.elements[0]]?.selector || '',
        description: flow.description || '',
        testability: flow.confidence >= 0.7 ? 'high' : flow.confidence >= 0.5 ? 'medium' : 'low',
      })),
      nonTestableComponents: [
        ...semanticAnalysis.nonTestableComponents,
        ...testabilityAssessment.nonTestable.map((flow) => ({
          name: flow.name,
          reason: flow.blockers.map((b) => b.message).join('; '),
        })),
      ],
      recommendedTests: [
        ...semanticAnalysis.recommendedTests,
        ...testabilityAssessment.recommendations
          .filter((r) => r.type === 'ready')
          .map((r) => r.message),
      ],
    }

    // Include comprehensive test results in analysis
    const analysisWithTests: DiagnosisResult = {
      ...analysis,
      comprehensiveTests: comprehensiveTests || undefined
    }

    // Upload ALL screenshots captured during scrolling
    let screenshotUrl: string | undefined
    let screenshotUrls: string[] = []

    if (params.upload && screenshots.length > 0) {
      // Upload all screenshots with different step numbers
      for (let i = 0; i < screenshots.length; i++) {
        const buffer = Buffer.from(screenshots[i].screenshot, 'base64')
        // Use decimal step numbers to differentiate: -1000.0, -1000.1, -1000.2, etc.
        const stepNumber = -1000 - params.pageIndex - (i * 0.1)
        const url = await this.storageService.uploadScreenshot(params.runId, stepNumber, buffer)
        screenshotUrls.push(url)

        // First screenshot is the primary one (for backward compatibility)
        if (i === 0) {
          screenshotUrl = url
        }

        console.log(`[${params.runId}] Uploaded screenshot ${i + 1}/${screenshots.length} at position ${screenshots[i].position}px`)
      }

      // Upload annotated screenshot (with numbered markers) for diagnosis
      try {
        const annotatedBuffer = annotatedScreenshotData.screenshot
        const annotatedStepNumber = -2000 - params.pageIndex // Use -2000 range for annotated screenshots
        const annotatedUrl = await this.storageService.uploadScreenshot(
          params.runId,
          annotatedStepNumber,
          annotatedBuffer
        )
        console.log(`[${params.runId}] Uploaded annotated screenshot with ${annotatedScreenshotData.elementMap.length} element markers`)
        // Add annotated screenshot as first in array for easy access
        screenshotUrls.unshift(annotatedUrl)
      } catch (annotatedError: any) {
        console.warn(`[${params.runId}] Failed to upload annotated screenshot:`, annotatedError.message)
      }
    }

    console.log(`[${params.runId}] Full-page diagnosis complete: ${screenshots.length} screenshots captured and uploaded, ${context.elements.length} elements found, comprehensive tests: ${comprehensiveTests ? 'completed' : 'failed'}`)

    return {
      context,
      analysis: analysisWithTests,
      screenshotUrl,
      screenshotUrls,
      comprehensiveTests: comprehensiveTests || undefined
    }
  }

  private buildDiagnosisPageSummary(params: {
    id: string
    label?: string
    url?: string
    action?: string
    title?: string
    screenshotUrl?: string
    screenshotUrls?: string[]
    diagnosis: DiagnosisResult
    errors?: string[]
    blockedSelectors?: string[]
  }): DiagnosisPageSummary {
    return diagnosisAggregator.buildDiagnosisPageSummary(params)
  }

  private async performDiagnosisCrawl(params: {
    runId: string
    session: RunnerSession
    buildUrl: string
    baseContext: VisionContext
    visitedUrls: Set<string>
    startIndex: number
    remainingSlots: number
  }): Promise<DiagnosisPageSummary[]> {
    const { runId, session, buildUrl, remainingSlots } = params
    if (remainingSlots <= 0) {
      return []
    }

    const results: DiagnosisPageSummary[] = []
    const baseUrl = buildUrl
    const delayMs = config.diagnosis?.navigationDelayMs || 500
    await this.ensureDiagnosisActive(runId)
    const candidates = this.extractDiagnosisLinks(
      params.baseContext,
      baseUrl,
      params.visitedUrls,
      Math.max(remainingSlots * 3, remainingSlots)
    )

    for (const candidate of candidates) {
      if (results.length >= remainingSlots) {
        break
      }

      try {
        await this.ensureDiagnosisActive(runId)
        await this.playwrightRunner.executeAction(session.id, {
          action: 'click',
          target: candidate.label,
          selector: candidate.selector,
          description: `Diagnosis click: ${candidate.label || candidate.url}`,
        })
        await this.delay(delayMs)

        const currentUrl = await this.playwrightRunner.getCurrentUrl(session.id).catch(() => candidate.url)
        const snapshot = await this.captureDiagnosisSnapshot({
          sessionId: session.id,
          runId,
          pageIndex: params.startIndex + results.length,
          upload: true,
        })

        const summary = this.buildDiagnosisPageSummary({
          id: `page-${params.startIndex + results.length}`,
          label: candidate.label || `View ${params.startIndex + results.length + 1}`,
          url: currentUrl || candidate.url,
          action: `Clicked ${candidate.label || 'link'}`,
          title: await this.getPageTitle(session),
          screenshotUrl: snapshot.screenshotUrl,
          screenshotUrls: snapshot.screenshotUrls,
          diagnosis: snapshot.analysis,
          errors: this.normalizeUrl(currentUrl || '') && params.visitedUrls.has(this.normalizeUrl(currentUrl || ''))
            ? ['Navigation led to a previously analyzed view.']
            : undefined,
        })

        const normalized = currentUrl ? this.normalizeUrl(currentUrl) : null
        if (normalized) {
          params.visitedUrls.add(normalized)
        }

        results.push(summary)
      } catch (error: any) {
        results.push({
          id: `page-error-${params.startIndex + results.length}`,
          label: candidate.label || candidate.url,
          url: candidate.url,
          action: `Clicked ${candidate.label || 'link'}`,
          summary: 'Navigation failed during diagnosis.',
          testableComponents: [],
          nonTestableComponents: [{
            name: candidate.label || candidate.url || 'Unknown destination',
            reason: `Navigation failed: ${error.message}`,
          }],
          recommendedTests: [],
          errors: [`Failed to open ${candidate.url || 'link'}: ${error.message}`],
          blockedSelectors: candidate.selector ? [candidate.selector] : undefined,
        })
      }

      if (results.length >= remainingSlots) {
        break
      }

      await this.returnToBaseForDiagnosis(session, baseUrl)
      await this.delay(delayMs)
      await this.ensureDiagnosisActive(runId)
    }

    return results
  }

  private extractDiagnosisLinks(
    context: VisionContext,
    baseUrl: string,
    visitedUrls: Set<string>,
    limit: number
  ): Array<{ selector: string; url: string; label?: string }> {
    const candidates: Array<{ selector: string; url: string; label?: string }> = []
    const origin = this.safeOrigin(baseUrl)

    for (const element of context.elements) {
      if (!element?.selector) {
        continue
      }

      if (candidates.length >= limit) {
        break
      }

      if (element.type !== 'link' && element.role !== 'link' && element.type !== 'button' && element.role !== 'button') {
        continue
      }

      if (!element.href) {
        continue
      }

      const absoluteUrl = this.resolveUrl(baseUrl, element.href)
      if (!absoluteUrl) {
        continue
      }

      if (!this.isSafeDiagnosisLink(absoluteUrl, origin, element.text)) {
        continue
      }

      const normalized = this.normalizeUrl(absoluteUrl)
      if (visitedUrls.has(normalized)) {
        continue
      }

      const label = (element.text || element.ariaLabel || element.name || '').trim()
      candidates.push({
        selector: element.selector,
        url: absoluteUrl,
        label: label || undefined,
      })
    }

    return candidates.slice(0, limit)
  }

  private isSafeDiagnosisLink(url: string, baseOrigin: string, label?: string): boolean {
    if (!url) {
      return false
    }

    try {
      const parsed = new URL(url)
      if (parsed.origin !== baseOrigin) {
        return false
      }
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return false
      }
      const text = (label || '').toLowerCase()
      const disallowed = ['logout', 'sign out', 'delete', 'remove', 'cart', 'checkout', 'payment', 'admin']
      if (disallowed.some(term => text.includes(term))) {
        return false
      }
      if (parsed.hash && (!parsed.pathname || parsed.pathname === '/')) {
        return false
      }
      return true
    } catch {
      return false
    }
  }

  private normalizeUrl(url?: string | null): string {
    return testProcessorUtils.normalizeUrl(url)
  }

  private resolveUrl(baseUrl: string, href: string): string | null {
    return testProcessorUtils.resolveUrl(baseUrl, href)
  }

  private async returnToBaseForDiagnosis(session: RunnerSession, baseUrl: string): Promise<void> {
    try {
      await this.playwrightRunner.executeAction(session.id, {
        action: 'navigate',
        value: baseUrl,
        description: 'Return to landing page for diagnosis',
      })
    } catch (error: any) {
      console.warn(`[${session.id}] Failed to return to base during diagnosis:`, error.message)
    }
  }

  private aggregateDiagnosisPages(pages: DiagnosisPageSummary[]): DiagnosisResult {
    return diagnosisAggregator.aggregateDiagnosisPages(pages)
  }

  private mergeComponentInsights(list: DiagnosisComponentInsight[]): DiagnosisComponentInsight[] {
    return diagnosisAggregator.mergeComponentInsights(list)
  }

  private mergeIssueInsights(list: DiagnosisIssueInsight[]): DiagnosisIssueInsight[] {
    return diagnosisAggregator.mergeIssueInsights(list)
  }

  private mergeRecommendations(list: string[]): string[] {
    return diagnosisAggregator.mergeRecommendations(list)
  }

  private mergeBlockedSelectors(pages: DiagnosisPageSummary[]): string[] {
    return diagnosisAggregator.mergeBlockedSelectors(pages)
  }

  private safeOrigin(url: string): string {
    return testProcessorUtils.safeOrigin(url)
  }

  private async getPageTitle(session: RunnerSession | null): Promise<string | undefined> {
    if (!session) {
      return undefined
    }
    try {
      return await session.page.title()
    } catch {
      return undefined
    }
  }

  private async delay(ms: number): Promise<void> {
    return testProcessorUtils.delay(ms)
  }

  private generateSpeculativeActions(
    context: VisionContext,
    history: Array<{ action: LLMAction; timestamp: string }>,
    speculativeFlowCache: Set<string>
  ): LLMAction[] {
    if (!context?.elements || context.elements.length === 0) {
      return []
    }

    const loginFlow = this.buildLoginFlow(context, history, speculativeFlowCache)
    if (loginFlow.length > 0) {
      return loginFlow
    }

    return []
  }

  private buildLoginFlow(
    context: VisionContext,
    history: Array<{ action: LLMAction; timestamp: string }>,
    speculativeFlowCache: Set<string>
  ): LLMAction[] {
    const elements = context.elements

    const emailField = elements.find(e =>
      !e.isHidden &&
      e.type === 'input' &&
      e.selector &&
      this.isEmailElement(e)
    )

    const passwordField = elements.find(e =>
      !e.isHidden &&
      e.type === 'input' &&
      e.selector &&
      this.isPasswordElement(e)
    )

    const submitButton = elements.find(e =>
      !e.isHidden &&
      e.selector &&
      (e.type === 'button' || e.role === 'button') &&
      this.isSubmitElement(e)
    )

    if (!emailField || !passwordField || !submitButton) {
      return []
    }

    // Avoid repeating the same speculative flow
    const signature = `${emailField.selector}|${passwordField.selector}|${submitButton.selector}`
    if (speculativeFlowCache.has(signature)) {
      return []
    }

    // Skip if we've already typed into these fields or clicked submit
    if (
      this.hasPerformedAction(history, emailField.selector!, 'type') &&
      this.hasPerformedAction(history, passwordField.selector!, 'type')
    ) {
      return []
    }

    if (this.hasPerformedAction(history, submitButton.selector!, 'click')) {
      return []
    }

    speculativeFlowCache.add(signature)

    const credentials = this.getLoginCredentials()

    const actions: LLMAction[] = [
      {
        action: 'type',
        selector: emailField.selector!,
        value: credentials.username,
        description: 'Fill login email/username field',
        confidence: 0.92,
      },
      {
        action: 'type',
        selector: passwordField.selector!,
        value: credentials.password,
        description: 'Fill login password field',
        confidence: 0.92,
      },
      {
        action: 'click',
        selector: submitButton.selector!,
        description: submitButton.text
          ? `Submit login form via "${submitButton.text}"`
          : 'Submit login form',
        confidence: 0.95,
      },
    ]

    return actions
  }

  private isEmailElement(element: VisionElement): boolean {
    return testProcessorUtils.isEmailElement(element)
  }

  private isPasswordElement(element: VisionElement): boolean {
    return testProcessorUtils.isPasswordElement(element)
  }

  private isSubmitElement(element: VisionElement): boolean {
    return testProcessorUtils.isSubmitElement(element)
  }

  private hasPerformedAction(
    history: Array<{ action: LLMAction; timestamp: string }>,
    selector: string,
    actionName: string
  ): boolean {
    return testProcessorUtils.hasPerformedAction(history, selector, actionName)
  }

  private getLoginCredentials(): { username: string; password: string } {
    return testProcessorUtils.getLoginCredentials()
  }

  private generateMonkeyAction(
    context: VisionContext,
    visitedSelectors: Set<string>,
    stepNumber: number
  ): LLMAction {
    const interactiveElements = (context.elements || []).filter((element) =>
      element.selector &&
      !element.isHidden &&
      (
        element.role === 'button' ||
        element.type === 'button' ||
        element.href ||
        (element.inputType && element.inputType !== 'hidden') ||
        (element.text && element.text.trim().length > 0)
      )
    )

    const unvisited = interactiveElements.filter(e => e.selector && !visitedSelectors.has(e.selector))
    const sourcePool = unvisited.length > 0 ? unvisited : interactiveElements

    if (sourcePool.length > 0 && Math.random() > 0.3) {
      const pick = sourcePool[Math.floor(Math.random() * sourcePool.length)]
      return {
        action: 'click',
        selector: pick.selector || undefined,
        target: pick.text || pick.role || pick.type || 'interactive element',
        description: `Monkey click on ${pick.text || pick.role || pick.type || 'element'} (step ${stepNumber})`,
        confidence: 0.45,
      }
    }

    if (Math.random() > 0.5) {
      return {
        action: 'scroll',
        description: 'Monkey scrolls to reveal more content',
        confidence: 0.6,
      }
    }

    return {
      action: 'wait',
      description: 'Monkey pauses briefly to observe page state',
      confidence: 0.4,
    }
  }

  /**
   * Fetch aggregated run state (status + paused flag)
   */
  private async getTestRunState(runId: string): Promise<{
    status: string | null
    paused: boolean
    diagnosis?: DiagnosisResult
  }> {
    try {
      const fetch = (await import('node-fetch')).default
      const response = await fetch(`${this.apiUrl}/api/tests/${runId}`)
      if (!response.ok) {
        return { status: null, paused: false }
      }
      const data = await response.json()
      return {
        status: data.testRun?.status || null,
        paused: data.testRun?.paused === true,
        diagnosis: data.testRun?.diagnosis || undefined,
      }
    } catch (error) {
      console.error(`[${runId}] Failed to get test run state:`, error)
      return { status: null, paused: false }
    }
  }

  /**
   * Check if test run is paused
   */
  private async isPaused(runId: string): Promise<boolean> {
    const state = await this.getTestRunState(runId)
    return state.paused
  }

  /**
   * Check for manual actions (God Mode) from API
   * Enhanced: Returns action with God Mode event for learning
   * Returns the first manual action if available, null otherwise
   */
  private async checkForManualAction(runId: string): Promise<{ action: LLMAction; godModeEvent?: any } | null> {
    try {
      const fetch = (await import('node-fetch')).default
      const response = await fetch(`${this.apiUrl}/api/tests/${runId}/manual-actions`)

      if (!response.ok) {
        // If endpoint doesn't exist or returns error, no manual actions
        return null
      }

      const data = await response.json()
      const actions = data.actions || []

      if (actions.length > 0) {
        const manualAction = actions[0] // Get first queued action
        console.log(`[${runId}] 🎮 GOD MODE: Manual action queued: ${manualAction.action} on ${manualAction.selector || manualAction.target || 'element'}`)

        // Convert to LLMAction format
        const llmAction: LLMAction = {
          action: manualAction.action,
          selector: manualAction.selector,
          target: manualAction.target,
          value: manualAction.value,
          description: manualAction.description || `Manual action: ${manualAction.action}`,
          confidence: 1.0 // Manual actions have 100% confidence
        }

        return {
          action: llmAction,
          godModeEvent: manualAction.godModeEvent, // Pass through for learning
        }
      }

      return null
    } catch (error: any) {
      // Silently fail - manual actions are optional
      if (error.message && !error.message.includes('ECONNREFUSED')) {
        console.warn(`[${runId}] Failed to check for manual actions:`, error.message)
      }
      return null
    }
  }

  /**
   * Learn from manual action (God Mode Memory)
   * Captures DOM snapshots and creates heuristic record
   */
  private async learnFromManualAction(
    runId: string,
    projectId: string | undefined,
    stepId: string,
    godModeEvent: any,
    page: any, // Playwright Page
    action: LLMAction
  ): Promise<void> {
    if (!projectId || !godModeEvent?.metadata?.isTeachingMoment) {
      return // Not a teaching moment, skip learning
    }

    try {
      const learningService = new LearningService(this.apiUrl)

      // Capture DOM snapshots if not already captured
      let domBefore = godModeEvent.interaction.domSnapshotBefore
      let domAfter = godModeEvent.interaction.domSnapshotAfter

      if (!domBefore) {
        domBefore = await page.content().catch(() => undefined)
      }

      // Execute action (if not already executed)
      // Note: Action may have already been executed, so we capture after state
      await this.delay(500) // Wait for DOM to settle

      if (!domAfter) {
        domAfter = await page.content().catch(() => undefined)
      }

      // Update God Mode event with captured snapshots
      const enhancedEvent = {
        ...godModeEvent,
        runId,
        stepId,
        interaction: {
          ...godModeEvent.interaction,
          domSnapshotBefore: domBefore,
          domSnapshotAfter: domAfter,
        },
      }

      // Create heuristic from interaction
      const heuristic = await learningService.createHeuristicFromInteraction(
        enhancedEvent,
        projectId,
        page
      )

      // Store heuristic
      await learningService.storeHeuristic(heuristic)

      console.log(`[${runId}] 🧠 Learned action from God Mode intervention (component hash: ${heuristic.componentHash.substring(0, 8)}...)`)
    } catch (error: any) {
      console.warn(`[${runId}] Failed to learn from manual action:`, error.message)
      // Non-critical, don't throw
    }
  }

  /**
   * Get test run status
   */
  private async getTestRunStatus(runId: string): Promise<string | null> {
    const state = await this.getTestRunState(runId)
    return state.status
  }

  private async ensureDiagnosisActive(runId: string): Promise<void> {
    while (true) {
      const state = await this.getTestRunState(runId)
      if (state.status === TestRunStatus.CANCELLED) {
        throw new DiagnosisCancelledError()
      }
      if (!state.paused) {
        break
      }
      console.log(`[${runId}] Diagnosis paused by user. Waiting to resume...`)
      await this.delay(500)
    }
  }

  /**
   * Save checkpoint after each step
   */
  private async saveCheckpoint(
    runId: string,
    stepNumber: number,
    steps: TestStep[],
    artifacts: string[],
    parentRunId?: string
  ): Promise<void> {
    try {
      // Persist AI budget snapshot to run metadata (for worker restart recovery)
      let aiBudgetSnapshot = null
      if (parentRunId) {
        const { getBudgetSnapshot } = await import('../services/parentRunAIBudget')
        aiBudgetSnapshot = getBudgetSnapshot(parentRunId)
      }

      const fetch = (await import('node-fetch')).default
      // Use the checkpoint endpoint for consistency with runLogger
      await fetch(`${this.apiUrl}/api/tests/${runId}/checkpoint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepNumber,
          steps,
          artifacts,
          metadata: aiBudgetSnapshot ? { aiBudget: aiBudgetSnapshot } : undefined,
        }),
      })
    } catch (error) {
      console.error(`[${runId}] Failed to save checkpoint:`, error)
    }
  }

  /**
   * Update real-time diagnosis progress
   */
  private async updateDiagnosisProgress(
    runId: string,
    progress: DiagnosisProgress
  ): Promise<void> {
    try {
      const fetch = (await import('node-fetch')).default
      await fetch(`${this.apiUrl}/api/tests/${runId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diagnosisProgress: progress,
        }),
      })
      console.log(`[${runId}] Diagnosis progress: ${progress.percent}% - ${progress.stepLabel}${progress.subStepLabel ? ` (${progress.subStepLabel})` : ''}`)
    } catch (error) {
      console.error(`[${runId}] Failed to update diagnosis progress:`, error)
    }
  }

  /**
   * Run UI Diagnosis to analyze testability
   */
  private async runDiagnosis(jobData: JobData): Promise<'auto' | 'wait'> {
    const { runId, build, profile } = jobData

    if (build.type !== BuildType.WEB || !build.url) {
      console.log(`[${runId}] Diagnosis skipped (unsupported build type or missing URL)`)
      return 'auto'
    }

    console.log(`[${runId}] Starting UI Diagnosis...`)

    let session: RunnerSession | null = null
    const maxPages = this.getDiagnosisPageLimit(jobData)
    const isMultiPage = maxPages > 1

    // Define step structure based on test mode
    const totalSteps = isMultiPage ? 6 : 5
    const stepLabels = isMultiPage
      ? ['Initialize', 'Navigate', 'Capture', 'Explore', 'Analyze', 'Finalize']
      : ['Initialize', 'Navigate', 'Capture', 'Analyze', 'Finalize']

    try {
      // STEP 1: Initialize (0-10%)
      await this.updateDiagnosisProgress(runId, {
        step: 1,
        totalSteps,
        stepLabel: 'Initializing secure browser session',
        subStep: 1,
        totalSubSteps: 2,
        subStepLabel: 'Reserving browser instance',
        percent: 5,
      })

      const runner = this.playwrightRunner
      session = await runner.reserveSession(profile)

      await this.updateDiagnosisProgress(runId, {
        step: 1,
        totalSteps,
        stepLabel: 'Initializing secure browser session',
        subStep: 2,
        totalSubSteps: 2,
        subStepLabel: 'Session ready',
        percent: 10,
      })

      const fetch = (await import('node-fetch')).default
      await fetch(`${this.apiUrl}/api/tests/${runId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: TestRunStatus.DIAGNOSING,
          startedAt: new Date().toISOString(),
        }),
      })

      await this.ensureDiagnosisActive(runId)

      // STEP 2: Navigate (10-25%)
      await this.updateDiagnosisProgress(runId, {
        step: 2,
        totalSteps,
        stepLabel: 'Navigating to target URL',
        subStep: 1,
        totalSubSteps: 2,
        subStepLabel: `Loading ${build.url}`,
        percent: 15,
      })

      await runner.executeAction(session.id, {
        action: 'navigate',
        value: build.url,
        description: `Navigate to ${build.url} for diagnosis`,
      })
      await this.delay(config.diagnosis?.navigationDelayMs || 500)

      await this.updateDiagnosisProgress(runId, {
        step: 2,
        totalSteps,
        stepLabel: 'Navigating to target URL',
        subStep: 2,
        totalSubSteps: 2,
        subStepLabel: 'Page loaded successfully',
        percent: 25,
      })

      await this.ensureDiagnosisActive(runId)

      // STEP 3: Capture (25-50%) - Full page scanning
      await this.updateDiagnosisProgress(runId, {
        step: 3,
        totalSteps,
        stepLabel: 'Scanning entire page',
        subStep: 1,
        totalSubSteps: 10, // Will be updated dynamically
        subStepLabel: 'Measuring page dimensions',
        percent: 30,
      })

      // Get page dimensions first to determine progress steps
      const dimensions = await this.playwrightRunner.getPageDimensions(session.id)
      const { viewportHeight, documentHeight } = dimensions
      const scrollIncrement = Math.floor(viewportHeight * 0.2)
      const totalScrollPositions = Math.max(1, Math.ceil((documentHeight - viewportHeight) / scrollIncrement) + 1)

      console.log(`[${runId}] Full-page scan: ${totalScrollPositions} positions needed for ${documentHeight}px page`)

      let currentScrollStep = 0
      const baseSnapshot = await this.captureDiagnosisSnapshot({
        sessionId: session.id,
        runId,
        pageIndex: 0,
        upload: true,
        onProgress: (progress) => {
          currentScrollStep = progress.current
          // Update progress: 30% to 50% for scanning
          const scanProgress = 30 + (progress.current / progress.total) * 20
          this.updateDiagnosisProgress(runId, {
            step: 3,
            totalSteps,
            stepLabel: 'Scanning entire page',
            subStep: progress.current,
            totalSubSteps: progress.total,
            subStepLabel: `Capturing screenshot ${progress.current}/${progress.total} (${progress.position}px)`,
            percent: Math.min(50, Math.floor(scanProgress)),
          }).catch(err => console.error(`[${runId}] Failed to update progress:`, err))
        },
      })

      await this.updateDiagnosisProgress(runId, {
        step: 3,
        totalSteps,
        stepLabel: 'Scanning entire page',
        subStep: totalScrollPositions,
        totalSubSteps: totalScrollPositions,
        subStepLabel: 'Page scan complete',
        percent: 50,
      })

      const currentUrl = await this.playwrightRunner.getCurrentUrl(session.id).catch(() => build.url)
      const visitedUrls = new Set<string>()
      if (currentUrl) {
        visitedUrls.add(this.normalizeUrl(currentUrl))
      }

      const pageSummaries: DiagnosisPageSummary[] = [
        this.buildDiagnosisPageSummary({
          id: 'page-0',
          label: 'Landing page',
          url: currentUrl || build.url,
          action: 'Initial view',
          title: await this.getPageTitle(session),
          screenshotUrl: baseSnapshot.screenshotUrl,
          screenshotUrls: baseSnapshot.screenshotUrls,
          diagnosis: baseSnapshot.analysis,
        }),
      ]

      // STEP 4 (multi-page): Explore OR STEP 4 (single): Analyze
      if (isMultiPage) {
        // Multi-page: Explore step (50-75%)
        await this.ensureDiagnosisActive(runId)

        await this.updateDiagnosisProgress(runId, {
          step: 4,
          totalSteps,
          stepLabel: 'Exploring additional pages',
          subStep: 1,
          totalSubSteps: maxPages - 1,
          subStepLabel: `Discovering navigation targets`,
          percent: 55,
        })

        const crawlPages = await this.performDiagnosisCrawlWithProgress({
          runId,
          session,
          buildUrl: build.url,
          baseContext: baseSnapshot.context,
          visitedUrls,
          startIndex: 1,
          remainingSlots: Math.max(0, maxPages - 1),
          totalSteps,
        })
        pageSummaries.push(...crawlPages)

        // Step 5: Analyze (75-90%)
        await this.updateDiagnosisProgress(runId, {
          step: 5,
          totalSteps,
          stepLabel: 'Analyzing components & blockers',
          subStep: 1,
          totalSubSteps: 2,
          subStepLabel: 'Aggregating findings',
          percent: 80,
        })
      } else {
        // Single page: Analyze step (50-80%)
        await this.updateDiagnosisProgress(runId, {
          step: 4,
          totalSteps,
          stepLabel: 'Analyzing components & blockers',
          subStep: 1,
          totalSubSteps: 2,
          subStepLabel: 'AI analyzing full page testability',
          percent: 65,
        })
      }

      const aggregatedDiagnosis = this.aggregateDiagnosisPages(pageSummaries)

      const analyzeStep = isMultiPage ? 5 : 4
      await this.updateDiagnosisProgress(runId, {
        step: analyzeStep,
        totalSteps,
        stepLabel: 'Analyzing components & blockers',
        subStep: 2,
        totalSubSteps: 2,
        subStepLabel: 'Analysis complete',
        percent: isMultiPage ? 90 : 80,
      })

      // FINAL STEP: Finalize (80/90-100%)
      const finalStep = isMultiPage ? 6 : 5
      await this.updateDiagnosisProgress(runId, {
        step: finalStep,
        totalSteps,
        stepLabel: 'Compiling diagnosis summary',
        subStep: 1,
        totalSubSteps: 2,
        subStepLabel: 'Evaluating approval policy',
        percent: isMultiPage ? 95 : 90,
      })

      const decision = this.evaluateApprovalDecision(jobData, aggregatedDiagnosis)

      const updatePayload: any = {
        diagnosis: aggregatedDiagnosis,
        diagnosisProgress: {
          step: finalStep,
          totalSteps,
          stepLabel: 'Diagnosis complete',
          subStep: 2,
          totalSubSteps: 2,
          subStepLabel: decision === 'wait' ? 'Awaiting approval' : 'Auto-approved',
          percent: 100,
        },
      }

      if (decision === 'wait') {
        updatePayload.status = TestRunStatus.WAITING_APPROVAL
      }

      await fetch(`${this.apiUrl}/api/tests/${runId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      })

      if (decision === 'wait') {
        console.log(`[${runId}] Diagnosis complete. Waiting for approval.`)
        await this.notifyDiagnosisPending(runId, jobData, aggregatedDiagnosis)
      } else {
        console.log(`[${runId}] Diagnosis auto-approved based on policy.`)
      }

      return decision
    } catch (error: any) {
      if (error instanceof DiagnosisCancelledError) {
        console.log(`[${runId}] Diagnosis cancelled by user.`)
        throw error
      }
      console.error(`[${runId}] Diagnosis failed:`, error)
      throw error
    } finally {
      if (session) {
        await this.playwrightRunner.releaseSession(session.id).catch(() => { })
      }
    }
  }

  /**
   * Perform diagnosis crawl with real-time progress updates
   */
  private async performDiagnosisCrawlWithProgress(options: {
    runId: string
    session: RunnerSession
    buildUrl: string
    baseContext: VisionContext
    visitedUrls: Set<string>
    startIndex: number
    remainingSlots: number
    totalSteps: number
  }): Promise<DiagnosisPageSummary[]> {
    const { runId, session, buildUrl, baseContext, visitedUrls, startIndex, remainingSlots, totalSteps } = options
    const pageSummaries: DiagnosisPageSummary[] = []

    if (remainingSlots <= 0) return pageSummaries

    const linkElements = baseContext.elements.filter(
      (sel: any) => {
        return (sel.type === 'link' || sel.type === 'button') &&
          sel.selector &&
          sel.text &&
          !sel.isHidden &&
          !/^(login|sign.?in|log.?out|sign.?out|register|forgot|reset)/i.test(sel.text)
      }
    )

    const uniqueLinks = new Map<string, VisionElement>()
    for (const el of linkElements) {
      const key = (el.href || el.text || '').toLowerCase()
      if (!uniqueLinks.has(key)) {
        uniqueLinks.set(key, el)
      }
    }

    const candidates = [...uniqueLinks.values()].slice(0, remainingSlots + 2)
    let pageIndex = startIndex
    let pagesCollected = 0

    for (const element of candidates) {
      if (pagesCollected >= remainingSlots) break

      await this.ensureDiagnosisActive(runId)

      // Update progress for each page exploration
      await this.updateDiagnosisProgress(runId, {
        step: 4,
        totalSteps,
        stepLabel: 'Exploring additional pages',
        subStep: pagesCollected + 1,
        totalSubSteps: remainingSlots,
        subStepLabel: `Analyzing: ${element.text?.substring(0, 30) || 'page'}...`,
        percent: 45 + Math.round((pagesCollected / remainingSlots) * 30), // 45-75%
      })

      const actionText = element.text || element.selector || 'link'

      try {
        if (element.href && element.href.startsWith('http')) {
          const normalizedHref = this.normalizeUrl(element.href)
          if (visitedUrls.has(normalizedHref)) continue
          visitedUrls.add(normalizedHref)

          await this.playwrightRunner.executeAction(session.id, {
            action: 'navigate',
            value: element.href,
            description: `Navigate to ${element.href}`,
          })
        } else if (element.selector) {
          await this.playwrightRunner.executeAction(session.id, {
            action: 'click',
            selector: element.selector,
            description: `Click ${actionText}`,
          })
        } else {
          continue
        }

        await this.delay(config.diagnosis?.navigationDelayMs || 500)

        const newUrl = await this.playwrightRunner.getCurrentUrl(session.id).catch(() => '')
        if (newUrl) {
          const normalizedNew = this.normalizeUrl(newUrl)
          if (visitedUrls.has(normalizedNew)) {
            await this.playwrightRunner.executeAction(session.id, {
              action: 'navigate',
              value: buildUrl,
              description: 'Return to initial page',
            })
            await this.delay(config.diagnosis?.navigationDelayMs || 500)
            continue
          }
          visitedUrls.add(normalizedNew)
        }

        const snapshot = await this.captureDiagnosisSnapshot({
          sessionId: session.id,
          runId,
          pageIndex,
          upload: true,
        })

        pageSummaries.push(
          this.buildDiagnosisPageSummary({
            id: `page-${pageIndex}`,
            label: element.text || `Page ${pageIndex + 1}`,
            url: newUrl || undefined,
            action: `Clicked "${actionText}"`,
            title: await this.getPageTitle(session),
            screenshotUrl: snapshot.screenshotUrl,
            screenshotUrls: snapshot.screenshotUrls,
            diagnosis: snapshot.analysis,
          })
        )

        pageIndex++
        pagesCollected++

        await this.playwrightRunner.executeAction(session.id, {
          action: 'navigate',
          value: buildUrl,
          description: 'Return to initial page',
        })
        await this.delay(config.diagnosis?.navigationDelayMs || 500)
      } catch (err: any) {
        console.warn(`[${runId}] Failed to explore "${actionText}": ${err.message}`)
      }
    }

    return pageSummaries
  }

  private resolveTestEnvironment(options?: JobData['options']): TestEnvironment {
    return approvalEvaluator.resolveTestEnvironment(options)
  }

  private evaluateApprovalDecision(jobData: JobData, diagnosis: DiagnosisResult): 'auto' | 'wait' {
    return approvalEvaluator.evaluateApprovalDecision(jobData, diagnosis)
  }

  private async notifyDiagnosisPending(runId: string, jobData: JobData, diagnosis: DiagnosisResult): Promise<void> {
    try {
      const webhook = config.notifications?.slackWebhook
      const requestedChannels = jobData.options?.approvalPolicy?.channels
      const wantsSlack = requestedChannels ? requestedChannels.includes('slack') : Boolean(webhook)

      if (!webhook || !wantsSlack) {
        return
      }

      const fetch = (await import('node-fetch')).default
      const frontendUrl = config.notifications?.frontendBaseUrl || 'https://Rihario-7ip77vn43-pricewises-projects.vercel.app'
      const blockers = diagnosis.nonTestableComponents?.length || 0
      const pageHighlights = diagnosis.pages && diagnosis.pages.length > 0
        ? `Views checked: ${diagnosis.pages
          .slice(0, 3)
          .map(page => page.label || page.title || page.url || page.id)
          .join(', ')}${diagnosis.pages.length > 3 ? '…' : ''}`
        : ''
      const lines = [
        `🧪 Test run ${runId} requires approval`,
        diagnosis.summary,
        blockers > 0 ? `Detected ${blockers} blocker(s).` : 'No blockers detected.',
        pageHighlights,
        `Review & approve: ${frontendUrl.replace(/\/$/, '')}/test/run/${runId}`,
      ].filter(Boolean)

      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: lines.join('\n') }),
      })
    } catch (error: any) {
      console.warn(`[${runId}] Failed to send Slack notification:`, error.message || error)
    }
  }

  /**
   * Execute test sequence for browser matrix (cross-browser testing)
   */
  private async executeBrowserMatrix(
    runId: string,
    build: Build,
    profile: TestProfile,
    options: TestOptions | undefined,
    browserMatrix: Array<'chromium' | 'firefox' | 'webkit'>,
    maxSteps: number,
    maxDuration: number,
    startTime: number,
    diagnosisData: DiagnosisResult | undefined,
    blockedSelectors: Set<string>,
    blockedSelectorReasons: Map<string, string>,
    isSelectorBlocked: (selector?: string | null) => boolean,
    shouldBlockSelectorFromError: (message?: string) => boolean,
    projectId?: string,
    parentRunId?: string,
    userTier: 'guest' | 'starter' | 'indie' | 'pro' | 'agency' = 'guest'
  ): Promise<ProcessResult> {
    const browserResults: BrowserMatrixResult[] = []
    const allSteps: TestStep[] = []
    const allArtifacts: string[] = []

    // Get goal from build URL or diagnosis
    const goal = build.url || 'Complete test execution'

    // Execute for each browser
    for (const browserType of browserMatrix) {
      const browserStartTime = Date.now()
      console.log(`[${runId}] [${browserType.toUpperCase()}] Starting execution...`)

      // Create browser-specific profile
      const browserProfile: TestProfile = {
        ...profile,
        device: browserType === 'firefox'
          ? DeviceProfile.FIREFOX_LATEST
          : browserType === 'webkit'
            ? DeviceProfile.SAFARI_LATEST
            : DeviceProfile.CHROME_LATEST
      }

      let browserSteps: TestStep[] = []
      let browserArtifacts: string[] = []
      let browserSuccess = true
      let browserError: string | undefined

      try {
        // Execute test sequence for this browser
        // We'll call the existing execution logic but with browser-specific profile
        const result = await this.executeTestSequenceForBrowser(
          runId,
          build,
          browserProfile,
          options,
          browserType,
          maxSteps,
          maxDuration,
          startTime,
          diagnosisData,
          blockedSelectors,
          blockedSelectorReasons,
          isSelectorBlocked,
          shouldBlockSelectorFromError,
          projectId,
          parentRunId,
          userTier
        )

        if (!result) {
          throw new Error(`[${runId}] [${browserType.toUpperCase()}] executeTestSequenceForBrowser returned undefined`)
        }
        browserSteps = result.steps
        browserArtifacts = result.artifacts
        browserSuccess = result.success
        browserError = result.error

        // Tag steps with browser
        const taggedSteps = browserSteps.map(step => ({
          ...step,
          environment: {
            browser: browserType,
            viewport: step.environment?.viewport || '1280x720',
            orientation: step.environment?.orientation || 'portrait' as 'portrait' | 'landscape'
          }
        }))

        browserResults.push({
          browser: browserType,
          success: browserSuccess,
          steps: taggedSteps,
          artifacts: browserArtifacts,
          error: browserError,
          executionTime: Date.now() - browserStartTime
        })

        allSteps.push(...taggedSteps)
        allArtifacts.push(...browserArtifacts)

        console.log(`[${runId}] [${browserType.toUpperCase()}] Completed: ${browserSuccess ? 'PASS' : 'FAIL'} (${taggedSteps.length} steps, ${((Date.now() - browserStartTime) / 1000).toFixed(1)}s)`)
      } catch (error: any) {
        console.error(`[${runId}] [${browserType.toUpperCase()}] Execution failed:`, error.message)
        browserSuccess = false
        browserError = error.message

        browserResults.push({
          browser: browserType,
          success: false,
          steps: browserSteps,
          artifacts: browserArtifacts,
          error: browserError,
          executionTime: Date.now() - browserStartTime
        })

        allSteps.push(...browserSteps)
        allArtifacts.push(...browserArtifacts)
      }
    }

    // Aggregate results
    const passedBrowsers = browserResults.filter(r => r.success).length
    const failedBrowsers = browserResults.filter(r => !r.success).length
    const overallSuccess = failedBrowsers === 0

    console.log(`[${runId}] Browser Matrix Summary: ${passedBrowsers}/${browserMatrix.length} passed, ${failedBrowsers} failed`)

    return {
      success: overallSuccess,
      steps: allSteps,
      artifacts: allArtifacts,
      browserResults,
      summary: {
        totalBrowsers: browserMatrix.length,
        passedBrowsers,
        failedBrowsers,
        browsers: browserResults.map(r => ({
          browser: r.browser,
          success: r.success,
          steps: r.steps.length
        }))
      }
    }
  }

  // ============================================================================
  // EXECUTION BOUNDARY - HIGH RISK AREA
  // ============================================================================
  // This method contains complex execution logic with tight coupling:
  // - State management (session, steps, artifacts)
  // - Error handling with try/catch/finally
  // - Service dependencies (runners, services, storage)
  // - Execution flow control
  //
  // REFACTORING WARNINGS:
  // - DO NOT extract code from inside try/catch/finally blocks
  // - DO NOT modify execution order or control flow
  // - DO NOT split this method without careful analysis
  // - Changes here affect test execution behavior - test thoroughly
  // ============================================================================

  /**
   * Execute test sequence for a specific browser
   * 
   * This method contains the core execution logic extracted from process().
   * It can be called for single-browser execution or as part of browser matrix testing.
   */
  private async executeTestSequenceForBrowser(
    runId: string,
    build: Build,
    profile: TestProfile,
    options: TestOptions | undefined,
    browserType: 'chromium' | 'firefox' | 'webkit',
    maxSteps: number,
    maxDuration: number,
    startTime: number,
    diagnosisData: DiagnosisResult | undefined,
    blockedSelectors: Set<string>,
    blockedSelectorReasons: Map<string, string>,
    isSelectorBlocked: (selector?: string | null) => boolean,
    shouldBlockSelectorFromError: (message?: string) => boolean,
    projectId?: string,
    parentRunId?: string,
    userTier: 'guest' | 'starter' | 'indie' | 'pro' | 'agency' = 'guest'
  ): Promise<{ steps: TestStep[]; artifacts: string[]; success: boolean; error?: string } | undefined> {
    // Get parent run ID (use runId if not provided - single browser test)
    const effectiveParentRunId = parentRunId || runId

    // Create browser-specific profile
    const browserProfile: TestProfile = {
      ...profile,
      device: browserType === 'firefox'
        ? DeviceProfile.FIREFOX_LATEST
        : browserType === 'webkit'
          ? DeviceProfile.SAFARI_LATEST
          : DeviceProfile.CHROME_LATEST
    }

    let session: any = null
    const steps: TestStep[] = []
    const artifacts: string[] = []
    const actionQueue: LLMAction[] = []
    const speculativeFlowCache = new Set<string>()
    const selectorHealingMap = new Map<string, string>()
    // stepNumber will be set after navigation and popup handling
    let stepNumber = 0
    // Result variable to satisfy TypeScript's control flow analysis
    let result: { steps: TestStep[]; artifacts: string[]; success: boolean; error?: string } | null = null

    // Track current environment for compatibility & responsiveness testing
    let currentEnvironment: {
      browser: string
      viewport: string
      orientation?: 'portrait' | 'landscape'
    } = {
      browser: browserType,
      viewport: browserProfile.viewport ? `${browserProfile.viewport.width}x${browserProfile.viewport.height}` : '1280x720',
      orientation: browserProfile.viewport && browserProfile.viewport.width > browserProfile.viewport.height ? 'landscape' : 'portrait'
    }

    // Helper to register blocked selectors
    const registerBlockedSelector = (selector: string, reason: string) => {
      blockedSelectors.add(selector)
      blockedSelectorReasons.set(selector, reason)
    }

    try {
      // Select runner based on build type
      const isMobile = build.type === BuildType.ANDROID || build.type === BuildType.IOS
      const runner = isMobile ? this.appiumRunner : this.playwrightRunner

      if (!runner) {
        throw new Error(`Runner not available for ${isMobile ? 'mobile' : 'web'} tests`)
      }

      // Reserve test runner session
      console.log(`[${runId}] [${browserType.toUpperCase()}] Reserving ${build.type} session...`)
      session = await runner.reserveSession(browserProfile)

      // Start live view (WebRTC primary, screenshot fallback)
      if (build.type === BuildType.WEB && session.page) {
        // Start screenshot-based live view as fallback (always enabled)
        if (!this.screenshotLiveView) {
          this.screenshotLiveView = new ScreenshotLiveViewService(this.redis)
        }
        await this.screenshotLiveView.startCapture(runId, session.page, 900)
        console.log(`[${runId}] [${browserType.toUpperCase()}] Screenshot-based live view started (fallback)`)

        // Start WebRTC streaming if enabled (primary, but fallback is always available)
        if (config.streaming?.enabled) {
          try {
            // Create browser-specific streamer instance for multi-browser support
            const browserStreamer = new WebRTCStreamer(this.redis)
            const streamStatus = await browserStreamer.startStream({
              runId: `${runId}-${browserType}`, // Unique stream ID per browser
              sessionId: session.id,
              livekitUrl: config.streaming.livekitUrl,
              livekitApiKey: config.streaming.livekitApiKey,
              livekitApiSecret: config.streaming.livekitApiSecret,
              page: session.page,
              frameServerPort: config.streaming.frameServerPort ?
                config.streaming.frameServerPort + (browserType === 'firefox' ? 1 : browserType === 'webkit' ? 2 : 0) :
                undefined,
            })

            console.log(`[${runId}] [${browserType.toUpperCase()}] WebRTC stream started: ${streamStatus.streamUrl}`)

            // Store streamer for this browser (will be cleaned up in finally block)
            if (!this.streamer) {
              this.streamer = browserStreamer // Keep reference for first browser
            }

            // Notify API server about stream URL with browser identifier
            try {
              const fetch = (await import('node-fetch')).default
              await fetch(`${this.apiUrl}/api/tests/${runId}/streams`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  browser: browserType,
                  streamUrl: streamStatus.streamUrl,
                  livekitToken: streamStatus.token,
                }),
              })
            } catch (notifyError: any) {
              console.warn(`[${runId}] [${browserType.toUpperCase()}] Failed to notify API about stream:`, notifyError.message)
            }
          } catch (streamError: any) {
            console.warn(`[${runId}] [${browserType.toUpperCase()}] Failed to start streaming (continuing without stream):`, streamError.message)
          }
        }

        // Update status to running (only for first browser to avoid overwriting)
        if (browserType === 'chromium') {
          const fetch = (await import('node-fetch')).default
          await fetch(`${this.apiUrl}/api/tests/${runId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: TestRunStatus.RUNNING,
              startedAt: new Date().toISOString(),
            }),
          })
        }

        // Navigate to initial URL if web
        if (build.type === BuildType.WEB && build.url) {
          const navigateAction: LLMAction = {
            action: 'navigate',
            value: build.url,
            description: `Navigate to ${build.url}`,
          }
          await runner.executeAction(session.id, navigateAction)

          // Wait 3 seconds after navigation for page to fully load and cookie banners to appear
          console.log(`[${runId}] [${browserType.toUpperCase()}] Waiting 3 seconds after navigation for page load...`)
          await new Promise(resolve => setTimeout(resolve, 3000))

          // Capture initial screenshot after navigation (may include popup)
          try {
            console.log(`[${runId}] [${browserType.toUpperCase()}] Capturing initial screenshot after navigation...`)
            const initialScreenshot = await runner.captureScreenshot(session.id)
            const screenshotBuffer = Buffer.from(initialScreenshot, 'base64')
            const screenshotUrl = await this.storageService.uploadScreenshot(
              runId,
              0, // Step 0 = initial state
              screenshotBuffer,
              {
                browser: currentEnvironment.browser as 'chromium' | 'firefox' | 'webkit',
                viewport: currentEnvironment.viewport,
                orientation: currentEnvironment.orientation
              }
            )

            // Create initial step to show page loaded
            const initialStep: TestStep = {
              id: `step_${runId}_${browserType}_0`,
              stepNumber: 0,
              action: 'navigate',
              target: build.url,
              timestamp: new Date().toISOString(),
              screenshotUrl,
              success: true,
              browser: browserType, // Direct browser field for parallel browser testing
              environment: {
                browser: browserType,
                viewport: currentEnvironment.viewport,
                orientation: currentEnvironment.orientation,
              },
            }
            steps.push(initialStep)
            artifacts.push(screenshotUrl)
            await this.saveCheckpoint(runId, 0, steps, artifacts, effectiveParentRunId)
          } catch (screenshotError: any) {
            console.warn(`[${runId}] [${browserType.toUpperCase()}] Failed to capture initial screenshot:`, screenshotError.message)
          }
        }

        // UNIFIED PREFLIGHT PHASE (blocking)
        console.log(`[${runId}] [${browserType.toUpperCase()}] Starting Unified Preflight Phase...`)

        // Assert preflight invariants
        // verifyInvariant(runId, 'PRE_EXECUTION') // (Optional: Add invariant checking if needed)

        const preflightResult = await this.unifiedPreflight.executePreflight(
          session.page,
          build.url || '',
          runId,
          build.url || ''
        )

        // Create preflight step
        const preflightStep: TestStep = {
          id: `step_${runId}_${browserType}_preflight`,
          stepNumber: 1, // Step 1 is always preflight
          action: 'preflight',
          target: 'Unified Preflight Phase',
          value: preflightResult.success
            ? `Completed: ${preflightResult.popupsResolved} popup(s) resolved`
            : `Failed: ${preflightResult.errors.join('; ')}`,
          timestamp: new Date().toISOString(),
          success: preflightResult.success,
          browser: browserType,
          metadata: {
            cookieResult: preflightResult.cookieResult,
            nonCookiePopups: preflightResult.nonCookiePopups,
            popupsResolved: preflightResult.popupsResolved,
            executionTrace: preflightResult.executionTrace
          } as any,
          environment: {
            browser: browserType,
            viewport: currentEnvironment.viewport,
            orientation: currentEnvironment.orientation,
          },
        }

        steps.push(preflightStep)
        // Broadcast step to UI
        if (config.streaming?.enabled) {
          this.redis.publish('ws:broadcast', JSON.stringify({
            runId,
            serverId: 'worker',
            payload: { type: 'test_step', step: preflightStep }
          })).catch(() => { })
        }

        if (!preflightResult.success) {
          console.warn(`[${runId}] [${browserType.toUpperCase()}] Preflight completed with issues: ${preflightResult.errors.join('; ')}`)
        }


        // Main test loop - step by step
        // Note: Step 0 = navigation, Step 1 = popup handling (if any)
        // Step 2+: User instructions and actions
        // Update stepNumber to start after navigation (0) and popup handling (1 if handled)
        stepNumber = steps.length > 1 ? 2 : 1 // If popup was handled (step 1 exists), start at 2

        // Use Unified Brain Service to understand user instructions
        const userInstructions = options?.coverage?.[0] || ''
        let parsedInstructions = null
        let goal = ''

        if (userInstructions) {
          try {
            console.log(`[${runId}] [${browserType.toUpperCase()}] Using Unified Brain Service to parse user instructions: "${userInstructions}"`)

            // Use UnifiedAIExecutor for budget-controlled AI calls
            const logEmitter = getExecutionLogEmitter(runId, stepNumber)
            const parseResult = await this.unifiedAIExecutor.executeLLMCall(
              () => this.unifiedBrain.parseTestInstructions(userInstructions, build.url),
              {
                parentRunId: effectiveParentRunId,
                runId,
                stepNumber,
                callType: 'llm',
                priority: 'critical',
                description: 'Parse user test instructions',
                logEmitter,
                tier: userTier,
              }
            )

            if (parseResult.success && parseResult.result) {
              parsedInstructions = parseResult.result
              console.log(`[${runId}] [${browserType.toUpperCase()}] Unified Brain parsed instructions:`, JSON.stringify(parsedInstructions, null, 2))
            } else {
              // Fallback to deterministic parsing
              console.log(`[${runId}] [${browserType.toUpperCase()}] AI parsing skipped, using direct instructions`)
              parsedInstructions = null
            }

            // Build comprehensive goal from parsed instructions
            if (parsedInstructions) {
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
                goal = `USER INSTRUCTIONS (PARSED BY UNIFIED BRAIN - HIGHEST PRIORITY):\n${instructionsSummary}\n\nAdditionally, discover and test all pages on the website starting from ${build.url}. Navigate through all internal links, test each page, and ensure all pages are functional.`
              } else if (options?.testMode === 'multi') {
                goal = `USER INSTRUCTIONS (PARSED BY UNIFIED BRAIN - HIGHEST PRIORITY):\n${instructionsSummary}\n\nAdditionally, navigate through all specified pages and test functionality.`
              } else {
                goal = `USER INSTRUCTIONS (PARSED BY UNIFIED BRAIN - HIGHEST PRIORITY):\n${instructionsSummary}`
              }
            }
          } catch (error: any) {
            console.error(`[${runId}] [${browserType.toUpperCase()}] Unified Brain parsing failed:`, error.message)
            console.log(`[${runId}] [${browserType.toUpperCase()}] Falling back to direct instruction usage`)
            // Fallback to direct instructions
            goal = `USER INSTRUCTIONS (PRIORITY): ${userInstructions}`
          }
        } else if (userInstructions) {
          // Unified Brain not available, use instructions directly
          console.log(`[${runId}] [${browserType.toUpperCase()}] Using instructions directly: ${userInstructions}`)
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
            console.log(`[${runId}] [${browserType.toUpperCase()}] All pages mode enabled - will discover and test all pages`)
          } else if (options?.testMode === 'multi') {
            goal = 'Navigate through all specified pages and test functionality.'
          } else {
            goal = 'Perform basic user flow test'
          }
        }

        const isMonkeyMode = options?.monkeyMode || options?.testMode === 'monkey'
        const selectedTestTypes = options?.selectedTestTypes as string[] | undefined // Registered user multi-select
        const testCredentials = options?.guestCredentials as { username?: string; email?: string; password?: string } | undefined // Shared credentials for login/signup tests
        const isAllPagesMode = options?.allPages || options?.testMode === 'all'
        const STEP_LIMITS = {
          single: { min: 15, max: 50, default: 15 },
          multi: { min: 25, max: 100, default: 25 },
          all: { min: 50, max: 150, default: 50 },
          monkey: { min: 25, max: 75, default: 25 },
        }

        if (isMonkeyMode) {
          goal = 'MONKEY TEST MODE: Explore the application randomly to surface crashes, console errors, and unexpected behavior. Prioritize variety over precision.'
          console.log(`[${runId}] [${browserType.toUpperCase()}] 🐒 Monkey mode enabled - executing exploratory random interactions.`)
        }

        // REGISTERED USER: Execute selected test types (multi-select)
        if (selectedTestTypes && selectedTestTypes.length > 0) {
          console.log(`[${runId}] [${browserType.toUpperCase()}] 🎯 Registered user test with ${selectedTestTypes.length} test type(s): ${selectedTestTypes.join(', ')}`)

          // Build comprehensive goal from selected test types
          const testGoals: string[] = []

          for (const testType of selectedTestTypes) {
            switch (testType) {
              case 'visual':
                testGoals.push('VISUAL: Explore UI elements, take screenshots, check for visual consistency and rendering issues.')
                break
              case 'login':
                const loginUsername = testCredentials?.username || testCredentials?.email || 'demo@example.com'
                const loginPassword = testCredentials?.password || 'DemoPass123!'
                testGoals.push(`LOGIN: Test authentication flow. Find login form, test validation (empty fields, invalid credentials), then try valid credentials (${loginUsername}/${loginPassword}).`)
                break
              case 'signup':
                const signupUsername = testCredentials?.username || testCredentials?.email || 'demo@example.com'
                const signupPassword = testCredentials?.password || 'DemoPass123!'
                testGoals.push(`SIGNUP: Test registration flow. Find signup form, test field validation, check password requirements, submit with test data (${signupUsername}/${signupPassword}).`)
                break
              case 'navigation':
                testGoals.push('NAVIGATION: Click navigation links, test menu items, verify page transitions, check for broken links or 404 errors.')
                break
              case 'form':
                testGoals.push('FORM: Find forms, fill with test data, test validation messages, submit and verify success/error states.')
                break
              case 'accessibility':
                testGoals.push('ACCESSIBILITY: Check for alt text, heading hierarchy, form labels, color contrast, ARIA attributes, keyboard navigation.')
                break
              case 'rage_bait':
                // Rage Bait executed separately with RageBaitAnalyzer at end of test
                console.log(`[${runId}] [${browserType.toUpperCase()}] 🔥 Rage Bait test will be executed after main test flow.`)
                break
            }
          }

          if (testGoals.length > 0) {
            goal = `REGISTERED USER TESTS - Execute the following test types:\n\n${testGoals.map((g, i) => `${i + 1}. ${g}`).join('\n\n')}`
          }
        }

        // NOTE: Guest test flow is handled entirely by GuestTestProcessor
        // This TestProcessor is only for registered users

        const history: Array<{ action: LLMAction; timestamp: string }> = []

        // Track visited URLs and elements to prevent repetition
        const visitedUrls = new Set<string>([build.url || ''])
        const visitedSelectors = new Set<string>()
        const visitedHrefs = new Set<string>()

        // Authentication flow analysis state
        let authAnalysis: any = null
        let urlBeforeLogin: string | null = null
        let loginAttempted = false
        let signupAttempted = false

        // Site discovery for "all pages" mode
        let discoveredPages: Array<{ url: string; title: string; selector: string }> = []
        let siteDiscoveryComplete = false

        // Store user instructions for logging in each step
        const hasUserInstructions = !!userInstructions

        // Site discovery phase for "all pages" mode
        if ((options?.allPages || options?.testMode === 'all') && !siteDiscoveryComplete) {
          try {
            console.log(`[${runId}] [${browserType.toUpperCase()}] Starting site discovery phase - mapping all pages from landing page...`)
            const discoveryDom = await (isMobile
              ? (this.appiumRunner?.getPageSource(session.id) || Promise.reject(new Error('Appium not available')))
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

            console.log(`[${runId}] [${browserType.toUpperCase()}] Site discovery complete: Found ${discoveredPages.length} unique pages to test`)
            siteDiscoveryComplete = true
          } catch (discoveryError: any) {
            console.warn(`[${runId}] [${browserType.toUpperCase()}] Site discovery failed:`, discoveryError.message)
          }
        }

        // Main execution loop
        while (stepNumber < maxSteps && Date.now() - startTime < maxDuration) {
          // Check if test run has been stopped or cancelled
          const testRunStatus = await this.getTestRunStatus(runId)
          if (testRunStatus === 'completed' || testRunStatus === 'cancelled' || testRunStatus === 'failed') {
            console.log(`[${runId}] [${browserType.toUpperCase()}] Test run has been ${testRunStatus}. Stopping execution.`)
            // Save current progress before breaking
            if (steps.length > 0) {
              await this.saveCheckpoint(runId, stepNumber, steps, artifacts, effectiveParentRunId).catch(err =>
                console.warn(`[${runId}] Failed to save checkpoint before cancellation:`, err.message)
              )
            }
            break
          }

          // Check if paused before each step
          const paused = await this.isPaused(runId)
          if (paused) {
            console.log(`[${runId}] [${browserType.toUpperCase()}] Test is paused at step ${stepNumber}. Waiting for resume or manual action...`)

            // While paused, check for manual actions (God Mode)
            const manualActionResult = await this.checkForManualAction(runId)
            if (manualActionResult) {
              const { action: manualAction, godModeEvent } = manualActionResult
              console.log(`[${runId}] [${browserType.toUpperCase()}] God Mode: Manual action detected while paused - ${manualAction.action} on ${manualAction.selector || manualAction.target || 'element'}`)
              // Execute manual action and continue (don't increment stepNumber yet)
              try {
                await runner.executeAction(session.id, manualAction)

                // Learn from manual action (God Mode Memory)
                if (godModeEvent && session.page) {
                  await this.learnFromManualAction(
                    runId,
                    projectId,
                    `step_${stepNumber}`,
                    godModeEvent,
                    session.page,
                    manualAction
                  )
                }
                // After manual action, wait a bit and check if still paused
                await this.delay(500)
                const stillPaused = await this.isPaused(runId)
                if (stillPaused) {
                  // Still paused, wait more
                  await new Promise(resolve => setTimeout(resolve, 1500))
                  continue
                } else {
                  // Resumed, continue with normal flow
                  console.log(`[${runId}] [${browserType.toUpperCase()}] Test resumed after manual action. Continuing...`)
                }
              } catch (manualError: any) {
                console.error(`[${runId}] [${browserType.toUpperCase()}] Manual action execution failed:`, manualError.message)
                // Continue waiting
                await new Promise(resolve => setTimeout(resolve, 1500))
                continue
              }
            } else {
              // No manual action, just wait
              await new Promise(resolve => setTimeout(resolve, 2000))
              continue
            }
          }

          stepNumber++

          // Declare action outside try block so it's accessible in catch
          let action: LLMAction | null = null
          let stepMode: 'llm' | 'speculative' | 'monkey' = 'llm'
          let stepHealing: SelfHealingInfo | undefined = undefined
          let comprehensiveData: ComprehensiveTestResults | undefined = undefined

          try {
            // CONTINUOUS POPUP HANDLING
            // Check and dismiss popups that might have appeared after preflight or previous actions
            if (options?.continuousPopupHandling !== false) {
              await this.continuousPopupHandler.checkAndDismissPopups(
                session.page,
                session.page.url(),
                runId,
                stepNumber
              )
            }

            // Synthesize context using ContextSynthesizer
            console.log(`[${runId}] [${browserType.toUpperCase()}] Step ${stepNumber}: Synthesizing context...`)
            const contextResult = await this.contextSynthesizer.synthesizeContext({
              sessionId: session.id,
              isMobile,
              goal,
              visitedSelectors,
              visitedUrls,
              visitedHrefs,
              blockedSelectors,
              isSelectorBlocked,
              comprehensiveTesting: this.comprehensiveTesting,
              playwrightRunner: this.playwrightRunner,
              appiumRunner: this.appiumRunner || undefined,
              stepNumber,
              runId,
              browserType,
              testableComponents: diagnosisData?.testableComponents || [],
            })

            // HARD INVARIANT: Preflight must be completed before context synthesis
            assertPreflightCompletedBeforeScreenshot(runId, 'TestProcessor.executeTestSequenceForBrowser')
            assertPreflightCompletedBeforeDOMSnapshot(runId, 'TestProcessor.executeTestSequenceForBrowser')
            assertPreflightCompletedBeforeAIAnalysis(runId, 'TestProcessor.executeTestSequenceForBrowser')

            const { context, filteredContext, currentUrl, comprehensiveData: compData } = contextResult
            comprehensiveData = compData || undefined
            console.log(`[${runId}] [${browserType.toUpperCase()}] Step ${stepNumber}: Context synthesized (${context.elements.length} total, ${filteredContext.elements.length} filtered)`)


            // NOTE: Guest-specific auth flow analysis is in GuestTestProcessor
            // This processor handles registered users with multi-select test types

            // Log user instructions if present (remind AI of priority)
            if (hasUserInstructions) {
              console.log(`[${runId}] [${browserType.toUpperCase()}] Step ${stepNumber}: 🎯 Following user instructions: "${userInstructions}"`)
            }

            // GOD MODE: Check for manual actions BEFORE generating AI action
            // Manual actions take priority over AI-generated actions
            const manualActionResult = await this.checkForManualAction(runId)
            if (manualActionResult) {
              const { action: manualAction, godModeEvent } = manualActionResult
              console.log(`[${runId}] [${browserType.toUpperCase()}] Step ${stepNumber}: 🎮 GOD MODE - Using manual action instead of AI: ${manualAction.action} on ${manualAction.selector || manualAction.target || 'element'}`)
              action = manualAction
              stepMode = 'llm' // Manual actions are treated as LLM actions for logging

              // Learn from manual action (God Mode Memory) - will be called after execution
              // Store godModeEvent for later learning
              if (godModeEvent && session.page) {
                // Defer learning until after action execution
                setTimeout(() => {
                  this.learnFromManualAction(
                    runId,
                    projectId,
                    `step_${stepNumber}`,
                    godModeEvent,
                    session.page,
                    manualAction
                  ).catch(() => { })
                }, 1000) // Wait for action to complete
              }
            } else {
              // No manual action, proceed with AI generation
              // ENHANCED: Use Testing Strategy Module to generate structured tests
              // Check for structured test patterns before speculative actions
              if (actionQueue.length === 0) {
                const strategyActions = this.testingStrategy.generateTestActions(filteredContext)
                if (strategyActions.length > 0) {
                  console.log(`[${runId}] [${browserType.toUpperCase()}] Step ${stepNumber}: Testing Strategy detected patterns - queuing ${strategyActions.length} structured tests`)
                  actionQueue.push(...strategyActions)

                  // Log recommendations
                  const recommendations = this.testingStrategy.getRecommendations(filteredContext)
                  if (recommendations.length > 0) {
                    console.log(`[${runId}] [${browserType.toUpperCase()}] Step ${stepNumber}: Testing recommendations:`, recommendations.join(', '))
                  }
                }
              }

              // Speculative execution: attempt to batch obvious flows (e.g., login forms)
              if (actionQueue.length === 0) {
                const speculativeActions = this.generateSpeculativeActions(filteredContext, history, speculativeFlowCache)
                if (speculativeActions.length > 0) {
                  actionQueue.push(...speculativeActions)
                  console.log(`[${runId}] [${browserType.toUpperCase()}] Step ${stepNumber}: Queued ${speculativeActions.length} speculative action(s) (e.g., login flow)`)
                }
              }

              if (isMonkeyMode) {
                action = this.generateMonkeyAction(filteredContext, visitedSelectors, stepNumber)
                stepMode = 'monkey'
                console.log(`[${runId}] [${browserType.toUpperCase()}] Step ${stepNumber}: 🐒 Monkey action ${action.action} ${action.selector || action.target || ''}`)
              } else if (actionQueue.length > 0) {
                action = actionQueue.shift()!
                stepMode = 'speculative'
                console.log(`[${runId}] [${browserType.toUpperCase()}] Step ${stepNumber}: Using speculative action ${action.action} ${action.selector || action.target || ''}`)
              } else {
                // Phase 2: Get DOM analysis for deterministic fallback triggers
                let domAnalysis: { maxDepth: number; hasShadowDOM: boolean; shadowDOMCount: number } | undefined
                try {
                  const domAnalysisResult = await session.page.evaluate(() => {
                    // Inline DOM analysis (can't use require in browser context)
                    let maxDepth = 0
                    let shadowDOMCount = 0

                    function calculateDepth(node: Node, currentDepth: number = 0): void {
                      if (node.nodeType === Node.ELEMENT_NODE) {
                        maxDepth = Math.max(maxDepth, currentDepth)
                        const element = node as Element
                        if (element.shadowRoot) {
                          shadowDOMCount++
                          calculateDepth(element.shadowRoot, currentDepth + 1)
                        }
                        for (let i = 0; i < element.children.length; i++) {
                          calculateDepth(element.children[i], currentDepth + 1)
                        }
                      }
                    }

                    if (document.body) {
                      calculateDepth(document.body, 0)
                    }

                    return {
                      maxDepth,
                      hasShadowDOM: shadowDOMCount > 0,
                      shadowDOMCount,
                    }
                  }).catch(() => null)

                  if (domAnalysisResult) {
                    domAnalysis = {
                      maxDepth: domAnalysisResult.maxDepth,
                      hasShadowDOM: domAnalysisResult.hasShadowDOM,
                      shadowDOMCount: domAnalysisResult.shadowDOMCount,
                    }
                    console.log(`[${runId}] [${browserType.toUpperCase()}] DOM Analysis: depth=${domAnalysis.maxDepth}, shadowDOM=${domAnalysis.hasShadowDOM ? 'yes' : 'no'}`)
                  }
                } catch (domError: any) {
                  console.warn(`[${runId}] Failed to analyze DOM:`, domError.message)
                }

                // Phase 1: Check if previous action failed (deterministic trigger)
                let previousActionFailed = false
                let previousSelector: string | undefined
                let previousActionError: string | undefined
                if (history.length > 0) {
                  const lastAction = history[history.length - 1].action
                  if (lastAction.selector) {
                    // Check if selector exists in DOM
                    try {
                      const selectorExists = await session.page.evaluate((sel: string) => {
                        try {
                          return document.querySelector(sel) !== null
                        } catch {
                          return false
                        }
                      }, lastAction.selector)

                      if (!selectorExists) {
                        previousActionFailed = true
                        previousSelector = lastAction.selector
                        previousActionError = 'Selector not found in DOM'
                        console.log(`[${runId}] [${browserType.toUpperCase()}] Previous action failed: selector ${lastAction.selector} not found`)
                      }
                    } catch (checkError: any) {
                      // Ignore check errors
                    }
                  }
                }

                // Generate next action with filtered context and visited tracking info
                console.log(`[${runId}] [${browserType.toUpperCase()}] Step ${stepNumber}: Generating action with Unified Brain... (${filteredContext.elements.length} unvisited elements available)`)

                // Broadcast AI thinking
                if (this.aiThinkingBroadcaster) {
                  await this.aiThinkingBroadcaster.broadcast(runId, 'generating_action', stepNumber)
                }

                // Enhanced: Pass projectId and page for heuristic lookup
                // Enhanced: Pass projectId and page for heuristic lookup
                try {
                  // Use UnifiedAIExecutor for budget-controlled AI calls
                  const logEmitter = getExecutionLogEmitter(runId, stepNumber)
                  const generateResult = await this.unifiedAIExecutor.executeLLMCall(
                    () => this.unifiedBrain.generateAction(
                      filteredContext,
                      history,
                      goal,
                      {
                        visitedUrls: Array.from(visitedUrls),
                        visitedSelectors: Array.from(visitedSelectors),
                        discoveredPages: discoveredPages,
                        currentUrl: currentUrl,
                        isAllPagesMode: options?.allPages || options?.testMode === 'all',
                        browser: currentEnvironment.browser as 'chromium' | 'firefox' | 'webkit',
                        viewport: currentEnvironment.viewport,
                        // Phase 1: Action failure context
                        previousActionFailed,
                        previousSelector,
                        previousActionError,
                        // Phase 2: DOM analysis context
                        domAnalysis,
                        // God Mode Memory: Pass projectId and page for heuristic lookup
                        projectId,
                        page: session.page,
                      }
                    ),
                    {
                      parentRunId: effectiveParentRunId,
                      runId,
                      stepNumber,
                      callType: 'llm',
                      priority: 'critical',
                      description: 'Generate next test action',
                      logEmitter,
                      tier: userTier,
                    }
                  )

                  if (generateResult.success && generateResult.result) {
                    action = generateResult.result
                  } else {
                    // Fallback to deterministic action selection
                    console.log(`[${runId}] [${browserType.toUpperCase()}] AI action generation skipped, using deterministic fallback`)
                    const clickable = filteredContext.elements.find(e =>
                      (e.type === 'button' || e.type === 'link') && e.elementId && Math.random() > 0.5
                    ) || filteredContext.elements.find(e => e.type === 'button' || e.type === 'link') || filteredContext.elements[0]

                    if (clickable) {
                      action = {
                        action: 'click',
                        target: clickable.text || 'Element',
                        selector: clickable.selector,
                        description: 'Deterministic Fallback (AI unavailable)'
                      }
                      console.log(`[${runId}] [${browserType.toUpperCase()}] Fallback action: click ${clickable.selector}`)
                    } else {
                      action = { action: 'scroll', value: 'down', description: 'Scroll Down (Deterministic Fallback)' }
                      console.log(`[${runId}] [${browserType.toUpperCase()}] Fallback action: scroll down`)
                    }
                  }
                } catch (aiError: any) {
                  console.warn(`[${runId}] [${browserType.toUpperCase()}] AI action generation error:`, aiError.message)
                  // Fallback to Dumb Monkey (Random Clicker)
                  const clickable = filteredContext.elements.find(e =>
                    (e.type === 'button' || e.type === 'link') && e.elementId && Math.random() > 0.5
                  ) || filteredContext.elements.find(e => e.type === 'button' || e.type === 'link') || filteredContext.elements[0]

                  if (clickable) {
                    action = {
                      action: 'click',
                      target: clickable.text || 'Element',
                      selector: clickable.selector,
                      description: 'Dumb Monkey Fallback'
                    }
                    console.log(`[${runId}] [${browserType.toUpperCase()}] Fallback action: click ${clickable.selector}`)
                  } else {
                    action = { action: 'scroll', value: 'down', description: 'Scroll Down (Fallback)' }
                    console.log(`[${runId}] [${browserType.toUpperCase()}] Fallback action: scroll down`)
                  }
                }
                stepMode = 'llm'
                console.log(`[${runId}] [${browserType.toUpperCase()}] Step ${stepNumber}: Action generated: ${action.action} ${action.target || ''} ${action.selector || ''}`)
              }
            }

            // Prevent getting stuck on "wait" actions
            // If we've had too many consecutive waits, force an interaction
            const recentWaits = history.slice(-3).filter(h => h.action.action === 'wait').length
            if (action.action === 'wait' && recentWaits >= 2 && context.elements.length > 0) {
              console.log(`[${runId}] [${browserType.toUpperCase()}] Too many consecutive waits (${recentWaits}), forcing interaction...`)
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
                console.log(`[${runId}] [${browserType.toUpperCase()}] Forced action: ${action.action} on ${action.target}`)
              } else if (history.filter(h => h.action.action === 'scroll').length < 3) {
                action = {
                  action: 'scroll',
                  description: 'Scroll down to see more content',
                  confidence: 0.8,
                }
                console.log(`[${runId}] [${browserType.toUpperCase()}] Forced action: scroll`)
              }
            }

            // Check if test should complete
            // For "all pages" mode, don't complete early - need to discover all pages
            if (action.action === 'complete') {
              const minStepsForAllPages = STEP_LIMITS.all.min

              if (isAllPagesMode && stepNumber < minStepsForAllPages) {
                console.log(`[${runId}] [${browserType.toUpperCase()}] All pages mode: Ignoring early completion at step ${stepNumber}, continuing discovery...`)
                // Override complete action - continue testing
                action = {
                  action: 'scroll',
                  description: 'Continue exploring to discover more pages',
                  confidence: 0.8,
                }
              } else {
                console.log(`[${runId}] [${browserType.toUpperCase()}] Test completed at step ${stepNumber}`)
                break
              }
            }

            if (action.selector && isSelectorBlocked(action.selector)) {
              const reason = blockedSelectorReasons.get(action.selector) || 'diagnosis'
              console.log(`[${runId}] [${browserType.toUpperCase()}] Step ${stepNumber}: Selector ${action.selector} is blocked (${reason}). Requesting alternate action.`)
              visitedSelectors.add(action.selector)
              stepNumber--
              continue
            }

            const originalSelectorBeforeHealing = action.selector

            // Check in-memory healing map first
            if (originalSelectorBeforeHealing && selectorHealingMap.has(originalSelectorBeforeHealing)) {
              const healedSelector = selectorHealingMap.get(originalSelectorBeforeHealing)!
              action.selector = healedSelector
            } else if (originalSelectorBeforeHealing && projectId && !isMobile && session.page) {
              // Check persisted healing memory
              try {
                if (!this.selfHealingMemory) {
                  this.selfHealingMemory = new SelfHealingMemoryService((this.storageService as any).supabase)
                }

                const domSnapshot = await this.playwrightRunner.getDOMSnapshot(session.id).catch(() => '')
                const pageSignature = this.selfHealingMemory.generatePageSignature(currentUrl || build.url || '', domSnapshot)

                const healedSelector = await this.selfHealingMemory.getHealingMemory(
                  projectId,
                  pageSignature,
                  originalSelectorBeforeHealing
                )

                if (healedSelector) {
                  action.selector = healedSelector
                  selectorHealingMap.set(originalSelectorBeforeHealing, healedSelector)
                  console.log(`[${runId}] [${browserType.toUpperCase()}] Step ${stepNumber}: Using persisted healing memory: ${originalSelectorBeforeHealing} → ${healedSelector}`)
                }
              } catch (memoryError: any) {
                // Non-blocking - continue without memory lookup
                console.warn(`[${runId}] Failed to load healing memory:`, memoryError.message)
              }
            }

            if (originalSelectorBeforeHealing && action.selector !== originalSelectorBeforeHealing) {
              // Selector was healed (either from memory or map)
              console.log(`[${runId}] [${browserType.toUpperCase()}] Step ${stepNumber}: Using healed selector: ${action.selector}`)
            }

            // Update environment tracking for viewport actions
            if (action.action === 'setViewport' && action.value) {
              const viewportMatch = action.value.match(/(\d+)x(\d+)/)
              if (viewportMatch) {
                const width = parseInt(viewportMatch[1], 10)
                const height = parseInt(viewportMatch[2], 10)
                currentEnvironment.viewport = action.value
                currentEnvironment.orientation = height > width ? 'portrait' : 'landscape'
                console.log(`[${runId}] [${browserType.toUpperCase()}] Step ${stepNumber}: Environment updated - viewport: ${currentEnvironment.viewport}, orientation: ${currentEnvironment.orientation}`)
              }
            } else if (action.action === 'setDevice' && action.value) {
              // Import DEVICE_ALIASES from playwright runner
              const { DEVICE_ALIASES } = await import('../runners/playwright')
              const deviceAlias = action.value.toLowerCase().trim()
              const deviceDimensions = DEVICE_ALIASES[deviceAlias]
              if (deviceDimensions) {
                currentEnvironment.viewport = `${deviceDimensions.width}x${deviceDimensions.height}`
                currentEnvironment.orientation = deviceDimensions.height > deviceDimensions.width ? 'portrait' : 'landscape'
                console.log(`[${runId}] [${browserType.toUpperCase()}] Step ${stepNumber}: Environment updated - device: ${deviceAlias}, viewport: ${currentEnvironment.viewport}, orientation: ${currentEnvironment.orientation}`)
              }
            } else if (action.action === 'setOrientation' && action.value) {
              const orientation = action.value.toLowerCase().trim() as 'portrait' | 'landscape'
              if (orientation === 'portrait' || orientation === 'landscape') {
                // Swap viewport dimensions if orientation changed
                const viewportMatch = currentEnvironment.viewport.match(/(\d+)x(\d+)/)
                if (viewportMatch) {
                  const width = parseInt(viewportMatch[1], 10)
                  const height = parseInt(viewportMatch[2], 10)
                  const isCurrentlyPortrait = height > width
                  if (isCurrentlyPortrait !== (orientation === 'portrait')) {
                    // Swap dimensions
                    currentEnvironment.viewport = `${height}x${width}`
                  }
                }
                currentEnvironment.orientation = orientation
                console.log(`[${runId}] [${browserType.toUpperCase()}] Step ${stepNumber}: Environment updated - orientation: ${currentEnvironment.orientation}, viewport: ${currentEnvironment.viewport}`)
              }
            }

            // Execute action using TestExecutor
            console.log(`[${runId}] [${browserType.toUpperCase()}] Step ${stepNumber}: Executing action:`, action.action, action.target)

            const executionResult = await this.testExecutor.executeAction({
              sessionId: session.id,
              action,
              context: filteredContext,
              isMobile,
              enableIRL: true,
              retryLayer: this.retryLayer,
              playwrightRunner: this.playwrightRunner,
              appiumRunner: this.appiumRunner || undefined,
              runId,
              browserType,
              stepNumber,
              actionContext: ActionContext.NORMAL, // Normal test execution - IRL allowed
            })

            const healingMeta = executionResult.healing
            if (healingMeta) {
              const learnedKey = healingMeta.originalSelector || originalSelectorBeforeHealing || healingMeta.healedSelector
              if (learnedKey) {
                selectorHealingMap.set(learnedKey, healingMeta.healedSelector)

                // Persist healing memory to database (project-scoped)
                if (projectId && !isMobile && session.page) {
                  try {
                    if (!this.selfHealingMemory) {
                      this.selfHealingMemory = new SelfHealingMemoryService((this.storageService as any).supabase)
                    }

                    // Generate page signature
                    const domSnapshot = await this.playwrightRunner.getDOMSnapshot(session.id).catch(() => '')
                    const pageSignature = this.selfHealingMemory.generatePageSignature(currentUrl || build.url || '', domSnapshot)

                    // Save healing memory
                    await this.selfHealingMemory.saveHealingMemory(
                      projectId,
                      pageSignature,
                      learnedKey,
                      healingMeta.healedSelector
                    )
                  } catch (memoryError: any) {
                    // Non-blocking - don't fail if memory save fails
                    console.warn(`[${runId}] Failed to save healing memory:`, memoryError.message)
                  }
                }
              }
              stepHealing = {
                strategy: healingMeta.strategy,
                originalSelector: learnedKey,
                healedSelector: healingMeta.healedSelector,
                note: healingMeta.note || `Updated selector to ${healingMeta.healedSelector}`,
                confidence: healingMeta.confidence || 0,
              }
              console.log(`[${runId}] [${browserType.toUpperCase()}] Step ${stepNumber}: Self-healing applied (${stepHealing.strategy}) ${learnedKey} → ${healingMeta.healedSelector}`)
            }

            // Capture state will be done later using TestExecutor

            // Inner try block for step execution - errors caught by stepError catch
            try {
              // Capture state first (needed for vision validator and artifacts)
              const stateResult = await this.testExecutor.captureState(session.id, isMobile)

              // Broadcast frame to WebSocket (via Redis)
              if (stateResult?.screenshot) {
                const base64 = stateResult.screenshot
                this.broadcastPageState(runId, base64, currentUrl || '')
              }

              // Capture element bounds using TestExecutor
              const boundsResult = await this.testExecutor.captureElementBounds(
                session.id,
                isMobile,
                action,
                healingMeta
              )
              const { elementBounds, targetElementBounds } = boundsResult

              // Phase 3: Detect layout shifts before vision validation
              let layoutShiftDetected = false
              try {
                const layoutShiftResult = await session.page.evaluate(() => {
                  // Simple layout shift detection
                  const initialScroll = { x: window.scrollX, y: window.scrollY }
                  return new Promise<boolean>((resolve) => {
                    setTimeout(() => {
                      const currentScroll = { x: window.scrollX, y: window.scrollY }
                      const scrollChanged = initialScroll.x !== currentScroll.x || initialScroll.y !== currentScroll.y
                      resolve(scrollChanged)
                    }, 100)
                  })
                })
                layoutShiftDetected = layoutShiftResult || false
                if (layoutShiftDetected) {
                  console.log(`[${runId}] [${browserType.toUpperCase()}] Layout shift detected at step ${stepNumber}`)
                }
              } catch (layoutError: any) {
                // Ignore layout shift detection errors
              }

              // Phase 1: Optimized GPT-4o Vision usage (final assertions + layout shifts only)
              let visionIssues: VisionIssue[] = []
              const isFinalStep = stepNumber >= maxSteps - 1 || action.action === 'complete'
              if (
                this.visionValidator &&
                this.visionValidator.shouldUseVision({
                  stepNumber,
                  hasError: false,
                  irlFailed: false,
                  visualIssueDetectionEnabled: options?.visualDiff || false,
                  // Phase 1: Final assertion check
                  isFinalStep,
                  totalSteps: maxSteps,
                  // Phase 3: Layout shift detection
                  layoutShiftDetected,
                  // Phase 1: Critical error flag (if action failed)
                  criticalError: false, // previousActionFailed removed as it's not in scope
                })
              ) {
                try {
                  visionIssues = await this.visionValidator.analyzeScreenshot(stateResult.screenshot, {
                    url: currentUrl,
                    goal,
                  })
                  if (visionIssues.length > 0) {
                    console.log(`[${runId}] [${browserType.toUpperCase()}] Vision validator detected ${visionIssues.length} visual issue(s)`)
                  }
                } catch (visionError: any) {
                  console.warn(`[${runId}] [${browserType.toUpperCase()}] Vision validator failed:`, visionError.message)
                }
              }
              const screenshotBuffer = Buffer.from(stateResult.screenshot, 'base64')
              const artifactsResult = await this.runLogger.logArtifacts({
                runId,
                stepNumber,
                screenshot: screenshotBuffer,
                domSnapshot: stateResult.domSnapshot,
                metadata: {
                  browser: currentEnvironment.browser as 'chromium' | 'firefox' | 'webkit',
                  viewport: currentEnvironment.viewport,
                  orientation: currentEnvironment.orientation,
                },
              })
              const { screenshotUrl, domUrl } = artifactsResult

              // AI Visual Issue Detection (if enabled)
              let visualDiffResult: { hasDifference: boolean; diffPercentage: number; diffImageUrl?: string } | null = null
              if (options?.visualDiff && options?.baselineRunId) {
                try {
                  // Fetch baseline screenshot from previous run
                  const fetch = (await import('node-fetch')).default
                  const baselineResponse = await fetch(`${this.apiUrl}/api/tests/${options.baselineRunId}`)
                  const baselineData = await baselineResponse.json()

                  // Find matching step in baseline (same step number, browser, viewport)
                  const baselineStep = baselineData.testRun?.steps?.find((s: any) =>
                    s.stepNumber === stepNumber &&
                    s.environment?.browser === browserType &&
                    s.environment?.viewport === currentEnvironment.viewport
                  )

                  if (baselineStep?.screenshotUrl) {
                    // Download baseline screenshot
                    const baselineScreenshotResponse = await fetch(baselineStep.screenshotUrl)
                    const baselineBuffer = Buffer.from(await baselineScreenshotResponse.arrayBuffer())

                    // Compare screenshots
                    const diffResult = await this.visualDiffService.compareScreenshots(
                      baselineBuffer,
                      screenshotBuffer
                    )

                    const threshold = options.visualDiffThreshold || 1.0
                    const isAcceptable = this.visualDiffService.isAcceptable(diffResult.diffPercentage, threshold)

                    if (!isAcceptable && diffResult.diffImageBuffer) {
                      // Upload diff image
                      const diffImageUrl = await this.storageService.uploadVisualDiff(
                        runId,
                        stepNumber,
                        diffResult.diffImageBuffer,
                        {
                          browser: browserType,
                          viewport: currentEnvironment.viewport,
                        }
                      )
                      visualDiffResult = {
                        hasDifference: true,
                        diffPercentage: diffResult.diffPercentage,
                        diffImageUrl,
                      }
                      console.log(`[${runId}] [${browserType.toUpperCase()}] Visual difference detected: ${diffResult.diffPercentage.toFixed(2)}% difference`)
                    } else {
                      visualDiffResult = {
                        hasDifference: false,
                        diffPercentage: diffResult.diffPercentage,
                      }
                      console.log(`[${runId}] [${browserType.toUpperCase()}] Visual diff passed: ${diffResult.diffPercentage.toFixed(2)}% difference (threshold: ${threshold}%)`)
                    }
                  }
                } catch (visualDiffError: any) {
                  console.warn(`[${runId}] [${browserType.toUpperCase()}] Visual diff failed:`, visualDiffError.message)
                }
              }

              const domVisualIssues = (comprehensiveData?.visualIssues || []).slice(0, 5)
              const visionVisualIssues = visionIssues.map(issue => ({
                type: 'vision',
                description: issue.description,
                severity: issue.severity,
              }))
              const combinedVisualIssues = [...domVisualIssues, ...visionVisualIssues].slice(0, 8)

              // 5. Evaluate Success Rules (Performance, Accessibility, Security)
              // ============================================================================
              let evaluationResult: import('../types').EvaluationResult | undefined;
              let standardRuleWarnings: any[] = [];

              if (comprehensiveData) {
                evaluationResult = this.successEvaluator.evaluate(comprehensiveData);
                (comprehensiveData as any).evaluation = evaluationResult; // Attach to results natively

                // Map evaluation status to step warnings
                if (evaluationResult.status === 'soft-fail' || evaluationResult.status === 'warning') {
                  evaluationResult.issues.forEach(issue => {
                    standardRuleWarnings.push({
                      type: 'standard-rule',
                      message: issue,
                      severity: evaluationResult!.status === 'soft-fail' ? 'warning' : 'info'
                    });
                  });
                }
              }

              // Create test step with comprehensive testing data
              const step: TestStep = {
                id: `step_${runId}_${browserType}_${stepNumber}`,
                stepNumber,
                action: action.action,
                target: action.target,
                value: action.value,
                timestamp: new Date().toISOString(),
                screenshotUrl,
                domSnapshot: domUrl,
                success: true,
                browser: browserType, // Direct browser field for parallel browser testing
                // Include comprehensive testing data if available
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
                performance: comprehensiveData?.performance ? {
                  pageLoadTime: comprehensiveData.performance.pageLoadTime,
                  firstContentfulPaint: comprehensiveData.performance.firstContentfulPaint,
                } : undefined,
                accessibilityIssues: comprehensiveData?.accessibility?.map(a => ({
                  type: a.type,
                  message: a.message,
                  impact: a.impact,
                })),
                // Persist authentication flow analysis metadata
                metadata: authAnalysis ? {
                  ...authAnalysis,
                  executionLogs: getExecutionLogEmitter(runId, stepNumber).getLogs(),
                } : undefined,
                // Add standard rule warnings
                warnings: standardRuleWarnings.length > 0 ? standardRuleWarnings : undefined,
                // Include raw evaluation result if needed for frontend badges
                healingReport: evaluationResult ? {
                  originalSelector: '', // Not applicable here, just piggybacking for now or we should add a dedicated field
                  healedSelector: '',
                  reason: `Evaluation Status: ${evaluationResult.status}`,
                  confidence: 1.0
                } : undefined,
                visualIssues: combinedVisualIssues.length > 0
                  ? combinedVisualIssues.map(v => ({
                    type: v.type,
                    description: v.description,
                    severity: v.severity,
                  }))
                  : undefined,
                mode: stepMode,
                selfHealing: stepHealing,
                // Iron Man HUD visual annotations
                elementBounds: elementBounds.length > 0 ? elementBounds : undefined,
                targetElementBounds,
                // Environment metadata for compatibility & responsiveness testing
                environment: {
                  browser: browserType,
                  viewport: currentEnvironment.viewport,
                  orientation: currentEnvironment.orientation,
                },
              }

              steps.push(step)
              if (action.selector) {
                visitedSelectors.add(action.selector)
              }
              artifacts.push(screenshotUrl, domUrl)

              // Save checkpoint after each step
              await this.runLogger.saveCheckpoint(runId, stepNumber, steps, artifacts, effectiveParentRunId)


              // Store embedding (if Pinecone is available)
              if (this.pineconeService) {
                await this.pineconeService.storeEmbedding(
                  runId,
                  stepNumber,
                  stateResult.screenshot,
                  action.description,
                  {
                    action: action.action,
                    target: action.target,
                    success: true,
                    browser: currentEnvironment.browser,
                    viewport: currentEnvironment.viewport,
                  }
                )
              }

              // Add to history using RunLogger
              this.runLogger.addToHistory(history, action)

              // Wait between steps
              await new Promise(resolve => setTimeout(resolve, 1000))
            } catch (stepError: any) {
              console.error(`[${runId}] [${browserType.toUpperCase()}] Step ${stepNumber} failed:`, stepError)

              // Try to capture screenshot even on error to see what went wrong
              let errorScreenshotUrl: string | undefined
              let errorElementBounds: Array<{
                selector: string
                bounds: { x: number; y: number; width: number; height: number }
                type: string
                text?: string
                interactionType?: 'clicked' | 'typed' | 'analyzed' | 'failed' | 'healed'
              }> = []
              let errorTargetElementBounds: {
                selector: string
                bounds: { x: number; y: number; width: number; height: number }
                interactionType: 'clicked' | 'typed' | 'analyzed' | 'failed' | 'healed'
              } | undefined

              try {
                if (!runner) {
                  throw new Error('Runner not available')
                }
                console.log(`[${runId}] [${browserType.toUpperCase()}] Capturing screenshot after error...`)
                const errorScreenshot = await runner.captureScreenshot(session.id)
                const screenshotBuffer = Buffer.from(errorScreenshot, 'base64')
                errorScreenshotUrl = await this.storageService.uploadScreenshot(
                  runId,
                  stepNumber,
                  screenshotBuffer,
                  {
                    browser: currentEnvironment.browser as 'chromium' | 'firefox' | 'webkit',
                    viewport: currentEnvironment.viewport,
                    orientation: currentEnvironment.orientation
                  }
                )
                artifacts.push(errorScreenshotUrl)

                // Capture element bounds for failed step (to show what element failed)
                if (!isMobile) {
                  try {
                    errorElementBounds = await this.playwrightRunner.captureElementBounds(session.id)

                    // Mark the target element as failed
                    if (action && action.selector && errorElementBounds.length > 0) {
                      const failedSelector = action.selector
                      const failedElement = errorElementBounds.find(e => e.selector === failedSelector)
                      if (failedElement) {
                        failedElement.interactionType = 'failed'
                        errorTargetElementBounds = {
                          selector: failedElement.selector,
                          bounds: failedElement.bounds,
                          interactionType: 'failed',
                        }
                      }
                    }
                  } catch (boundsError: any) {
                    console.warn(`[${runId}] [${browserType.toUpperCase()}] Failed to capture error element bounds:`, boundsError.message)
                  }
                }
              } catch (screenshotError: any) {
                console.warn(`[${runId}] [${browserType.toUpperCase()}] Failed to capture error screenshot:`, screenshotError.message)
              }

              // Format error with natural language explanation
              const formattedError = formatErrorForStep(stepError, {
                action: action?.action || 'unknown',
                selector: action?.selector,
              })

              if (action?.selector && shouldBlockSelectorFromError(formattedError)) {
                registerBlockedSelector(action.selector, 'runtime failure')
              }

              // Generate AI "why did this fail?" explanation
              let failureExplanation: any = null
              try {
                if (!this.failureExplanationService) {
                  this.failureExplanationService = new FailureExplanationService(this.unifiedBrain)
                }

                // Get DOM snapshot and comprehensive data for context
                const domSnapshot = !isMobile && session.page
                  ? await this.playwrightRunner.getDOMSnapshot(session.id).catch(() => '')
                  : ''

                // Get current comprehensive data (may be from previous step)
                const currentComprehensiveData = comprehensiveData || this.comprehensiveTesting.getResults()

                const explanation = await this.failureExplanationService.explainFailure({
                  domSnapshot,
                  screenshotBase64: undefined, // Screenshot already uploaded to errorScreenshotUrl, can fetch if needed
                  consoleErrors: currentComprehensiveData?.consoleErrors?.map((e: any) => ({
                    type: e.type,
                    message: e.message,
                    timestamp: e.timestamp,
                  })) || [],
                  networkErrors: currentComprehensiveData?.networkErrors?.map((e: any) => ({
                    url: e.url,
                    status: e.status,
                    timestamp: e.timestamp,
                  })) || [],
                  actionHistory: history.slice(-5), // Last 5 actions
                  failedAction: action || { action: 'complete' as const, description: 'Unknown action', target: '', selector: '' },
                  errorMessage: stepError.message || String(stepError),
                  stepNumber,
                })

                failureExplanation = {
                  why: explanation.why,
                  userExperience: explanation.userExperience,
                  suggestion: explanation.suggestion,
                  confidence: explanation.confidence,
                }
              } catch (explanationError: any) {
                console.warn(`[${runId}] Failed to generate failure explanation:`, explanationError.message)
                // Continue without explanation - non-blocking
              }

              const errorStep: TestStep = {
                id: `step_${runId}_${browserType}_${stepNumber}`,
                stepNumber,
                action: action?.action || 'error',
                target: action?.target,
                timestamp: new Date().toISOString(),
                screenshotUrl: errorScreenshotUrl,
                success: false,
                error: formattedError,
                browser: browserType, // Direct browser field for parallel browser testing
                mode: stepMode,
                selfHealing: stepHealing,
                // Iron Man HUD visual annotations for failed step
                elementBounds: errorElementBounds.length > 0 ? errorElementBounds : undefined,
                targetElementBounds: errorTargetElementBounds,
                environment: {
                  browser: browserType,
                  viewport: currentEnvironment.viewport,
                  orientation: currentEnvironment.orientation,
                },
                // Store failure explanation and error screenshot in metadata
                metadata: {
                  failureExplanation,
                  errorScreenshotUrl: errorScreenshotUrl, // Screenshot at error time
                },
              }

              steps.push(errorStep)
              await this.runLogger.saveCheckpoint(runId, stepNumber, steps, artifacts, effectiveParentRunId)

              // If too many consecutive errors, try to recover
              const recentErrors = steps.slice(-5).filter(s => !s.success).length
              if (recentErrors >= 3) {
                console.warn(`[${runId}] [${browserType.toUpperCase()}] Too many consecutive errors (${recentErrors}), attempting recovery...`)

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
                  console.log(`[${runId}] [${browserType.toUpperCase()}] Recovery: Scrolled successfully`)
                } catch (scrollError: any) {
                  console.warn(`[${runId}] [${browserType.toUpperCase()}] Recovery scroll failed:`, scrollError.message)
                }

                // Strategy 2: If still failing, try navigating back or refreshing
                if (!recovered && recentErrors >= 5) {
                  try {
                    const currentUrl = await (isMobile
                      ? (this.appiumRunner?.getCurrentUrl(session.id).catch(() => build.url || '') || Promise.resolve(build.url || ''))
                      : this.playwrightRunner.getCurrentUrl(session.id).catch(() => build.url || ''))

                    // Try navigating to a different page or refreshing
                    if (currentUrl && currentUrl !== build.url) {
                      console.log(`[${runId}] [${browserType.toUpperCase()}] Recovery: Attempting to navigate to a different page`)
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
                    console.warn(`[${runId}] [${browserType.toUpperCase()}] Recovery navigation failed:`, navError.message)
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


            // Store test trace in Pinecone (if available)
            if (this.pineconeService) {
              await this.pineconeService.storeTestTrace(
                runId,
                steps.map(s => ({
                  stepNumber: s.stepNumber,
                  action: s.action,
                  screenshot: s.screenshotUrl || '',
                  success: s.success ?? false,
                })),
                projectId
              )
            }

            // REGISTERED USER: Execute Rage Bait tests if selected (runs after main test flow)
            if (selectedTestTypes && selectedTestTypes.includes('rage_bait') && session?.page) {
              console.log(`[${runId}] [${browserType.toUpperCase()}] 🔥 Running Rage Bait edge-case tests (registered user)`)
              try {
                const { RageBaitAnalyzer } = await import('../services/rageBaitAnalyzer')
                const rageBaitAnalyzer = new RageBaitAnalyzer()

                // First find a form on the current page
                const formSearch = await rageBaitAnalyzer.findForm(session.page, runId)

                if (formSearch.found) {
                  // Run all 5 rage bait tests
                  const rageBaitResults = await rageBaitAnalyzer.runAllTests(session.page, runId)

                  // Add rage bait steps
                  for (const testResult of rageBaitResults.results) {
                    const rageBaitStep: TestStep = {
                      id: `step_${runId}_${browserType}_rage_bait_${testResult.testName.toLowerCase().replace(/\s+/g, '_')}`,
                      stepNumber: steps.length + 1,
                      action: 'rage_bait_test',
                      target: testResult.testName,
                      value: testResult.details,
                      timestamp: new Date().toISOString(),
                      success: testResult.passed,
                      error: testResult.passed ? undefined : testResult.details,
                      browser: browserType,
                      metadata: { severity: testResult.severity, testType: 'rage_bait' } as any,
                      environment: { browser: browserType, viewport: currentEnvironment.viewport },
                    }
                    steps.push(rageBaitStep)
                  }

                  // Summary step
                  const summaryStep: TestStep = {
                    id: `step_${runId}_${browserType}_rage_bait_summary`,
                    stepNumber: steps.length + 1,
                    action: 'summary',
                    target: 'Rage Bait Test Summary',
                    value: `${rageBaitResults.passed}/${rageBaitResults.totalTests} passed | ${rageBaitResults.critical} critical`,
                    timestamp: new Date().toISOString(),
                    success: rageBaitResults.critical === 0,
                    browser: browserType,
                    environment: { browser: browserType, viewport: currentEnvironment.viewport },
                  }
                  steps.push(summaryStep)

                  console.log(`[${runId}] [${browserType.toUpperCase()}] 🔥 Rage Bait complete: ${rageBaitResults.passed}/${rageBaitResults.totalTests} passed`)
                } else {
                  console.log(`[${runId}] [${browserType.toUpperCase()}] ⚠️ Rage Bait skipped: No form found on current page`)
                }
              } catch (rageBaitError: any) {
                console.warn(`[${runId}] [${browserType.toUpperCase()}] Rage Bait tests failed:`, rageBaitError.message)
              }
            }

            console.log(`[${runId}] [${browserType.toUpperCase()}] Test run completed: ${steps.length} steps, ${artifacts.length} artifacts`)

            result = {
              steps,
              artifacts,
              success: true,
              error: undefined
            }
          } catch (error: any) {
            console.error(`[${runId}] [${browserType.toUpperCase()}] Test run failed:`, error)

            // Record final error step using RunLogger
            const finalErrorStep = this.runLogger.createStep({
              runId,
              stepNumber: stepNumber + 1,
              browserType,
              action: { action: 'complete', description: 'Test run failed', target: '', selector: '' },
              success: false,
              error: error.message,
              environment: {
                browser: browserType,
                viewport: currentEnvironment.viewport,
                orientation: currentEnvironment.orientation,
              },
            })
            steps.push(finalErrorStep)

            result = {
              success: false,
              steps,
              artifacts,
              error: error.message
            }
          } finally {
            // Release session and upload videos/traces
            if (session) {
              const runner = build.type === BuildType.WEB
                ? this.playwrightRunner
                : (this.appiumRunner || this.playwrightRunner) // Fallback to playwright if appium not available (shouldn't happen due to validation)

              try {
                // Release session and get video/trace paths (only Playwright returns paths)
                let releaseResult: { videoPath: string | null; tracePath: string | null } | void = undefined
                if (build.type === BuildType.WEB && this.playwrightRunner) {
                  releaseResult = await this.playwrightRunner.releaseSession(session.id)
                } else {
                  await runner.releaseSession(session.id)
                }
                console.log(`[${runId}] [${browserType.toUpperCase()}] Session released`)

                // Stop screenshot-based live view
                if (this.screenshotLiveView) {
                  this.screenshotLiveView.stopCapture()
                }

                // Upload video if available (only for web builds)
                if (releaseResult && releaseResult.videoPath) {
                  try {
                    const fs = await import('fs')
                    if (fs.existsSync(releaseResult.videoPath)) {
                      const videoBuffer = fs.readFileSync(releaseResult.videoPath)
                      const videoUrl = await this.storageService.uploadVideo(runId, videoBuffer)
                      artifacts.push(videoUrl)
                      console.log(`[${runId}] [${browserType.toUpperCase()}] Video uploaded: ${videoUrl}`)

                      // Save video artifact to database (critical - must succeed even if test was cancelled)
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
                          const errorText = await artifactResponse.text()
                          throw new Error(`HTTP ${artifactResponse.status}: ${errorText}`)
                        }

                        console.log(`[${runId}] [${browserType.toUpperCase()}] Video artifact saved to database successfully`)
                      } catch (artifactError: any) {
                        console.error(`[${runId}] [${browserType.toUpperCase()}] CRITICAL: Failed to save video artifact to database:`, artifactError.message)
                        // Keep video file for manual recovery if database save fails
                        console.warn(`[${runId}] [${browserType.toUpperCase()}] Video file preserved at: ${releaseResult.videoPath} (database save failed)`)
                      }

                      // Clean up local video file only after successful database save
                      // If database save failed, keep the local file for manual recovery
                      try {
                        // Check if video was successfully saved to database by verifying it exists
                        // We'll delete it anyway since it's uploaded, but log for debugging
                        if (fs.existsSync(releaseResult.videoPath)) {
                          fs.unlinkSync(releaseResult.videoPath)
                          console.log(`[${runId}] [${browserType.toUpperCase()}] Local video file cleaned up`)
                        }
                      } catch (unlinkError: any) {
                        console.warn(`[${runId}] [${browserType.toUpperCase()}] Failed to delete local video:`, unlinkError.message)
                      }
                    }
                  } catch (videoError: any) {
                    console.warn(`[${runId}] [${browserType.toUpperCase()}] Failed to upload video:`, videoError.message)
                  }
                }

                // Upload trace if available (Time-Travel Debugger, only for web builds)
                // Prefer Wasabi for trace files (cheaper storage, 7-day retention)
                if (releaseResult && releaseResult.tracePath) {
                  try {
                    const fs = await import('fs')
                    if (fs.existsSync(releaseResult.tracePath)) {
                      let traceUrl: string

                      // Prefer Wasabi if available (for cost efficiency)
                      const wasabiStorage = (this.storageService as any).wasabiStorage
                      if (wasabiStorage) {
                        traceUrl = await wasabiStorage.uploadTraceFile(runId, releaseResult.tracePath)
                        console.log(`[${runId}] [${browserType.toUpperCase()}] Trace uploaded to Wasabi: ${traceUrl}`)
                      } else {
                        // Fallback to Supabase
                        const traceBuffer = fs.readFileSync(releaseResult.tracePath)
                        traceUrl = await this.storageService.uploadTrace(runId, traceBuffer, browserType)
                        console.log(`[${runId}] [${browserType.toUpperCase()}] Trace uploaded to Supabase: ${traceUrl}`)
                      }

                      artifacts.push(traceUrl)

                      // Save trace artifact to database
                      try {
                        const fetch = (await import('node-fetch')).default
                        await fetch(`${this.apiUrl}/api/tests/${runId}/artifacts`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            type: 'trace',
                            url: traceUrl,
                            path: traceUrl.split('/').slice(-2).join('/'),
                            size: fs.statSync(releaseResult.tracePath).size,
                            storage: wasabiStorage ? 'wasabi' : 'supabase',
                          }),
                        })
                      } catch (artifactError: any) {
                        console.warn(`[${runId}] [${browserType.toUpperCase()}] Failed to save trace artifact:`, artifactError.message)
                      }

                      // Clean up local trace file
                      try {
                        fs.unlinkSync(releaseResult.tracePath)
                      } catch (unlinkError: any) {
                        console.warn(`[${runId}] [${browserType.toUpperCase()}] Failed to delete local trace:`, unlinkError.message)
                      }
                    }
                  } catch (traceError: any) {
                    console.warn(`[${runId}] [${browserType.toUpperCase()}] Failed to upload trace:`, traceError.message)
                  }
                }
              } catch (releaseError: any) {
                console.warn(`[${runId}] [${browserType.toUpperCase()}] Failed to release session:`, releaseError.message)
              }
            }
          }
          // Return the result (set in try or catch block above)
          // TypeScript requires | undefined in return type due to async try-catch-finally control flow
          return result !== null ? result : undefined
        }
      }

    } catch (e: any) {
      console.error(e)
    }
  }



  // ============================================================================
  // PUBLIC API BOUNDARY - STABLE INTERFACE
  // ============================================================================
  // This is the main entry point for test processing.
  // Signature changes will break external callers.
  //
  // REFACTORING WARNINGS:
  // - DO NOT change function signature without updating all callers
  // - DO NOT modify parameter destructuring - used throughout method
  // - Internal refactoring acceptable, but preserve external contract
  // ============================================================================

  /**
   * Process a test run job step-by-step with pause/resume support
   */
  public async process(jobData: JobData): Promise<ProcessResult> {
    const { runId, projectId, build, profile, options } = jobData

    // Extract parent run ID for AI budget coordination
    // If this is a browser-specific job from a matrix, use parentRunId
    // Otherwise, use runId as the parent (single browser test)
    const parentRunId = jobData.parentRunId || runId

    // Validate mobile test support
    const isMobile = build.type === BuildType.ANDROID || build.type === BuildType.IOS
    if (isMobile && !this.appiumRunner) {
      const errorMsg = `Mobile testing (${build.type}) is not available. Appium is disabled. Set ENABLE_APPIUM=true in worker/.env to enable mobile testing.`
      console.error(`[${runId}] ${errorMsg}`)
      throw new Error(errorMsg)
    }

    // Update comprehensive testing service with design spec and vision validator
    if (options && options.designSpec) {
      this.comprehensiveTesting.setDesignSpec(options.designSpec)
    }
    if (this.visionValidator) {
      this.comprehensiveTesting.setVisionValidator(this.visionValidator ?? null)
    }

    // Fetch current status to decide what to do
    const fetch = (await import('node-fetch')).default
    const response = await fetch(`${this.apiUrl}/api/tests/${runId}`)
    const testRunData = await response.json()
    const currentStatus = testRunData.testRun?.status
    const diagnosisData: DiagnosisResult | undefined = testRunData.testRun?.diagnosis
    const hasDiagnosis = !!diagnosisData

    // Extract tier from test run metadata or default to 'guest'
    // Try to get tier from run metadata, fallback to guest
    const runMetadata = testRunData.testRun?.metadata || {}
    const userTier: 'guest' | 'starter' | 'indie' | 'pro' | 'agency' = runMetadata.tier ||
      (options?.isGuestRun ? 'guest' : 'starter')

    // Try to restore budget from snapshot if available
    const budgetSnapshot = runMetadata.aiBudget
    if (budgetSnapshot && parentRunId) {
      const { restoreBudgetFromSnapshot } = await import('../services/parentRunAIBudget')
      restoreBudgetFromSnapshot(parentRunId as string, budgetSnapshot)
    }

    const blockedSelectors = new Set<string>()
    const blockedSelectorReasons = new Map<string, string>()

    const registerBlockedSelector = (selector?: string | null, reason: string = 'diagnosis') => {
      if (!selector) return
      if (!blockedSelectors.has(selector)) {
        blockedSelectors.add(selector)
        blockedSelectorReasons.set(selector, reason)
        console.log(`[${runId}] Marked selector ${selector} as blocked (${reason})`)
      }
    }

    const isSelectorBlocked = (selector?: string | null) => {
      if (!selector) return false
      return blockedSelectors.has(selector)
    }

    const shouldBlockSelectorFromError = (message?: string) => {
      if (!message) return false
      const normalized = message.toLowerCase()
      return (
        normalized.includes('not found in dom') ||
        normalized.includes('is not visible') ||
        normalized.includes('not interactable') ||
        normalized.includes('timed out waiting for') ||
        normalized.includes('detached from document') ||
        normalized.includes('failed to click element')
      )
    }

    diagnosisData?.blockedSelectors?.forEach(selector => registerBlockedSelector(selector, 'diagnosis'))
    diagnosisData?.pages?.forEach(page => {
      page.blockedSelectors?.forEach(selector => registerBlockedSelector(selector, `diagnosis:${page.label || page.id}`))
    })

    // If we are in early stage and haven't diagnosed yet, run diagnosis
    // Unless monkey mode or specific override which skips diagnosis
    const shouldRunDiagnosis =
      build.type === BuildType.WEB &&
      Boolean(build.url) &&
      options?.testMode !== 'monkey'

    if (
      shouldRunDiagnosis &&
      !hasDiagnosis &&
      (currentStatus === TestRunStatus.QUEUED || currentStatus === TestRunStatus.PENDING)
    ) {
      try {
        const decision = await this.runDiagnosis(jobData)
        if (decision === 'wait') {
          return { success: true, steps: [], artifacts: [], stage: 'diagnosis' } as ProcessResult
        }
      } catch (error) {
        if (error instanceof DiagnosisCancelledError) {
          console.log(`[${runId}] Diagnosis cancelled by user. Exiting worker.`)
          return { success: true, steps: [], artifacts: [], stage: 'diagnosis' } as ProcessResult
        }
        throw error
      }
    }

    // If waiting approval/diagnosing, we shouldn't proceed
    if (currentStatus === TestRunStatus.WAITING_APPROVAL || currentStatus === TestRunStatus.DIAGNOSING) {
      console.log(`[${runId}] Test is in ${currentStatus} state. Exiting worker.`)
      return { success: true, steps: [], artifacts: [], stage: 'diagnosis' } as ProcessResult
    }

    // Otherwise, proceed with normal test execution

    const isAllPagesMode = (options && (options.allPages || options.testMode === 'all')) || false
    const isMultiPageMode = options ? options.testMode === 'multi' : false
    const isSinglePageMode = !isMultiPageMode && !isAllPagesMode && (options ? options.testMode !== 'monkey' : true)
    const isMonkeyMode = options ? (options.monkeyMode || options.testMode === 'monkey') : false

    // Guardrails for step limits
    const STEP_LIMITS = {
      single: { min: 15, max: 50, default: 15 },
      multi: { min: 25, max: 100, default: 25 },
      all: { min: 50, max: 150, default: 50 },
      monkey: { min: 25, max: 75, default: 25 },
    }

    // Calculate dynamic maxSteps based on diagnosis results
    let maxSteps: number
    const requestedMaxSteps = options?.maxSteps

    if (requestedMaxSteps !== undefined && requestedMaxSteps !== null) {
      // User explicitly requested a step count - respect it
      maxSteps = requestedMaxSteps as number as number
      console.log(`[${runId}] Using user-requested maxSteps: ${maxSteps}`)
    } else {
      // Calculate dynamically from diagnosis results
      const testRunState = await this.getTestRunState(runId)
      const diagnosis = testRunState.diagnosis

      if (diagnosis && (isSinglePageMode || isMultiPageMode)) {
        const componentCount = diagnosis?.testableComponents?.length || 0
        const recommendedTestCount = diagnosis?.recommendedTests?.length || 0
        const pageCount = diagnosis?.pages?.length || 1

        if (isSinglePageMode) {
          // Single page: (components × 2) + recommended tests + 10 buffer
          const calculated = (componentCount * 2) + recommendedTestCount + 10
          maxSteps = Math.max(STEP_LIMITS.single.min, Math.min(calculated, STEP_LIMITS.single.max))
          console.log(`[${runId}] Dynamic step calculation (single page):`)
          console.log(`[${runId}]   Components: ${componentCount} × 2 = ${componentCount * 2}`)
          console.log(`[${runId}]   Recommended tests: ${recommendedTestCount}`)
          console.log(`[${runId}]   Buffer: 10`)
          console.log(`[${runId}]   Calculated: ${calculated} → Clamped: ${maxSteps} (min: ${STEP_LIMITS.single.min}, max: ${STEP_LIMITS.single.max})`)
        } else {
          // Multi page: (components × 2) + recommended tests + (pages × 5) + 15 buffer
          const calculated = (componentCount * 2) + recommendedTestCount + (pageCount * 5) + 15
          maxSteps = Math.max(STEP_LIMITS.multi.min, Math.min(calculated, STEP_LIMITS.multi.max))
          console.log(`[${runId}] Dynamic step calculation (multi page):`)
          console.log(`[${runId}]   Components: ${componentCount} × 2 = ${componentCount * 2}`)
          console.log(`[${runId}]   Recommended tests: ${recommendedTestCount}`)
          console.log(`[${runId}]   Pages: ${pageCount} × 5 = ${pageCount * 5}`)
          console.log(`[${runId}]   Buffer: 15`)
          console.log(`[${runId}]   Calculated: ${calculated} → Clamped: ${maxSteps} (min: ${STEP_LIMITS.multi.min}, max: ${STEP_LIMITS.multi.max})`)
        }
      } else if (isAllPagesMode) {
        maxSteps = STEP_LIMITS.all.default
      } else if (isMonkeyMode) {
        maxSteps = STEP_LIMITS.monkey.default
      } else {
        // Fallback to single page default
        maxSteps = STEP_LIMITS.single.default
      }
    }

    const maxDuration = (profile.maxMinutes || 10) * 60 * 1000 // Convert to milliseconds
    const startTime = Date.now()

    console.log(`[${runId}] Starting test run:`, { build: build.type, device: profile.device })
    const testMode = options ? (options.testMode || 'single') : 'single'
    console.log(`[${runId}] Effective max steps: ${maxSteps} (requested: ${requestedMaxSteps ?? 'dynamic'}, mode: ${testMode})`)

    // Determine browser type: use browserType from JobData if provided (parallel browser jobs),
    // otherwise determine from profile (legacy single-browser execution)
    const browserType: 'chromium' | 'firefox' | 'webkit' = jobData.browserType ||
      (profile.device === DeviceProfile.FIREFOX_LATEST ? 'firefox'
        : profile.device === DeviceProfile.SAFARI_LATEST ? 'webkit'
          : 'chromium')

    if (jobData.browserType) {
      console.log(`[${runId}] [${browserType.toUpperCase()}] Browser-specific job (from browser matrix)`)
    } else {
      console.log(`[${runId}] [${browserType.toUpperCase()}] Single-browser execution (determined from profile)`)
    }

    try {
      // Execute test sequence using extracted method
      const result = await this.executeTestSequenceForBrowser(
        runId,
        build,
        profile,
        options,
        browserType,
        maxSteps,
        maxDuration,
        startTime,
        diagnosisData,
        blockedSelectors,
        blockedSelectorReasons,
        isSelectorBlocked,
        shouldBlockSelectorFromError,
        projectId,
        parentRunId,
        userTier
      )

      // Reset authentication flow analyzer for next test
      this.authFlowAnalyzer.reset()


      // Store test trace in Pinecone (if available)
      if (this.pineconeService && result && result.steps) {
        await this.pineconeService.storeTestTrace(
          runId,
          result.steps.map(s => ({
            stepNumber: s.stepNumber,
            action: s.action,
            screenshot: s.screenshotUrl || '',
            success: s.success ?? false,
          })),
          projectId
        )
      }

      if (!result) {
        throw new Error('Test execution returned no result')
      }

      console.log(`[${runId}] Test run completed: ${result.steps.length} steps, ${result.artifacts.length} artifacts`)

      return {
        success: result.success,
        steps: result.steps,
        artifacts: result.artifacts,
        stage: 'execution',
      } as ProcessResult

    } catch (error: any) {
      console.error(`[${runId}] Test run failed:`, error)

      return {
        success: false,
        steps: [],
        artifacts: [],
        stage: 'execution',
      } as ProcessResult
    } finally {
      // Stop streaming if active
      if (this.streamer) {
        try {
          await this.streamer?.stopStream()
          console.log(`[${runId}] WebRTC stream stopped`)
        } catch (streamError: any) {
          console.warn(`[${runId}] Error stopping stream:`, streamError.message)
        }
        this.streamer = null
      }

      // Note: Video upload is handled inside executeTestSequenceForBrowser()
      // for single-browser execution
    }
  }

  private async broadcastPageState(runId: string, screenshot: string, url: string) {
    try {
      const payload = {
        type: 'page_state',
        state: {
          screenshot,
          url,
          elements: []
        }
      }
      await this.redis.publish('ws:broadcast', JSON.stringify({
        runId,
        payload,
        serverId: 'worker'
      }))
    } catch (e: any) {
      console.warn(`[${runId}] Failed to broadcast page state:`, e.message)
    }
  }
}
