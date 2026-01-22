/**
 * BehaviorProcessor
 * Main entry point for Bloom-based chatbot/agent testing
 * Orchestrates 5 parallel simulations per behavior
 */

import { ProcessResult } from '../types'
import { SimulationOrchestrator, OrchestratorConfig, OrchestratorDependencies } from './SimulationOrchestrator'
import { BehaviorTestResult } from './types'
import { logger } from '../../observability'
import { UnifiedBrainService } from '../../services/unifiedBrain'

export interface BehaviorJobData {
    runId: string
    projectId?: string
    build: {
        url: string
    }
    options?: {
        behaviors?: string[]
        chatbotSelector?: string
    }
}

export interface BehaviorProcessorDependencies {
    page: any
    redis: any
    storage?: any
}

export class BehaviorProcessor {
    private deps: BehaviorProcessorDependencies

    constructor(deps: BehaviorProcessorDependencies) {
        this.deps = deps
    }

    /**
     * Main entry point for behavior testing
     */
    async process(jobData: BehaviorJobData): Promise<ProcessResult> {
        const { runId, build, options } = jobData
        const behaviors = options?.behaviors || ['general_safety']

        logger.info({
            runId,
            url: build.url,
            behaviors
        }, '🧠 Starting Behavior Analysis')

        try {
            // Navigate to target URL
            await this.deps.page.goto(build.url, {
                waitUntil: 'networkidle',
                timeout: 30000
            })

            // Create orchestrator
            const orchestratorConfig: OrchestratorConfig = {
                runId,
                url: build.url,
                behaviors,
                chatbotSelector: options?.chatbotSelector
            }

            const orchestrator = new SimulationOrchestrator(
                orchestratorConfig,
                {
                    page: this.deps.page,
                    redis: this.deps.redis
                }
            )

            // Run all simulations
            const result = await orchestrator.runAllSimulations()

            // Save results
            if (this.deps.storage) {
                await this.saveResults(runId, result)
            }

            // Notify completion
            await this.notifyComplete(runId, result)

            return {
                success: true,
                steps: this.buildSteps(result),
                artifacts: [],
                stage: 'execution'
            }

        } catch (error: any) {
            logger.error({ runId, error: error.message }, 'Behavior Analysis Failed')

            return {
                success: false,
                steps: [{
                    id: `step_${runId}_error`,
                    stepNumber: 1,
                    action: 'behavior_error',
                    success: false,
                    timestamp: new Date().toISOString(),
                    metadata: { error: error.message },
                    value: error.message
                }],
                artifacts: [],
                stage: 'execution'
            }
        }
    }

    private buildSteps(result: BehaviorTestResult): any[] {
        const steps: any[] = []
        let stepNumber = 1

        for (const sim of result.simulations) {
            steps.push({
                id: `step_${result.runId}_${sim.personaId}`,
                stepNumber: stepNumber++,
                action: 'behavior_simulation',
                success: sim.status === 'complete',
                timestamp: new Date().toISOString(),
                metadata: {
                    persona: sim.personaId,
                    behavior: sim.behavior,
                    score: sim.judgeScoreNormalized,
                    turns: sim.turns.length,
                    status: sim.status
                },
                value: sim.summary
            })
        }

        // Add aggregate step
        steps.push({
            id: `step_${result.runId}_aggregate`,
            stepNumber: stepNumber,
            action: 'behavior_aggregate',
            success: true,
            timestamp: new Date().toISOString(),
            metadata: {
                aggregateScore: result.aggregateScore,
                totalTurns: result.totalTurns,
                completedSimulations: result.completedSimulations,
                duration: result.duration
            },
            value: `Aggregate score: ${result.aggregateScore}/100`
        })

        return steps
    }

    private async saveResults(runId: string, result: BehaviorTestResult): Promise<void> {
        try {
            await this.deps.storage.uploadJson(
                `behavior/${runId}/result.json`,
                result
            )
        } catch (e: any) {
            logger.warn({ runId, error: e.message }, 'Failed to save behavior results')
        }
    }

    private async notifyComplete(runId: string, result: BehaviorTestResult): Promise<void> {
        try {
            await this.deps.redis.publish('ws:broadcast', JSON.stringify({
                runId,
                serverId: 'worker',
                payload: {
                    type: 'behavior_complete',
                    aggregateScore: result.aggregateScore,
                    completedSimulations: result.completedSimulations,
                    duration: result.duration,
                    timestamp: new Date().toISOString()
                }
            }))
        } catch (e) {
            // Ignore broadcast errors
        }
    }
}
