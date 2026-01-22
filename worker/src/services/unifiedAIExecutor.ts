/**
 * Unified AI Executor
 * 
 * Centralizes ALL AI calls (GPT-5 Mini and GPT-4o) with:
 * - Parent-run budget enforcement
 * - Serialization per parent run
 * - Graceful degradation
 * - Strict 429 handling
 * - User-visible logging
 */

import { UnifiedBrainService } from './unifiedBrain'
import { VisionValidatorService } from './visionValidator'
import {
  getOrCreateBudget,
  canMakeLLMCall,
  canMakeVisionCall,
  recordLLMCall,
  recordVisionCall,
  recordRateLimitHit,
  isDegraded,
  isExhausted,
  getBudgetState,
  getBudgetSummary,
  getBudgetSnapshot,
  markBudgetInitialized,
  isBudgetInitialized,
  type AIBudgetState,
  type UserTier,
} from './parentRunAIBudget'
import { ExecutionLogEmitter } from './executionLogEmitter'

export type AICallType = 'llm' | 'vision'
export type AICallPriority = 'critical' | 'normal' | 'optional'

/**
 * Vision call priority classification
 */
export enum VisionPriority {
  CRITICAL = 'CRITICAL',
  OPTIONAL = 'OPTIONAL',
}

export interface AICallOptions {
  parentRunId: string
  runId: string
  stepNumber: number
  callType: AICallType
  priority: AICallPriority
  description: string
  logEmitter?: ExecutionLogEmitter
  tier?: UserTier
  visionPriority?: VisionPriority // For vision calls only
}

export interface AICallResult<T> {
  success: boolean
  result?: T
  error?: string
  skipped: boolean
  reason?: string
  budgetState?: AIBudgetState
}

/**
 * Async mutex per parent run for serialization
 */
class ParentRunMutex {
  private queues = new Map<string, Array<() => Promise<void>>>()
  private running = new Map<string, boolean>()

  async acquire(parentRunId: string): Promise<() => void> {
    return new Promise((resolve) => {
      if (!this.running.get(parentRunId)) {
        this.running.set(parentRunId, true)
        resolve(() => {
          this.running.set(parentRunId, false)
          this.processNext(parentRunId)
        })
        return
      }

      // Queue this call
      if (!this.queues.has(parentRunId)) {
        this.queues.set(parentRunId, [])
      }

      this.queues.get(parentRunId)!.push(async () => {
        this.running.set(parentRunId, true)
        const release = () => {
          this.running.set(parentRunId, false)
          this.processNext(parentRunId)
        }
        resolve(release)
      })
    })
  }

  private processNext(parentRunId: string): void {
    const queue = this.queues.get(parentRunId)
    if (!queue || queue.length === 0) {
      return
    }

    const next = queue.shift()!
    next()
  }
}

const mutex = new ParentRunMutex()

/**
 * Unified AI Executor
 * 
 * All AI calls must go through this service.
 */
export class UnifiedAIExecutor {
  constructor(
    private unifiedBrain: UnifiedBrainService,
    private visionValidator: VisionValidatorService | null
  ) {}

