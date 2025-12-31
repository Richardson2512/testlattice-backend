/**
 * Base Processor
 * Issue #1, #4: Shared logic extracted from God Objects
 * 
 * All test processors extend this base class for:
 * - Lifecycle management (setup, execute, cleanup)
 * - Error handling with user messages
 * - Progress tracking
 * - Artifact management
 */

import { Page } from 'playwright'
import { ProcessResult } from '../types'
import { logger, testEvents, withTraceAsync, getTraceId } from '../../observability'
import { metrics } from '../../observability/metrics'
import { TEST_MODE_CONFIGS, TestMode } from '../../config/constants'
import { AppError, TestExecutionError, getUserMessage } from '../../errors'
import { StateManager } from '../../services/StateManager'

export interface BaseProcessorConfig {
    runId: string
    userId?: string
    userTier: string
    testMode: TestMode
    url: string
    maxSteps?: number
    timeout?: number
}

export interface ProcessorDependencies {
    page: Page
    supabase: any
    redis: any
    storage: any
    stateManager?: StateManager
    brain?: any
}

/**
 * Base class for all test processors
 * Max 300 lines - enforced by design
 */
export abstract class BaseProcessor {
    protected runId: string
    protected userId?: string
    protected userTier: string
    protected testMode: TestMode
    protected url: string
    protected maxSteps: number
    protected timeout: number
    protected startTime: number = 0
    protected currentStep: number = 0
    protected steps: any[] = []
    protected artifacts: string[] = []

    constructor(
        protected config: BaseProcessorConfig,
        protected deps: ProcessorDependencies
    ) {
        this.runId = config.runId
        this.userId = config.userId
        this.userTier = config.userTier
        this.testMode = config.testMode
        this.url = config.url

        // Get limits from config
        const modeConfig = TEST_MODE_CONFIGS[config.testMode]
        this.maxSteps = config.maxSteps || modeConfig.maxSteps
        this.timeout = config.timeout || modeConfig.timeout
    }

    /**
     * Main entry point - wraps execution with lifecycle
     */
    async process(): Promise<ProcessResult> {
        return withTraceAsync(
            { runId: this.runId, userId: this.userId, testMode: this.testMode },
            async () => {
                this.startTime = Date.now()
                testEvents.started(this.runId, this.testMode, this.url)
                metrics.testsStarted(this.testMode, this.userTier)

                try {
                    // Setup phase
                    await this.setup()

                    // Execute phase (implemented by subclass)
                    const result = await this.execute()

                    // Cleanup phase
                    await this.cleanup()

                    // Record success
                    const duration = Date.now() - this.startTime
                    testEvents.completed(this.runId, this.currentStep, duration, result.success)
                    metrics.testsCompleted(this.testMode, result.success ? 'success' : 'failed', this.userTier)
                    metrics.testDuration(this.testMode, duration)

                    return result
                } catch (error: any) {
                    // Handle error
                    return await this.handleError(error)
                } finally {
                    // Always cleanup
                    await this.cleanup()
                }
            }
        )
    }

    /**
     * Setup phase - prepare for execution
     */
    protected async setup(): Promise<void> {
        logger.info({ runId: this.runId }, 'Starting processor setup')

        // Update status to running
        await this.updateStatus('running')

        // Navigate to URL
        await this.deps.page.goto(this.url, {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
        })

        logger.info({ runId: this.runId, url: this.url }, 'Setup complete')
    }

    /**
     * Execute phase - implemented by subclass
     */
    protected abstract execute(): Promise<ProcessResult>

    /**
     * Cleanup phase - release resources
     */
    protected async cleanup(): Promise<void> {
        logger.info({ runId: this.runId }, 'Running cleanup')

        try {
            // Close page if open
            if (this.deps.page && !this.deps.page.isClosed()) {
                await this.deps.page.close().catch(() => { })
            }
        } catch (e) {
            // Ignore cleanup errors
        }
    }

    /**
     * Handle execution errors
     */
    protected async handleError(error: any): Promise<ProcessResult> {
        const duration = Date.now() - this.startTime
        const userMessage = getUserMessage(error)
        const recoverable = error instanceof AppError && error.isOperational

        testEvents.failed(this.runId, this.currentStep, error.message, recoverable)
        metrics.testsCompleted(this.testMode, 'failed', this.userTier)
        metrics.errors('processor', error.code || 'UNKNOWN')

        logger.error({
            runId: this.runId,
            step: this.currentStep,
            error: error.message,
            recoverable,
        }, 'Processor error')

        // Update status
        await this.updateStatus('failed', userMessage)

        return {
            success: false,
            steps: this.steps,
            artifacts: this.artifacts,
            stage: 'execution',
        }
    }

    /**
     * Update test run status in database
     */
    protected async updateStatus(status: string, error?: string): Promise<void> {
        if (this.deps.stateManager) {
            await this.deps.stateManager.updateRunStatus(this.runId, status, error)
            return
        }

        try {
            await this.deps.supabase
                .from('test_runs')
                .update({
                    status,
                    error,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', this.runId)
        } catch (e: any) {
            logger.warn({ runId: this.runId, error: e.message }, 'Failed to update status')
        }
    }

    /**
     * Record a step
     */
    protected recordStep(
        action: string,
        success: boolean,
        duration: number,
        details?: any
    ): void {
        this.currentStep++

        const step = {
            step: this.currentStep,
            action,
            success,
            duration,
            timestamp: new Date().toISOString(),
            ...details,
        }

        this.steps.push(step)

        if (this.deps.stateManager) {
            this.deps.stateManager.addStep(this.runId, step).catch(() => { /* ignore persistence errors to keep speed */ })
        }

        if (success) {
            testEvents.stepCompleted(this.runId, this.currentStep, action, duration)
        } else {
            testEvents.stepFailed(this.runId, this.currentStep, action, details?.error || 'Unknown')
        }
    }

    /**
     * Take and save a screenshot
     */
    protected async captureScreenshot(label?: string): Promise<string | undefined> {
        try {
            const screenshot = await this.deps.page.screenshot({
                type: 'jpeg',
                quality: 80,
            })

            const key = `${this.runId}/${this.currentStep}-${label || 'screenshot'}.jpg`
            const url = await this.deps.storage.upload(key, screenshot, 'image/jpeg')

            this.artifacts.push(url)
            return url
        } catch (e: any) {
            logger.warn({ runId: this.runId, error: e.message }, 'Screenshot capture failed')
            return undefined
        }
    }

    /**
     * Check if step limit reached
     */
    protected isStepLimitReached(): boolean {
        return this.currentStep >= this.maxSteps
    }

    /**
     * Check if timeout reached
     */
    protected isTimeoutReached(): boolean {
        return Date.now() - this.startTime >= this.timeout
    }

    /**
     * Get execution duration
     */
    protected getDuration(): number {
        return Date.now() - this.startTime
    }
}
