// Progress Reporter - Handles diagnosis progress updates
// Used for real-time progress notifications during diagnosis

import { DiagnosisProgress } from '../types'

interface ProgressCallback {
    (progress: DiagnosisProgress): void | Promise<void>
}

export class ProgressReporter {
    private callback?: ProgressCallback
    private currentStep = 0
    private totalSteps = 6 // Default for multi-page, 5 for single

    constructor(callback?: ProgressCallback, isMultiPage = true) {
        this.callback = callback
        this.totalSteps = isMultiPage ? 6 : 5
    }

    /**
     * Report progress with step and sub-step information
     */
    async report(params: {
        step: number
        stepLabel: string
        subStep?: number
        totalSubSteps?: number
        subStepLabel?: string
    }): Promise<void> {
        this.currentStep = params.step

        const basePercent = ((params.step - 1) / this.totalSteps) * 100
        const subStepPercent = params.totalSubSteps
            ? ((params.subStep || 0) / params.totalSubSteps) * (100 / this.totalSteps)
            : 0

        const progress: DiagnosisProgress = {
            step: params.step,
            totalSteps: this.totalSteps,
            stepLabel: params.stepLabel,
            subStep: params.subStep || 0,
            totalSubSteps: params.totalSubSteps || 1,
            subStepLabel: params.subStepLabel,
            percent: Math.min(Math.round(basePercent + subStepPercent), 100),
        }

        if (this.callback) {
            await this.callback(progress)
        }
    }

    /**
     * Report a simple step transition
     */
    async stepTo(step: number, stepLabel: string): Promise<void> {
        await this.report({ step, stepLabel })
    }

    /**
     * Get current step number
     */
    getCurrentStep(): number {
        return this.currentStep
    }
}

// Common step labels for diagnosis
export const DIAGNOSIS_STEPS = {
    INITIALIZE: { step: 1, label: 'Initializing browser session' },
    NAVIGATE: { step: 2, label: 'Navigating to target URL' },
    CAPTURE: { step: 3, label: 'Capturing page snapshot' },
    EXPLORE: { step: 4, label: 'Exploring additional pages' },
    ANALYZE: { step: 5, label: 'Analyzing test coverage' },
    FINALIZE: { step: 6, label: 'Finalizing diagnosis report' },
} as const