  /**
   * Execute an LLM call (GPT-5 Mini)
   */
  async executeLLMCall<T>(
    fn: () => Promise<T>,
    options: AICallOptions
  ): Promise<AICallResult<T>> {
    const { parentRunId, runId, stepNumber, priority, description, logEmitter, tier = 'guest' } = options

    // Get or create budget with tier-aware limits
    const budget = getOrCreateBudget(parentRunId, tier)
    
    // Log initialization once per run
    if (!isBudgetInitialized(parentRunId) && logEmitter) {
      const summary = getBudgetSummary(parentRunId)
      if (summary) {
        logEmitter.log(
          `AI budget initialized: ${tier} tier, LLM=${summary.llmUsage.max}, Vision=${summary.visionUsage.max}`,
          { tier, budget: summary }
        )
        markBudgetInitialized(parentRunId)
      }
    }

    // Check if call is allowed
    if (!canMakeLLMCall(parentRunId)) {
      const state = getBudgetState(parentRunId)
      const summary = getBudgetSummary(parentRunId)
      
      if (logEmitter) {
        logEmitter.log(
          `AI call skipped: ${description}. Budget exhausted (${summary?.llmUsage.used}/${summary?.llmUsage.max} LLM calls used).`,
          { budgetState: state, priority }
        )
      }

      // In degraded/exhausted state, skip optional calls
      if (priority === 'optional') {
        return {
          success: false,
          skipped: true,
          reason: 'Budget exhausted, optional call skipped',
          budgetState: state,
        }
      }

      // For critical calls, try deterministic fallback
      return this.handleExhaustedCall<T>(description, logEmitter, state)
    }

    // Check if we should skip due to degradation
    if (isDegraded(parentRunId) && priority === 'optional') {
      if (logEmitter) {
        logEmitter.log(
          `AI call skipped: ${description}. AI capacity limited, skipping optional step.`,
          { budgetState: 'DEGRADED', priority }
        )
      }
      return {
        success: false,
        skipped: true,
        reason: 'Degraded state, optional call skipped',
        budgetState: 'DEGRADED',
      }
    }

    // Acquire mutex for this parent run
    const release = await mutex.acquire(parentRunId)

    try {
      // Add jitter between calls (100-300ms)
      const jitter = 100 + Math.random() * 200
      await new Promise(resolve => setTimeout(resolve, jitter))

      // Double-check budget after acquiring mutex
      if (!canMakeLLMCall(parentRunId)) {
        const state = getBudgetState(parentRunId)
        if (logEmitter) {
          logEmitter.log(
            `AI call skipped: ${description}. Budget exhausted while queued.`,
            { budgetState: state }
          )
        }
        return this.handleExhaustedCall<T>(description, logEmitter, state)
      }

      if (logEmitter) {
        logEmitter.log(`Executing AI call: ${description}`, { priority })
      }

      // Execute the call with 429 handling
      const result = await this.executeWith429Handling(
        fn,
        parentRunId,
        description,
        logEmitter
      )

      // Record the call
      recordLLMCall(parentRunId)

      const state = getBudgetState(parentRunId)
      const summary = getBudgetSummary(parentRunId)

      if (logEmitter && summary) {
        if (state === 'DEGRADED') {
          logEmitter.log(
            `AI capacity limited (${summary.llmUsage.percent.toFixed(0)}% used). Continuing with reduced intelligence.`,
            { budgetState: state }
          )
        }
      }

      return {
        success: true,
        result,
        skipped: false,
        budgetState: state,
      }
    } catch (error: any) {
      const state = getBudgetState(parentRunId)
      
      if (logEmitter) {
        logEmitter.log(
          `AI call failed: ${description}. ${error.message}`,
          { error: error.message, budgetState: state }
        )
      }

      // Don't throw - return error result
      return {
        success: false,
        error: error.message,
        skipped: false,
        budgetState: state,
      }
    } finally {
      release()
    }
  }

