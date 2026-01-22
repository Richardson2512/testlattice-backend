// Diagnosis phase logic - analyzes application UI and identifies testable components
import { DiagnosisResult, VisionContext, ComprehensiveTestResults } from '../../types'
import { RunnerSession } from '../../runners/playwright'
import { UnifiedBrainService } from '../../services/unifiedBrainService'
import { StorageService } from '../../services/storage'
import { ComprehensiveTestingService } from '../../services/comprehensiveTesting'
import { PlaywrightRunner } from '../../runners/playwright'

export interface DiagnosisSnapshotResult {
  context: VisionContext
  analysis: DiagnosisResult
  screenshotUrl?: string
  screenshotUrls?: string[]
  comprehensiveTests?: ComprehensiveTestResults
}

export class DiagnosisRunner {
  constructor(
    private unifiedBrain: UnifiedBrainService,
    private storageService: StorageService,
    private comprehensiveTesting: ComprehensiveTestingService,
    private playwrightRunner: PlaywrightRunner
  ) { }

  /**
   * Capture diagnosis snapshot for a page
   */
  async captureDiagnosisSnapshot(params: {
    sessionId: string
    runId: string
    pageIndex: number
    upload: boolean
    build?: { url?: string }
  }): Promise<DiagnosisSnapshotResult> {
    const { sessionId, runId, pageIndex, upload } = params

    // Get page dimensions for scrolling
    const dimensions = await this.playwrightRunner.getPageDimensions(sessionId)
    const viewportHeight = dimensions.viewportHeight
    const documentHeight = dimensions.documentHeight

    // Calculate scroll positions (capture multiple screenshots for long pages)
    const scrollPositions: number[] = []
    const totalScrollPositions = Math.max(1, Math.ceil(documentHeight / viewportHeight))

    for (let i = 0; i < totalScrollPositions; i++) {
      const scrollY = Math.min(i * viewportHeight, documentHeight - viewportHeight)
      scrollPositions.push(Math.max(0, scrollY))
    }

    // Capture screenshots at each scroll position
    const screenshots: Array<{ screenshot: string; position: number }> = []
    for (let i = 0; i < scrollPositions.length; i++) {
      const scrollY = scrollPositions[i]
      await this.playwrightRunner.scrollToPosition(sessionId, scrollY)
      await this.delay(200) // Wait for scroll to complete

      const screenshot = await this.playwrightRunner.captureScreenshot(sessionId, false)
      screenshots.push({ screenshot, position: scrollY })

      console.log(`[${runId}] Captured screenshot ${i + 1}/${totalScrollPositions} at position ${scrollY}px`)
    }

    // Scroll back to top
    await this.playwrightRunner.scrollToTop(sessionId)
    await this.delay(200)

    // Get full DOM snapshot
    const domSnapshot = await this.playwrightRunner.getDOMSnapshot(sessionId)

    // Analyze the DOM snapshot
    const context = await this.unifiedBrain.analyzeScreenshot(
      screenshots[0]?.screenshot || '',
      domSnapshot,
      'Diagnosis'
    )

    // Get the page from the session for comprehensive testing
    const session = this.playwrightRunner.getSession(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }
    const { page } = session

    // Initialize comprehensive testing
    console.log(`[${runId}] Initializing comprehensive testing for diagnosis...`)
    await this.comprehensiveTesting.initialize(page)

    // Run all comprehensive tests during diagnosis
    console.log(`[${runId}] Running comprehensive test checks during diagnosis...`)
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
      console.log(`[${runId}] Comprehensive tests completed`)
    } catch (compError: any) {
      console.warn(`[${runId}] Failed to collect comprehensive test data during diagnosis:`, compError.message)
    }

    // Analyze page testability
    const analysis = await this.unifiedBrain.analyzePageTestability(context)

    // Upload screenshots
    let screenshotUrl: string | undefined
    let screenshotUrls: string[] = []

    if (upload && screenshots.length > 0) {
      for (let i = 0; i < screenshots.length; i++) {
        const buffer = Buffer.from(screenshots[i].screenshot, 'base64')
        const stepNumber = -1000 - pageIndex - (i * 0.1)
        const url = await this.storageService.uploadScreenshot(runId, stepNumber, buffer)
        screenshotUrls.push(url)

        if (i === 0) {
          screenshotUrl = url
        }
      }
    }

    const analysisWithTests: DiagnosisResult = {
      ...analysis,
      comprehensiveTests: comprehensiveTests || undefined,
    }

    return {
      context,
      analysis: analysisWithTests,
      screenshotUrl,
      screenshotUrls,
      comprehensiveTests: comprehensiveTests || undefined
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

