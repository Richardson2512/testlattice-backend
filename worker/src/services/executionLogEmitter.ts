/**
 * ExecutionLogEmitter - First-class execution logging system
 * 
 * Execution logs are NOT debug logs. They are a PRODUCT FEATURE.
 * 
 * Rules:
 * - Every meaningful action MUST log intent
 * - No silent steps
 * - No swallowed transitions
 * - Logs are user-visible and persisted with test runs
 */

export interface ExecutionLogEntry {
  timestamp: string
  message: string
  metadata?: Record<string, any>
  context?: string
  stepNumber?: number
}

export interface ExecutionLogEmitter {
  log(message: string, metadata?: Record<string, any>): void
  getLogs(): ExecutionLogEntry[]
  clear(): void
}

/**
 * In-memory execution log emitter
 * Logs are persisted via the test run's step metadata
 */
export class MemoryExecutionLogEmitter implements ExecutionLogEmitter {
  private logs: ExecutionLogEntry[] = []
  private runId: string
  private stepNumber?: number

  constructor(runId: string, stepNumber?: number) {
    this.runId = runId
    this.stepNumber = stepNumber
  }

  log(message: string, metadata?: Record<string, any>): void {
    const entry: ExecutionLogEntry = {
      timestamp: new Date().toISOString(),
      message,
      metadata,
      context: this.runId,
      stepNumber: this.stepNumber,
    }
    this.logs.push(entry)
    
    // Also emit to console for immediate visibility
    const metadataStr = metadata ? ` ${JSON.stringify(metadata)}` : ''
    console.log(`[ExecutionLog] [${this.runId}]${this.stepNumber ? ` [Step ${this.stepNumber}]` : ''} ${message}${metadataStr}`)
  }

  getLogs(): ExecutionLogEntry[] {
    return [...this.logs]
  }

  clear(): void {
    this.logs = []
  }

  setStepNumber(stepNumber: number): void {
    this.stepNumber = stepNumber
  }
}

/**
 * Global execution log emitter factory
 * Creates emitters scoped to test runs
 */
const executionLogEmitters = new Map<string, MemoryExecutionLogEmitter>()

export function getExecutionLogEmitter(runId: string, stepNumber?: number): ExecutionLogEmitter {
  if (!executionLogEmitters.has(runId)) {
    executionLogEmitters.set(runId, new MemoryExecutionLogEmitter(runId, stepNumber))
  }
  const emitter = executionLogEmitters.get(runId)!
  if (stepNumber !== undefined) {
    emitter.setStepNumber(stepNumber)
  }
  return emitter
}

export function clearExecutionLogEmitter(runId: string): void {
  executionLogEmitters.delete(runId)
}

