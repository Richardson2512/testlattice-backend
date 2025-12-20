// TraceService - Consolidated trace format for trace viewer
// Creates and manages trace.json with timeline, DOM snapshots, and logs

import { WasabiStorageService, TraceData, TraceStep } from './wasabiStorage'

export interface TraceBuilder {
    runId: string
    url: string
    browser: string
    viewport: string
    startTime: number
    steps: TraceStep[]
    consoleBuffer: string[]
    networkBuffer: Array<{ url: string; method: string; status?: number; timing?: number }>
}

/**
 * TraceService - Build and manage consolidated trace data
 * 
 * Usage:
 *   const trace = traceService.createTrace(runId, url, browser, viewport)
 *   trace.addStep({ action: 'click', selector: '#btn', ... })
 *   await traceService.saveTrace(trace)
 */
export class TraceService {
    private wasabi: WasabiStorageService | null
    private activeTraces: Map<string, TraceBuilder> = new Map()

    constructor(wasabi: WasabiStorageService | null) {
        this.wasabi = wasabi
    }

    /**
     * Create a new trace builder for a test run
     */
    createTrace(
        runId: string,
        url: string,
        browser: string = 'chromium',
        viewport: string = '1280x720'
    ): TraceBuilder {
        const trace: TraceBuilder = {
            runId,
            url,
            browser,
            viewport,
            startTime: Date.now(),
            steps: [],
            consoleBuffer: [],
            networkBuffer: [],
        }

        this.activeTraces.set(runId, trace)
        return trace
    }

    /**
     * Get active trace for a run
     */
    getTrace(runId: string): TraceBuilder | undefined {
        return this.activeTraces.get(runId)
    }

    /**
     * Add a step to the trace
     */
    addStep(
        runId: string,
        step: Omit<TraceStep, 'id' | 'ts' | 'videoOffset'>
    ): TraceStep | null {
        const trace = this.activeTraces.get(runId)
        if (!trace) return null

        const now = Date.now()
        const ts = now - trace.startTime

        const traceStep: TraceStep = {
            id: trace.steps.length + 1,
            ts,
            videoOffset: ts / 1000, // Convert to seconds for video seek
            ...step,
            console: [...trace.consoleBuffer],
            network: [...trace.networkBuffer],
        }

        // Clear buffers after adding to step
        trace.consoleBuffer = []
        trace.networkBuffer = []

        trace.steps.push(traceStep)
        return traceStep
    }

    /**
     * Add console log to current buffer
     */
    addConsoleLog(runId: string, message: string): void {
        const trace = this.activeTraces.get(runId)
        if (trace) {
            trace.consoleBuffer.push(message)
        }
    }

    /**
     * Add network request to current buffer
     */
    addNetworkRequest(
        runId: string,
        request: { url: string; method: string; status?: number; timing?: number }
    ): void {
        const trace = this.activeTraces.get(runId)
        if (trace) {
            trace.networkBuffer.push(request)
        }
    }

    /**
     * Mark trace as failed at specific step
     */
    markFailed(runId: string, stepId: number, error: string, stack?: string): void {
        const trace = this.activeTraces.get(runId)
        if (trace) {
            (trace as any).failure = { stepId, error, stack }
        }
    }

    /**
     * Save trace to Wasabi and cleanup
     */
    async saveTrace(runId: string, status: 'completed' | 'failed' = 'completed'): Promise<string | null> {
        const trace = this.activeTraces.get(runId)
        if (!trace) {
            console.warn(`[TraceService] No active trace for ${runId}`)
            return null
        }

        const now = Date.now()
        const traceData: TraceData = {
            runId: trace.runId,
            url: trace.url,
            startedAt: new Date(trace.startTime).toISOString(),
            completedAt: new Date(now).toISOString(),
            duration: now - trace.startTime,
            status,
            browser: trace.browser,
            viewport: trace.viewport,
            steps: trace.steps,
            failure: (trace as any).failure,
        }

        // Upload to Wasabi
        let traceUrl: string | null = null
        if (this.wasabi) {
            traceUrl = await this.wasabi.uploadTrace(runId, traceData)
        } else {
            console.warn(`[TraceService] Wasabi not configured, trace not uploaded`)
        }

        // Cleanup
        this.activeTraces.delete(runId)

        return traceUrl
    }

    /**
     * Get trace data from Wasabi
     */
    async loadTrace(runId: string): Promise<TraceData | null> {
        if (!this.wasabi) return null
        return this.wasabi.getTrace(runId)
    }

    /**
     * Cancel and cleanup trace without saving
     */
    cancelTrace(runId: string): void {
        this.activeTraces.delete(runId)
    }

    /**
     * Get trace statistics
     */
    getStats(runId: string): { stepCount: number; duration: number } | null {
        const trace = this.activeTraces.get(runId)
        if (!trace) return null

        return {
            stepCount: trace.steps.length,
            duration: Date.now() - trace.startTime,
        }
    }
}

/**
 * Create TraceService instance
 */
export function createTraceService(wasabi: WasabiStorageService | null): TraceService {
    return new TraceService(wasabi)
}
