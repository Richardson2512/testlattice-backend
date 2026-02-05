import Redis from 'ioredis'
import { DiagnosisProgress } from '../types'

export interface ProgressPhase {
    id: string
    label: string
    weight: number
}

type UpdateCallback = (runId: string, progress: DiagnosisProgress) => Promise<void>

export class ProgressTracker {
    private runId: string
    private phases: ProgressPhase[]
    private redis: Redis
    private updateApiCallback: UpdateCallback
    private channelName: string

    private currentPhaseIndex: number = 0
    private currentSubStepLabel: string = ''
    private currentSubStep: number = 0
    private currentTotalSubSteps: number = 0

    constructor(
        runId: string,
        phases: ProgressPhase[],
        redis: Redis,
        updateApiCallback: UpdateCallback
    ) {
        this.runId = runId
        this.phases = phases
        this.redis = redis
        this.updateApiCallback = updateApiCallback
        this.channelName = `progress:${runId}`
    }

    /**
     * Start a new phase (moving to next step)
     */
    async startPhase(phaseId: string, subLabel: string = ''): Promise<void> {
        const index = this.phases.findIndex(p => p.id === phaseId)
        if (index >= 0) {
            this.currentPhaseIndex = index
            this.currentSubStepLabel = subLabel
            this.currentSubStep = 0
            this.currentTotalSubSteps = 1 // Default to 1 if not specified
            await this.emit()
        }
    }

    /**
     * Update progress within the current phase (sub-steps)
     */
    async updateSubPhase(subLabel: string, current?: number, total?: number): Promise<void> {
        this.currentSubStepLabel = subLabel
        if (current !== undefined) this.currentSubStep = current
        if (total !== undefined) this.currentTotalSubSteps = total
        await this.emit()
    }

    /**
     * Complete the tracked phase (moves logically to end of that phase)
     */
    async completePhase(phaseId: string): Promise<void> {
        const index = this.phases.findIndex(p => p.id === phaseId)
        if (index >= 0) {
            // If completing current phase, ensure we show 100% of this phase's possibilities
            // Actually we just move to the start of the next phase typically, 
            // but if this is the last phase, we might want to ensure we hit end state.
            // For now, let's just make sure internal state reflects completion.
            this.currentSubStep = this.currentTotalSubSteps || 1
            await this.emit()
        }
    }

    /**
     * Calculate overall percentage based on weighted phases
     */
    private calculatePercent(): number {
        const totalWeight = this.phases.reduce((sum, p) => sum + p.weight, 0)

        // Weight of fully completed phases
        let completedWeight = 0
        for (let i = 0; i < this.currentPhaseIndex; i++) {
            completedWeight += this.phases[i].weight
        }

        // Weight of current phase based on sub-step progress
        const currentPhase = this.phases[this.currentPhaseIndex]
        if (currentPhase) {
            const subProgress = this.currentTotalSubSteps > 0
                ? Math.min(1, this.currentSubStep / this.currentTotalSubSteps)
                : 0

            completedWeight += currentPhase.weight * subProgress
        }

        if (totalWeight === 0) return 0
        return Math.min(100, Math.round((completedWeight / totalWeight) * 100))
    }

    /**
     * Emit progress update to Redis (fast) and API (persistence)
     */
    private async emit(): Promise<void> {
        const currentPhase = this.phases[this.currentPhaseIndex] || this.phases[this.phases.length - 1]

        const progress: DiagnosisProgress = {
            step: this.currentPhaseIndex + 1,
            totalSteps: this.phases.length,
            stepLabel: currentPhase.label,
            subStepLabel: this.currentSubStepLabel,
            subStep: this.currentSubStep,
            totalSubSteps: this.currentTotalSubSteps,
            percent: this.calculatePercent()
        }

        // 1. Real-time push via Redis
        try {
            await this.redis.publish(this.channelName, JSON.stringify(progress))
        } catch (error) {
            console.warn(`[${this.runId}] Failed to publish progress to Redis:`, error)
        }

        // 2. Persistence via API (fire and forget)
        this.updateApiCallback(this.runId, progress).catch(err => {
            console.warn(`[${this.runId}] Failed to persist progress to API:`, err)
        })
    }
}
