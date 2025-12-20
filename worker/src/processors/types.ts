// Test Processor Types
// Shared types for test processing modules

import {
    TestStep,
    VisionContext,
    DiagnosisResult,
    DiagnosisPageSummary,
    DiagnosisComponentInsight,
    DiagnosisIssueInsight,
    LLMAction,
    HighRiskArea
} from '../types'
import type { RunnerSession } from '../runners/playwright'

// Re-export commonly used types
export type {
    TestStep,
    VisionContext,
    DiagnosisResult,
    DiagnosisPageSummary,
    DiagnosisComponentInsight,
    DiagnosisIssueInsight,
    LLMAction,
    HighRiskArea,
    RunnerSession
}

export interface BrowserMatrixResult {
    browser: 'chromium' | 'firefox' | 'webkit'
    success: boolean
    steps: TestStep[]
    artifacts: string[]
    error?: string
    executionTime: number
}

export interface ProcessResult {
    success: boolean
    steps: TestStep[]
    artifacts: string[]
    stage?: 'diagnosis' | 'execution'
    browserResults?: BrowserMatrixResult[]
    summary?: {
        totalBrowsers: number
        passedBrowsers: number
        failedBrowsers: number
        browsers: Array<{ browser: string; success: boolean; steps: number }>
    }
}

export interface DiagnosisProgress {
    step: number
    totalSteps: number
    stepLabel: string
    subStep: number
    totalSubSteps: number
    subStepLabel?: string
    percent: number
}

/**
 * Error thrown when diagnosis is cancelled by user
 */
export class DiagnosisCancelledError extends Error {
    constructor(message = 'Diagnosis cancelled by user') {
        super(message)
        this.name = 'DiagnosisCancelledError'
    }
}

export interface DiagnosisSnapshot {
    context: VisionContext
    analysis: DiagnosisResult
    screenshotUrl?: string
    screenshotUrls?: string[]
    comprehensiveTests?: any
}

export interface DiagnosisLink {
    selector: string
    url: string
    label?: string
}

export interface CrawlParams {
    runId: string
    session: RunnerSession
    buildUrl: string
    baseContext: VisionContext
    visitedUrls: Set<string>
    startIndex: number
    remainingSlots: number
}
