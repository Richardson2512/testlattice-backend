/**
 * ExecutionLogEmitter - Captures and emits step execution logs
 * Used by AI execution calls to track and persist execution logs
 */

interface ExecutionLog {
    timestamp: string
    type: 'info' | 'warn' | 'error' | 'debug'
    message: string
    data?: any
}

class ExecutionLogEmitter {
    private runId: string
    private stepNumber: number
    private logs: ExecutionLog[] = []

    constructor(runId: string, stepNumber: number) {
        this.runId = runId
        this.stepNumber = stepNumber
    }

    log(message: string, data?: any): void {
        this.logs.push({
            timestamp: new Date().toISOString(),
            type: 'info',
            message,
            data
        })
    }

    warn(message: string, data?: any): void {
        this.logs.push({
            timestamp: new Date().toISOString(),
            type: 'warn',
            message,
            data
        })
    }

    error(message: string, data?: any): void {
        this.logs.push({
            timestamp: new Date().toISOString(),
            type: 'error',
            message,
            data
        })
    }

    debug(message: string, data?: any): void {
        this.logs.push({
            timestamp: new Date().toISOString(),
            type: 'debug',
            message,
            data
        })
    }

    getLogs(): ExecutionLog[] {
        return [...this.logs]
    }

    clear(): void {
        this.logs = []
    }
}

// Cache emitters by runId-stepNumber to avoid recreating
const emitterCache = new Map<string, ExecutionLogEmitter>()

/**
 * Get or create an execution log emitter for a specific run and step
 */
export function getExecutionLogEmitter(runId: string, stepNumber: number): ExecutionLogEmitter {
    const key = `${runId}-${stepNumber}`

    if (!emitterCache.has(key)) {
        emitterCache.set(key, new ExecutionLogEmitter(runId, stepNumber))
    }

    return emitterCache.get(key)!
}

/**
 * Clear cached emitter for a run-step (cleanup after step completion)
 */
export function clearExecutionLogEmitter(runId: string, stepNumber: number): void {
    const key = `${runId}-${stepNumber}`
    emitterCache.delete(key)
}

/**
 * Clear all cached emitters for a run (cleanup after run completion)
 */
export function clearAllEmittersForRun(runId: string): void {
    for (const key of emitterCache.keys()) {
        if (key.startsWith(`${runId}-`)) {
            emitterCache.delete(key)
        }
    }
}

export { ExecutionLogEmitter, ExecutionLog }
