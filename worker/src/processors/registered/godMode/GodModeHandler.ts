/**
 * GodModeHandler
 * Handles manual action injection (God Mode) for Registered tests
 * Supports learning from user interventions
 */

import { LLMAction } from '../../../types'
import { LearningService } from '../../../services/learningService'
import { logger } from '../../../observability'

export interface GodModeConfig {
    apiUrl: string
}

export interface GodModeResult {
    action: LLMAction
    godModeEvent?: any
}

export class GodModeHandler {
    private config: GodModeConfig

    constructor(config: GodModeConfig) {
        this.config = config
    }

    /**
     * Check for manual actions (God Mode) from API
     * Returns the first queued manual action if available
     */
    async checkForManualAction(runId: string): Promise<GodModeResult | null> {
        try {
            const fetch = (await import('node-fetch')).default
            const response = await fetch(`${this.config.apiUrl}/api/tests/${runId}/manual-actions`)

            if (!response.ok) {
                return null
            }

            const data = await response.json() as { actions?: any[] }
            const actions = data.actions || []

            if (actions.length > 0) {
                const manualAction = actions[0]
                logger.info({
                    runId,
                    action: manualAction.action,
                    target: manualAction.selector || manualAction.target
                }, '🎮 GOD MODE: Manual action queued')

                const llmAction: LLMAction = {
                    action: manualAction.action,
                    selector: manualAction.selector,
                    target: manualAction.target,
                    value: manualAction.value,
                    description: manualAction.description || `Manual action: ${manualAction.action}`,
                    confidence: 1.0 // Manual actions have 100% confidence
                }

                return {
                    action: llmAction,
                    godModeEvent: manualAction.godModeEvent
                }
            }

            return null
        } catch (error: any) {
            if (error.message && !error.message.includes('ECONNREFUSED')) {
                logger.warn({ runId, error: error.message }, 'Failed to check for manual actions')
            }
            return null
        }
    }

    /**
     * Learn from manual action (God Mode Memory)
     * Captures DOM snapshots and creates heuristic record
     */
    async learnFromManualAction(params: {
        runId: string
        projectId: string | undefined
        stepId: string
        godModeEvent: any
        page: any // Playwright Page
        action: LLMAction
    }): Promise<void> {
        const { runId, projectId, stepId, godModeEvent, page, action } = params

        if (!projectId || !godModeEvent?.metadata?.isTeachingMoment) {
            return // Not a teaching moment, skip learning
        }

        try {
            const learningService = new LearningService(this.config.apiUrl)

            // Capture DOM snapshots if not already captured
            let domBefore = godModeEvent.interaction.domSnapshotBefore
            let domAfter = godModeEvent.interaction.domSnapshotAfter

            if (!domBefore) {
                domBefore = await page.content().catch(() => undefined)
            }

            // Wait for DOM to settle
            await this.delay(500)

            if (!domAfter) {
                domAfter = await page.content().catch(() => undefined)
            }

            // Update God Mode event with captured snapshots
            const enhancedEvent = {
                ...godModeEvent,
                runId,
                stepId,
                interaction: {
                    ...godModeEvent.interaction,
                    domSnapshotBefore: domBefore,
                    domSnapshotAfter: domAfter,
                }
            }

            // Create heuristic from interaction
            const heuristic = await learningService.createHeuristicFromInteraction(
                enhancedEvent,
                projectId,
                page
            )

            // Store heuristic
            await learningService.storeHeuristic(heuristic)

            logger.info({
                runId,
                componentHash: heuristic.componentHash.substring(0, 8)
            }, '🧠 Learned action from God Mode intervention')
        } catch (error: any) {
            logger.warn({ runId, error: error.message }, 'Failed to learn from manual action')
            // Non-critical, don't throw
        }
    }

    /**
     * Acknowledge a manual action was executed
     */
    async acknowledgeManualAction(runId: string, actionId: string): Promise<void> {
        try {
            const fetch = (await import('node-fetch')).default
            await fetch(`${this.config.apiUrl}/api/tests/${runId}/manual-actions/${actionId}/acknowledge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            })
        } catch (error: any) {
            logger.warn({ runId, error: error.message }, 'Failed to acknowledge manual action')
        }
    }

    /**
     * Execute a manual action and handle learning
     */
    async executeManualAction(params: {
        runId: string
        projectId: string | undefined
        stepNumber: number
        session: any // RunnerSession
        runner: any // PlaywrightRunner | AppiumRunner
        manualActionResult: GodModeResult
    }): Promise<boolean> {
        const { runId, projectId, stepNumber, session, runner, manualActionResult } = params
        const { action: manualAction, godModeEvent } = manualActionResult

        try {
            await runner.executeAction(session.id, manualAction)

            // Learn from manual action (God Mode Memory)
            if (godModeEvent && session.page) {
                // Defer learning slightly to allow page to settle
                setTimeout(() => {
                    this.learnFromManualAction({
                        runId,
                        projectId,
                        stepId: `step_${stepNumber}`,
                        godModeEvent,
                        page: session.page,
                        action: manualAction
                    }).catch(() => { })
                }, 1000)
            }

            return true
        } catch (error: any) {
            logger.error({ runId, error: error.message }, 'God Mode execution failed')
            return false
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms))
    }
}
