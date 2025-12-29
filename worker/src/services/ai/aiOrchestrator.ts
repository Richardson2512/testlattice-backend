
import { AIStrategy, StrategyTask, StrategyResult } from './strategies/types'
import { StaticAnalysisStrategy } from './strategies/staticAnalysisStrategy'
import { LLMStrategy } from './strategies/llmStrategy'
import { BehaviorStrategy } from './strategies/behaviorStrategy'
import { ModelClient } from '../unifiedBrain/ModelClient'

export class AIOrchestrator {
    private strategies: AIStrategy[]

    constructor(modelClient: ModelClient) {
        // Order matters! Cheapest first.
        this.strategies = [
            new StaticAnalysisStrategy(),
            new BehaviorStrategy(modelClient), // Specialized checker
            new LLMStrategy(modelClient)
        ]
    }

    /**
     * The Brain of the operation.
     * Routes the task to the cheapest strategy that can handle it.
     * Implements the "Waterfall" fallback logic.
     */
    async execute(task: StrategyTask): Promise<StrategyResult> {
        const startTime = Date.now()

        // 1. Iterate through strategies in order
        for (const strategy of this.strategies) {

            // Quick check if strategy applies
            if (strategy.canHandle(task)) {

                try {
                    // Execute
                    // For StaticAnalysis, this is <1ms
                    const result = await strategy.execute(task)

                    // If strategy succeeded (confident result), return it
                    if (result.success && result.confidence > 0.8) {
                        return {
                            ...result,
                            latency: Date.now() - startTime
                        }
                    }

                    // If strategy returned success=false or low confidence, 
                    // we FALL THROUGH to the next strategy (The Waterfall)
                    // This is the "Fail Open" mechanism requested by user.

                } catch (e) {
                    // Safety net: If a strategy crashes, log it and continue to next
                    console.warn(`Strategy ${strategy.name} failed:`, e)
                }
            }
        }

        // If all strategies fail
        return {
            success: false,
            confidence: 0,
            data: { error: 'No strategy could complete the task' },
            strategyUsed: 'None',
            latency: Date.now() - startTime
        }
    }
}
