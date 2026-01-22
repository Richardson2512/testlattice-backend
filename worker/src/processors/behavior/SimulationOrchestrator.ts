/**
 * SimulationOrchestrator
 * Runs 5 parallel behavior simulations with different personas
 */

import { Page } from 'playwright'
import {
    PersonaId,
    PERSONAS,
    SimulationConfig,
    SimulationResult,
    BehaviorTestResult,
    ConversationTurn
} from './types'
import { BloomActor } from './BloomActor'
import { BloomJudge } from './BloomJudge'
import { logger } from '../../observability'

const DEFAULT_MAX_TURNS = 10
const ALL_PERSONAS: PersonaId[] = ['aggressive', 'naive', 'sneaky', 'confused', 'persistent']

export interface OrchestratorConfig {
    runId: string
    url: string
    behaviors: string[]
    chatbotSelector?: string
}

export interface OrchestratorDependencies {
    page: Page
    redis: any
}

export class SimulationOrchestrator {
    private config: OrchestratorConfig
    private deps: OrchestratorDependencies
    private judge: BloomJudge

    constructor(config: OrchestratorConfig, deps: OrchestratorDependencies) {
        this.config = config
        this.deps = deps
        this.judge = new BloomJudge()
    }

    /**
     * Run all 5 parallel simulations for each behavior
     */
    async runAllSimulations(): Promise<BehaviorTestResult> {
        const startTime = Date.now()
        const allResults: SimulationResult[] = []

        logger.info({
            runId: this.config.runId,
            behaviors: this.config.behaviors,
            personas: ALL_PERSONAS.length
        }, 'Starting parallel behavior simulations')

        // For each behavior, run all 5 personas in parallel
        for (const behavior of this.config.behaviors) {
            const simulationConfigs: SimulationConfig[] = ALL_PERSONAS.map(personaId => ({
                personaId,
                behavior,
                maxTurns: DEFAULT_MAX_TURNS,
                chatbotSelector: this.config.chatbotSelector
            }))

            // Run all 5 personas in parallel
            const results = await Promise.all(
                simulationConfigs.map(config => this.runSingleSimulation(config))
            )

            allResults.push(...results)
        }

        // Calculate aggregate score
        const aggregateScore = this.calculateAggregateScore(allResults)
        const totalTurns = allResults.reduce((sum, r) => sum + r.turns.length, 0)

        return {
            runId: this.config.runId,
            url: this.config.url,
            behaviors: this.config.behaviors,
            simulations: allResults,
            aggregateScore,
            totalTurns,
            completedSimulations: allResults.filter(r => r.status === 'complete').length,
            duration: Date.now() - startTime
        }
    }

    /**
     * Run a single simulation with one persona
     */
    private async runSingleSimulation(config: SimulationConfig): Promise<SimulationResult> {
        const startTime = Date.now()
        const actor = new BloomActor(config.personaId, config.behavior)
        let status: 'complete' | 'stuck' | 'timeout' = 'complete'

        logger.info({
            runId: this.config.runId,
            persona: config.personaId,
            behavior: config.behavior
        }, 'Starting simulation')

        try {
            for (let turn = 0; turn < config.maxTurns; turn++) {
                // Actor generates message
                const actorResponse = await actor.generateNextMessage()
                actor.addActorMessage(actorResponse.message)

                // Send message to chatbot
                const targetResponse = await this.sendToChatbot(
                    actorResponse.message,
                    config.chatbotSelector
                )
                actor.addTargetResponse(targetResponse)

                // Check status
                if (actorResponse.status === 'DONE') {
                    break
                } else if (actorResponse.status === 'STUCK') {
                    status = 'stuck'
                    break
                }

                // Brief delay between turns
                await this.delay(500)
            }

            // Judge the transcript
            const history = actor.getHistory()
            const judgment = await this.judge.scoreTranscript(history, config.behavior)

            return {
                personaId: config.personaId,
                behavior: config.behavior,
                turns: history,
                judgeScore: judgment.score,
                judgeScoreNormalized: judgment.score_normalized,
                summary: judgment.summary,
                justification: judgment.justification,
                highlights: judgment.highlights,
                status,
                duration: Date.now() - startTime
            }

        } catch (error: any) {
            logger.error({
                runId: this.config.runId,
                persona: config.personaId,
                error: error.message
            }, 'Simulation failed')

            return {
                personaId: config.personaId,
                behavior: config.behavior,
                turns: actor.getHistory(),
                judgeScore: 0,
                judgeScoreNormalized: 0,
                summary: `Error: ${error.message}`,
                justification: '',
                highlights: [],
                status: 'timeout',
                duration: Date.now() - startTime
            }
        }
    }

    /**
     * Send message to target chatbot and get response
     */
    private async sendToChatbot(message: string, selector?: string): Promise<string> {
        const page = this.deps.page

        // Find chatbot input
        const inputSelectors = selector ? [selector] : [
            'textarea[placeholder*="message" i]',
            'input[placeholder*="message" i]',
            'textarea[placeholder*="chat" i]',
            'div[contenteditable="true"]',
            '#chat-input',
            '.chat-input'
        ]

        let inputElement = null
        for (const sel of inputSelectors) {
            const el = await page.$(sel)
            if (el && await el.isVisible()) {
                inputElement = el
                break
            }
        }

        if (!inputElement) {
            throw new Error('Could not find chatbot input')
        }

        // Type message
        await inputElement.fill(message)
        await page.keyboard.press('Enter')

        // Wait for response
        await page.waitForTimeout(3000)

        // Extract latest response
        const responseSelectors = [
            '.chat-message:last-child',
            '[data-message-author="bot"]:last-child',
            '.assistant-message:last-child',
            '.response:last-child'
        ]

        for (const sel of responseSelectors) {
            const el = await page.$(sel)
            if (el) {
                const text = await el.textContent()
                if (text && text.trim()) {
                    return text.trim()
                }
            }
        }

        // Fallback: get visible text that appeared after sending
        return await page.evaluate(() => {
            const messages = document.querySelectorAll('[class*="message"]')
            const lastMessage = messages[messages.length - 1]
            return lastMessage?.textContent?.trim() || '[No response detected]'
        })
    }

    private calculateAggregateScore(results: SimulationResult[]): number {
        if (results.length === 0) return 0
        const sum = results.reduce((acc, r) => acc + r.judgeScoreNormalized, 0)
        return Math.round(sum / results.length)
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms))
    }
}
