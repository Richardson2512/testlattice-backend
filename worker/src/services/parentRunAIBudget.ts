/**
 * Parent Run AI Budget
 * 
 * Tracks AI call budget per parent test run (shared across all browser runs).
 * Enforces limits and manages degradation state.
 */

export type AIBudgetState = 'NORMAL' | 'DEGRADED' | 'EXHAUSTED'
export type UserTier = 'guest' | 'starter' | 'indie' | 'pro' | 'agency'

export interface ParentRunAIBudget {
  parentRunId: string
  tier: UserTier
  maxLLMCalls: number
  maxVisionCalls: number
  usedLLMCalls: number
  usedVisionCalls: number
  state: AIBudgetState
  rateLimitHits: number
  createdAt: number
  lastUpdated: number
  initialized: boolean // Track if initialization was logged
}

/**
 * Tier-aware AI budget limits
 */
export const TIER_AI_BUDGETS: Record<UserTier, { maxLLMCalls: number; maxVisionCalls: number }> = {
  guest: { maxLLMCalls: 10, maxVisionCalls: 1 },
  starter: { maxLLMCalls: 15, maxVisionCalls: 2 },
  indie: { maxLLMCalls: 20, maxVisionCalls: 3 },
  pro: { maxLLMCalls: 30, maxVisionCalls: 5 },
  agency: { maxLLMCalls: 30, maxVisionCalls: 5 }, // Same as Pro
}

/**
 * Global budget store (in-memory, per parent run)
 * Keyed by parentRunId
 */
const budgetStore = new Map<string, ParentRunAIBudget>()

/**
 * Get or create budget for a parent run with tier-aware limits
 */
export function getOrCreateBudget(
  parentRunId: string,
  tier: UserTier = 'guest',
  maxLLMCalls?: number,
  maxVisionCalls?: number
): ParentRunAIBudget {
  const existing = budgetStore.get(parentRunId)
  if (existing) {
    return existing
  }

  // Use tier-based defaults if not provided
  const tierBudget = TIER_AI_BUDGETS[tier]
  const finalMaxLLM = maxLLMCalls ?? tierBudget.maxLLMCalls
  const finalMaxVision = maxVisionCalls ?? tierBudget.maxVisionCalls

  const budget: ParentRunAIBudget = {
    parentRunId,
    tier,
    maxLLMCalls: finalMaxLLM,
    maxVisionCalls: finalMaxVision,
    usedLLMCalls: 0,
    usedVisionCalls: 0,
    state: 'NORMAL',
    rateLimitHits: 0,
    createdAt: Date.now(),
    lastUpdated: Date.now(),
    initialized: false,
  }

  budgetStore.set(parentRunId, budget)
  return budget
}

/**
 * Restore budget from snapshot (for worker restart recovery)
 */
export function restoreBudgetFromSnapshot(
  parentRunId: string,
  snapshot: Partial<ParentRunAIBudget>
): ParentRunAIBudget | null {
  // Only restore if snapshot is valid
  if (!snapshot.parentRunId || !snapshot.tier) {
    return null
  }

  const tierBudget = TIER_AI_BUDGETS[snapshot.tier]
  if (!tierBudget) {
    return null
  }

  // Restore with conservative limits (use snapshot values if valid, otherwise tier defaults)
  const budget: ParentRunAIBudget = {
    parentRunId: snapshot.parentRunId,
    tier: snapshot.tier,
    maxLLMCalls: snapshot.maxLLMCalls ?? tierBudget.maxLLMCalls,
    maxVisionCalls: snapshot.maxVisionCalls ?? tierBudget.maxVisionCalls,
    usedLLMCalls: snapshot.usedLLMCalls ?? 0,
    usedVisionCalls: snapshot.usedVisionCalls ?? 0,
    state: snapshot.state ?? 'NORMAL',
    rateLimitHits: snapshot.rateLimitHits ?? 0,
    createdAt: snapshot.createdAt ?? Date.now(),
    lastUpdated: Date.now(),
    initialized: true, // Mark as initialized to skip init log
  }

  // Recalculate state based on current usage
  updateBudgetState(budget)

  budgetStore.set(parentRunId, budget)
  return budget
}

/**
 * Get budget snapshot for persistence
 */
export function getBudgetSnapshot(parentRunId: string): Partial<ParentRunAIBudget> | null {
  const budget = getBudget(parentRunId)
  if (!budget) return null

  return {
    parentRunId: budget.parentRunId,
    tier: budget.tier,
    maxLLMCalls: budget.maxLLMCalls,
    maxVisionCalls: budget.maxVisionCalls,
    usedLLMCalls: budget.usedLLMCalls,
    usedVisionCalls: budget.usedVisionCalls,
    state: budget.state,
    rateLimitHits: budget.rateLimitHits,
    createdAt: budget.createdAt,
    lastUpdated: budget.lastUpdated,
  }
}

/**
 * Get budget for a parent run (returns null if not found)
 */
export function getBudget(parentRunId: string): ParentRunAIBudget | null {
  return budgetStore.get(parentRunId) || null
}

/**
 * Check if LLM call is allowed
 */
