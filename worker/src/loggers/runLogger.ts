// RunLogger: Responsible for TestStep creation, artifact logging, and state management
import { TestStep, LLMAction, SelfHealingInfo, ComprehensiveTestResults } from '../types'
import { StorageService } from '../services/storage'
import { PineconeService } from '../services/pinecone'
import { VisionIssue } from '../services/visionValidator'
import { logger } from '../utils/logger'

export interface ElementBounds {
  selector: string
  bounds: { x: number; y: number; width: number; height: number }
  type: string
  text?: string
  interactionType?: 'clicked' | 'typed' | 'analyzed' | 'failed' | 'healed'
}

export interface TargetElementBounds {
  selector: string
  bounds: { x: number; y: number; width: number; height: number }
  interactionType: 'clicked' | 'typed' | 'analyzed' | 'failed' | 'healed'
}

export interface CreateStepParams {
  runId: string
  stepNumber: number
  browserType: 'chromium' | 'firefox' | 'webkit'
  action: LLMAction
  success: boolean
  screenshotUrl?: string
  domUrl?: string
  comprehensiveData?: ComprehensiveTestResults | null
  visionIssues?: VisionIssue[]
  elementBounds?: ElementBounds[]
  targetElementBounds?: TargetElementBounds
  environment?: {
    browser: string
    viewport: string
    orientation?: 'portrait' | 'landscape'
  }
  error?: string
  selfHealing?: SelfHealingInfo
  mode?: 'llm' | 'speculative' | 'monkey'
}

export interface LogArtifactsParams {
  runId: string
  stepNumber: number
  screenshot: Buffer | string
  domSnapshot: string
  metadata: {
    browser?: 'chromium' | 'firefox' | 'webkit'
    viewport?: string
    orientation?: 'portrait' | 'landscape'
  }
}

export interface LogArtifactsResult {
  screenshotUrl: string
  domUrl: string
}

export class RunLogger {
  constructor(
    private storageService: StorageService,
    private pineconeService: PineconeService | null,
    private apiUrl: string
  ) { }

  /**
   * Create a TestStep object with all comprehensive testing data
   */
  createStep(params: CreateStepParams): TestStep {
    const {
      runId,
      stepNumber,
      browserType,
      action,
      success,
      screenshotUrl,
      domUrl,
      comprehensiveData,
      visionIssues = [],
      elementBounds,
      targetElementBounds,
      environment,
      error,
      selfHealing,
      mode
    } = params

    // Combine visual issues from comprehensive data and vision validator
    const domVisualIssues = (comprehensiveData?.visualIssues || []).slice(0, 5)
    const visionVisualIssues = visionIssues.map(issue => ({
      type: 'vision',
      description: issue.description,
      severity: issue.severity,
    }))
    const combinedVisualIssues = [...domVisualIssues, ...visionVisualIssues].slice(0, 8)

    const step: TestStep = {
      id: `step_${runId}_${browserType}_${stepNumber}`,
      stepNumber,
      action: action.action,
      target: action.target,
      value: action.value,
      timestamp: new Date().toISOString(),
      screenshotUrl,
      domSnapshot: domUrl,
      success,
      error,
      browser: browserType, // Direct browser field for parallel browser testing
      // Include comprehensive testing data if available
      consoleErrors: comprehensiveData?.consoleErrors?.map((e: any) => ({
        type: e.type,
        message: e.message,
        timestamp: e.timestamp,
      })),
      networkErrors: comprehensiveData?.networkErrors?.map((e: any) => ({
        url: e.url,
        status: e.status,
        timestamp: e.timestamp,
      })),
      performance: comprehensiveData?.performance ? {
        pageLoadTime: comprehensiveData.performance.pageLoadTime,
        firstContentfulPaint: comprehensiveData.performance.firstContentfulPaint,
      } : undefined,
      accessibilityIssues: comprehensiveData?.accessibility?.map((a: any) => ({
        type: a.type,
        message: a.message,
        impact: a.impact,
      })),
      visualIssues: combinedVisualIssues.length > 0
        ? combinedVisualIssues.map(v => ({
          type: v.type,
          description: v.description,
          severity: v.severity,
        }))
        : undefined,
      mode,
      selfHealing,
      // Iron Man HUD visual annotations
      elementBounds: elementBounds && elementBounds.length > 0 ? elementBounds : undefined,
      targetElementBounds,
      // Environment metadata for compatibility & responsiveness testing
      environment,
    }

    return step
  }

  /**
   * Upload and log artifacts (screenshots, DOM snapshots)
   */
  async logArtifacts(params: LogArtifactsParams): Promise<LogArtifactsResult> {
    const { runId, stepNumber, screenshot, domSnapshot, metadata } = params

    // Upload screenshot
    const screenshotUrl = await this.storageService.uploadScreenshot(
      runId,
      stepNumber,
      screenshot,
      metadata
    )

    // Upload DOM snapshot
    const domUrl = await this.storageService.uploadDOMSnapshot(
      runId,
      stepNumber,
      domSnapshot
    )

    // Save artifacts to database via API
    await this.saveArtifactToDatabase(runId, {
      type: 'screenshot',
      url: screenshotUrl,
      path: screenshotUrl.split('/').slice(-2).join('/'),
      size: screenshot.length,
    })

    await this.saveArtifactToDatabase(runId, {
      type: 'dom',
      url: domUrl,
      path: domUrl.split('/').slice(-2).join('/'),
      size: Buffer.from(domSnapshot).length,
    })

    return { screenshotUrl, domUrl }
  }

  /**
   * Save checkpoint after each step
   * @param parentRunId Optional parent run ID for AI budget persistence
   */
  async saveCheckpoint(
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
    } catch (error: any) {
      logger.warn({ err: error.message, runId }, 'Failed to save checkpoint')
    }
  }

  /**
   * Store embedding in Pinecone (if available)
   */
  async storeEmbedding(
    runId: string,
    stepNumber: number,
    screenshotBase64: string,
    description: string,
    metadata: {
      action: string
      target?: string
      success: boolean
      browser?: string
      viewport?: string
    }
  ): Promise<void> {
    if (!this.pineconeService) {
      return
    }

    try {
      await this.pineconeService.storeEmbedding(
        runId,
        stepNumber,
        screenshotBase64,
        description,
        {
          ...metadata,
          browser: metadata.browser,
          viewport: metadata.viewport,
        }
      )
    } catch (error: any) {
      logger.warn({ err: error.message, runId }, 'Failed to store embedding')
    }
  }

  /**
   * Add action to history
   */
  addToHistory(
    history: Array<{ action: LLMAction; timestamp: string }>,
    action: LLMAction
  ): void {
    history.push({
      action,
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Private helper to save artifact to database
   */
  private async saveArtifactToDatabase(
    runId: string,
    artifact: {
      type: 'screenshot' | 'dom' | 'video' | 'trace'
      url: string
      path: string
      size: number
    }
  ): Promise<void> {
    try {
      const fetch = (await import('node-fetch')).default
      const response = await fetch(`${this.apiUrl}/api/tests/${runId}/artifacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(artifact),
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`)
      }
    } catch (error: any) {
      logger.warn({ err: error.message, runId, artifactType: artifact.type }, 'Failed to save artifact to database')
    }
  }
}

