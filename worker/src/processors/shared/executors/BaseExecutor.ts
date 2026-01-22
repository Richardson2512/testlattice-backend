/**
 * BaseExecutor - Shared interface for all test executors
 * Both guest and registered tests use executors that implement this interface
 */

import { Page } from 'playwright'
import { ExecutionLogEmitter } from '../../../services/executionLogEmitter'
import { TestStep } from '../../../types'

export interface ExecutorConfig {
    runId: string
    url: string
    startingStep?: number
}

export interface ExecutorDependencies {
    page: Page
    logEmitter: ExecutionLogEmitter
    captureScreenshot: (label?: string) => Promise<string | undefined>
    recordStep: (action: string, success: boolean, duration: number, metadata?: any) => void
}

export interface ProcessResult {
    success: boolean
    steps: TestStep[]
    artifacts: string[]
    stage: 'execution' | 'verification' | 'diagnosis'
}

export abstract class BaseExecutor {
    protected steps: TestStep[] = []
    protected artifacts: string[] = []
    protected currentStep: number

    constructor(
        protected config: ExecutorConfig,
        protected deps: ExecutorDependencies
    ) {
        this.currentStep = config.startingStep || 0
    }

    /**
     * Execute the test and return results
     * All executors must implement this method
     */
    abstract execute(): Promise<ProcessResult>

    /**
     * Helper to record a step with proper formatting
     */
    protected recordLocalStep(
        action: string,
        success: boolean,
        duration: number = 100,
        metadata: any = {}
    ): void {
        this.currentStep++
        this.deps.recordStep(action, success, duration, metadata)
    }

    /**
     * Build a standard result object
     * Always returns success: true - findings are tracked at step level
     */
    protected buildResult(): ProcessResult {
        return {
            success: true, // Always true - findings tracked at step level
            steps: this.steps,
            artifacts: this.artifacts,
            stage: 'execution'
        }
    }
}