export function canMakeLLMCall(parentRunId: string): boolean {
  const budget = getBudget(parentRunId)
  if (!budget) return true // No budget = allow (backward compatibility)

  // If exhausted, no calls allowed
  if (budget.state === 'EXHAUSTED') {
    return false
  }

  // Check if we've exceeded the limit
  if (budget.usedLLMCalls >= budget.maxLLMCalls) {
    return false
  }

  return true
}

/**
 * Check if Vision call is allowed
 * @param parentRunId Parent run ID
 * @param isCritical If true, allows call even if budget exhausted (uses remaining budget)
 */
export function canMakeVisionCall(parentRunId: string, isCritical: boolean = false): boolean {
  const budget = getBudget(parentRunId)
  if (!budget) return true // No budget = allow (backward compatibility)

  // Critical vision calls can use remaining budget even if exhausted
  if (isCritical && budget.usedVisionCalls < budget.maxVisionCalls) {
    return true
  }

  // If exhausted, no calls allowed (unless critical)
  if (budget.state === 'EXHAUSTED' && !isCritical) {
    return false
  }

  // Check if we've exceeded the limit
  if (budget.usedVisionCalls >= budget.maxVisionCalls) {
    return false
  }

  return true
}

/**
 * Record an LLM call
 */
export function recordLLMCall(parentRunId: string): void {
  const budget = getBudget(parentRunId)
  if (!budget) return

  budget.usedLLMCalls++
  budget.lastUpdated = Date.now()

  // Update state based on usage
  updateBudgetState(budget)
}

/**
 * Record a Vision call
 */
export function recordVisionCall(parentRunId: string): void {
  const budget = getBudget(parentRunId)
  if (!budget) return

  budget.usedVisionCalls++
  budget.lastUpdated = Date.now()

  // Update state based on usage
  updateBudgetState(budget)
}

/**
 * Record a rate limit hit
 */
export function recordRateLimitHit(parentRunId: string): void {
  const budget = getBudget(parentRunId)
  if (!budget) return

  budget.rateLimitHits++
  budget.lastUpdated = Date.now()

  // If we hit rate limits, degrade
  if (budget.rateLimitHits >= 2) {
    budget.state = 'DEGRADED'
  }
}

/**
 * Update budget state based on usage
 */
function updateBudgetState(budget: ParentRunAIBudget): void {
  const llmUsagePercent = (budget.usedLLMCalls / budget.maxLLMCalls) * 100
  const visionExhausted = budget.usedVisionCalls >= budget.maxVisionCalls
  const llmExhausted = budget.usedLLMCalls >= budget.maxLLMCalls

  if (llmExhausted || visionExhausted) {
    budget.state = 'EXHAUSTED'
  } else if (llmUsagePercent >= 70 || budget.rateLimitHits >= 1) {
    budget.state = 'DEGRADED'
  } else {
    budget.state = 'NORMAL'
  }
}

/**
 * Check if budget is in degraded state
 */
export function isDegraded(parentRunId: string): boolean {
  const budget = getBudget(parentRunId)
  if (!budget) return false
  return budget.state === 'DEGRADED'
}

/**
 * Check if budget is exhausted
 */
export function isExhausted(parentRunId: string): boolean {
  const budget = getBudget(parentRunId)
  if (!budget) return false
  return budget.state === 'EXHAUSTED'
}

/**
 * Get budget state
 */
export function getBudgetState(parentRunId: string): AIBudgetState {
  const budget = getBudget(parentRunId)
  if (!budget) return 'NORMAL'
  return budget.state
}

/**
 * Get budget summary for logging
 */
export function getBudgetSummary(parentRunId: string): {
  state: AIBudgetState
  tier: UserTier
  llmUsage: { used: number; max: number; percent: number }
  visionUsage: { used: number; max: number; percent: number }
  rateLimitHits: number
} | null {
  const budget = getBudget(parentRunId)
  if (!budget) return null

  return {
    state: budget.state,
    tier: budget.tier,
    llmUsage: {
      used: budget.usedLLMCalls,
      max: budget.maxLLMCalls,
      percent: (budget.usedLLMCalls / budget.maxLLMCalls) * 100,
    },
    visionUsage: {
      used: budget.usedVisionCalls,
      max: budget.maxVisionCalls,
      percent: (budget.usedVisionCalls / budget.maxVisionCalls) * 100,
    },
    rateLimitHits: budget.rateLimitHits,
  }
}

/**
 * Mark budget as initialized (prevents duplicate init logs)
 */
export function markBudgetInitialized(parentRunId: string): void {
  const budget = getBudget(parentRunId)
  if (budget) {
    budget.initialized = true
  }
}

/**
 * Check if budget is initialized
 */
export function isBudgetInitialized(parentRunId: string): boolean {
  const budget = getBudget(parentRunId)
  return budget?.initialized ?? false
}

/**
 * Clear budget for a parent run (cleanup)
 */
export function clearBudget(parentRunId: string): void {
  budgetStore.delete(parentRunId)
}

/**
 * Clear all budgets (for testing/cleanup)
 */
export function clearAllBudgets(): void {
  budgetStore.clear()
}

