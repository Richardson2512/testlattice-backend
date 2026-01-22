
import { AIStrategy, StrategyTask, StrategyResult } from './types'
import { ModelClient } from '../../unifiedBrain/ModelClient'
import { LLMAction } from '../../../types'

export class LLMStrategy implements AIStrategy {
    name = 'LLM (Generative AI)'

    constructor(private modelClient: ModelClient) { }

    canHandle(task: StrategyTask): boolean {
        return true // Can handle anything (Fall-through)
    }

    estimateCost(task: StrategyTask): number {
        return 10 // Expensive
    }

    async execute(task: StrategyTask): Promise<StrategyResult> {
        try {
            // Map StrategyTask back to what ModelClient expects
            // This is bridging the new architecture to the existing logic
            // For now, we are primarily wrapping the 'analyze' or 'action' generation

            if (task.type === 'action') {
                // This would call unifiedBrain.generateAction logic (which uses modelClient)
                // But for the sake of this strategy, we might invoke modelClient directly if we had the prompt
                // Refactoring note: Ideally, UnifiedBrainService's logic moves HERE.
                // For this first step, we simply wrap a direct call if params are provided.

                // Placeholder: In a full refactor, this strategy would contain the prompt construction logic
                return {
                    success: false,
                    confidence: 0,
                    data: null,
                    strategyUsed: this.name, // Not fully implemented yet
                }
            }

            // For Analysis tasks (Verification, Synthesis)
            if (task.type === 'analyze' || task.type === 'verify') {
                const prompt = `Goal: ${task.goal}\n\nAnalyze the provided context and provide a JSON response.`
                const systemPrompt = "You are an automated testing assistant."

                // Use existing ModelClient
                // Note: We'd need to properly reconstruct the prompt here.
                // This is a minimal implementation to satisfy the interface.
                const result = await this.modelClient.call(prompt, systemPrompt, 'analyze')

                return {
                    success: true,
                    confidence: 0.8, // Default
                    data: JSON.parse(result.content),
                    strategyUsed: this.name
                }
            }

            return {
                success: false,
                data: null,
                confidence: 0,
                strategyUsed: this.name
            }

        } catch (e: any) {
            return {
                success: false,
                data: { error: e.message },
                confidence: 0,
                strategyUsed: this.name
            }
        }
    }
}
