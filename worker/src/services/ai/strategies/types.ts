
import { LLMAction, VisionContext } from '../../../types'

export interface StrategyTask {
    type: 'analyze' | 'action' | 'verify'
    goal: string
    context: VisionContext
    history?: any[]
    params?: any
}

export interface StrategyResult {
    success: boolean
    data: any
    confidence: number
    strategyUsed: string
    cost?: number
    latency?: number
}

export interface AIStrategy {
    name: string

    /**
     * Quick check (0ms-1ms) to see if this strategy MIGHT apply.
     * e.g. Regex checks for keywords in the goal.
     */
    canHandle(task: StrategyTask): boolean

    /**
     * Estimate cost to run this strategy (for the router).
     * 0 = Free, 1 = Cheap (Mini), 10 = Expensive (GPT-4o)
     */
    estimateCost(task: StrategyTask): number

    /**
     * Execute the strategy. 
     */
    execute(task: StrategyTask): Promise<StrategyResult>
}