  /**
   * Execute a Vision call (GPT-4o)
   */
  async executeVisionCall<T>(
    fn: () => Promise<T>,
    options: AICallOptions
  ): Promise<AICallResult<T>> {
    const { parentRunId, runId, stepNumber, priority, description, logEmitter, tier = 'guest', visionPriority = VisionPriority.OPTIONAL } = options

    // Get or create budget with tier-aware limits
    const budget = getOrCreateBudget(parentRunId, tier)
    
    // Log initialization once per run
    if (!isBudgetInitialized(parentRunId) && logEmitter) {
      const summary = getBudgetSummary(parentRunId)
      if (summary) {
        logEmitter.log(
          `AI budget initialized: ${tier} tier, LLM=${summary.llmUsage.max}, Vision=${summary.visionUsage.max}`,
          { tier, budget: summary }
        )
        markBudgetInitialized(parentRunId)
      }
    }

    // Check if call is allowed (critical vision can use remaining budget)
    const isCritical = visionPriority === VisionPriority.CRITICAL
    if (!canMakeVisionCall(parentRunId, isCritical)) {
      const state = getBudgetState(parentRunId)
      const summary = getBudgetSummary(parentRunId)
      
      if (logEmitter) {
        if (isCritical) {
          logEmitter.log(
            `Critical vision call blocked: ${description}. Budget fully exhausted.`,
            { budgetState: state, priority: 'critical' }
          )
        } else {
          logEmitter.log(
            `Optional vision call skipped: ${description}. Budget exhausted (${summary?.visionUsage.used}/${summary?.visionUsage.max} vision calls used).`,
            { budgetState: state, priority: 'optional' }
          )
        }
      }

      return {
        success: false,
        skipped: true,
        reason: isCritical ? 'Vision budget fully exhausted' : 'Optional vision budget exhausted',
        budgetState: state,
      }
    }

    // Check if we should skip due to degradation
    if (isDegraded(parentRunId) && priority === 'optional') {
      if (logEmitter) {
        logEmitter.log(
          `Vision call skipped: ${description}. AI capacity limited, skipping optional step.`,
          { budgetState: 'DEGRADED', priority }
        )
      }
      return {
        success: false,
        skipped: true,
        reason: 'Degraded state, optional call skipped',
        budgetState: 'DEGRADED',
      }
    }

    // Acquire mutex for this parent run
    const release = await mutex.acquire(parentRunId)

    try {
      // Add jitter between calls (100-300ms)
      const jitter = 100 + Math.random() * 200
      await new Promise(resolve => setTimeout(resolve, jitter))

      // Double-check budget after acquiring mutex
      if (!canMakeVisionCall(parentRunId, isCritical)) {
        const state = getBudgetState(parentRunId)
        if (logEmitter) {
          if (isCritical) {
            logEmitter.log(
              `Critical vision call blocked: ${description}. Budget exhausted while queued.`,
              { budgetState: state }
            )
          } else {
            logEmitter.log(
              `Optional vision call skipped: ${description}. Budget exhausted while queued.`,
              { budgetState: state }
            )
          }
        }
        return {
          success: false,
          skipped: true,
          reason: isCritical ? 'Vision budget fully exhausted while queued' : 'Optional vision budget exhausted while queued',
          budgetState: state,
        }
      }

      if (logEmitter) {
        logEmitter.log(`Executing vision call: ${description}`, { priority })
      }

      // Execute the call with 429 handling
      const result = await this.executeWith429Handling(
        fn,
        parentRunId,
        description,
        logEmitter
      )

      // Record the call
      recordVisionCall(parentRunId)

      const state = getBudgetState(parentRunId)

      return {
        success: true,
        result,
        skipped: false,
        budgetState: state,
      }
    } catch (error: any) {
      const state = getBudgetState(parentRunId)
      
      if (logEmitter) {
        logEmitter.log(
          `Vision call failed: ${description}. ${error.message}`,
          { error: error.message, budgetState: state }
        )
      }

      // Don't throw - return error result
      return {
        success: false,
        error: error.message,
        skipped: false,
        budgetState: state,
      }
    } finally {
      release()
    }
  }

  /**
   * Execute with strict 429 handling (max one retry)
   */
  private async executeWith429Handling<T>(
    fn: () => Promise<T>,
    parentRunId: string,
    description: string,
    logEmitter?: ExecutionLogEmitter
  ): Promise<T> {
    try {
      return await fn()
    } catch (error: any) {
      // Check if it's a 429 error
      const is429 = error.response?.status === 429 || 
                   error.message?.includes('429') ||
                   error.message?.toLowerCase().includes('rate limit')

      if (is429) {
        // Record rate limit hit
        recordRateLimitHit(parentRunId)

        if (logEmitter) {
          logEmitter.log(
            `Rate limit hit (429) for: ${description}. Retrying once with backoff.`,
            { retry: true }
          )
        }

        // ONE retry with exponential backoff + jitter
        const baseDelay = 500
        const backoff = baseDelay * Math.pow(2, 1) // 1000ms
        const jitter = Math.random() * 500 // 0-500ms
        const delay = backoff + jitter

        await new Promise(resolve => setTimeout(resolve, delay))

        try {
          return await fn()
        } catch (retryError: any) {
          // Retry failed - mark as degraded and return error
          if (logEmitter) {
            logEmitter.log(
              `AI call failed after retry: ${description}. Falling back to deterministic logic.`,
              { error: retryError.message }
            )
          }
          throw retryError
        }
      }

      // Not a 429 - rethrow
      throw error
    }
  }

  /**
   * Handle exhausted budget - return deterministic fallback
   */
  private handleExhaustedCall<T>(
    description: string,
    logEmitter?: ExecutionLogEmitter,
    state?: AIBudgetState
  ): AICallResult<T> {
    if (logEmitter) {
      logEmitter.log(
        `AI capacity exhausted. Continuing with deterministic logic for: ${description}`,
        { budgetState: state || 'EXHAUSTED' }
      )
    }

    // Return skipped result - caller should use deterministic fallback
    return {
      success: false,
      skipped: true,
      reason: 'Budget exhausted, using deterministic fallback',
      budgetState: state || 'EXHAUSTED',
    }
  }

  /**
   * Get budget summary for a parent run
   */
  getBudgetSummary(parentRunId: string) {
    return getBudgetSummary(parentRunId)
  }

  /**
   * Get budget snapshot for persistence
   */
  getBudgetSnapshot(parentRunId: string) {
    return getBudgetSnapshot(parentRunId)
  }
}

