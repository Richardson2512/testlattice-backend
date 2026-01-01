// Unified Brain Service - Main Entry Point
// Composes all modules into a single cohesive service
// Architecture: GPT-5 Mini (text/reasoning) + GPT-4o (visual analysis only)

export * from './types'
export { ModelClient, ModelConfig } from './ModelClient'
export { DOMParser } from './DOMParser'
export { PageAnalyzer } from './PageAnalyzer'
export { ActionGenerator } from './ActionGenerator'

import {
    VisionContext,
    LLMAction,
    ParsedInstructions,
    AlternativeSelector,
    TestabilityAnalysis,
    ErrorAnalysis,
    ContextSynthesis,
    ActionGenerationOptions
} from './types'
import { ModelClient, ModelConfig } from './ModelClient'
import { PageAnalyzer } from './PageAnalyzer'
import { ActionGenerator } from './ActionGenerator'
import Redis from 'ioredis'
import { AIRateLimiter } from '../aiRateLimiter'
import { getConfig } from '../../config'

const LOG_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase()
const DEBUG_LLM = LOG_LEVEL === 'debug' || process.env.DEBUG_LLM === 'true'

/**
 * Unified Brain Service - Main orchestrator
 * Provides a unified interface for all AI/LLM operations
 * Uses GPT-5 Mini for all text/reasoning tasks
 */
export class UnifiedBrainService {
    private modelClient: ModelClient
    private pageAnalyzer: PageAnalyzer
    private actionGenerator: ActionGenerator

    constructor(redis?: Redis) {
        // Determine client label based on which API key is being used
        const registeredApiKey = process.env.OPENAI_API_KEY_REGISTERED
        const currentApiKey = process.env.OPENAI_API_KEY || ''
        const clientLabel = (registeredApiKey && currentApiKey === registeredApiKey) ? 'Registered' : 'Guest'

        // Create GPT-5 Mini configuration from environment
        const config: ModelConfig = {
            apiUrl: process.env.OPENAI_API_URL || 'https://api.openai.com/v1',
            apiKey: currentApiKey,
            model: process.env.OPENAI_MODEL || 'gpt-4o',
            temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.3'),
            maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '4096', 10),
            clientLabel,
        }

        // Validate API key
        if (!config.apiKey) {
            throw new Error('OPENAI_API_KEY is required for GPT-5 Mini')
        }

        // Initialize Rate Limiter
        let rateLimiter: AIRateLimiter | undefined
        if (redis) {
            const appConfig = getConfig()
            rateLimiter = new AIRateLimiter(redis, appConfig.features.rateLimiterMode)
        }

        // Create model client (no fallback)
        this.modelClient = new ModelClient(config, rateLimiter)

        // Create sub-services (no fallback strategy)
        this.pageAnalyzer = new PageAnalyzer(this.modelClient)
        this.actionGenerator = new ActionGenerator(this.modelClient)

        if (DEBUG_LLM) {
            console.log(`UnifiedBrainService [${clientLabel}] initialized (GPT-5 Mini)`)
            console.log(`  Model: ${config.model} at ${config.apiUrl}`)
        }
    }

    // ===== Action Generation =====

    /**
     * Generate next action based on context and history
     */
    async generateAction(
        context: VisionContext,
        history: Array<{ action: LLMAction; timestamp: string }>,
        goal: string,
        trackingInfo?: ActionGenerationOptions
    ): Promise<LLMAction> {
        return this.actionGenerator.generateAction(context, history, goal, trackingInfo)
    }

    /**
     * Parse test instructions into structured plan
     */
    async parseTestInstructions(instructions: string, currentUrl?: string): Promise<ParsedInstructions> {
        return this.actionGenerator.parseTestInstructions(instructions, currentUrl)
    }

    /**
     * Find alternative selector for self-healing
     */
    async findAlternativeSelector(
        failedSelector: string,
        domSnapshot: string,
        errorMessage: string,
        targetText?: string
    ): Promise<AlternativeSelector[]> {
        return this.actionGenerator.findAlternativeSelector(failedSelector, domSnapshot, errorMessage, targetText)
    }

    // ===== Page Analysis =====

    /**
     * Analyze DOM snapshot and build interaction context
     */
    async analyzeScreenshot(screenshotBase64: string, domSnapshot: string, goal: string): Promise<VisionContext> {
        return this.pageAnalyzer.analyzeScreenshot(screenshotBase64, domSnapshot, goal)
    }

    /**
     * Analyze page for testability - UI Diagnosis Phase
     */
    async analyzePageTestability(context: VisionContext): Promise<TestabilityAnalysis> {
        return this.pageAnalyzer.analyzePageTestability(context)
    }

    /**
     * Synthesize context from multiple sources
     */
    async synthesizeContext(params: {
        domSnapshot: string
        consoleLogs: string[]
        networkErrors: any[]
        goal: string
    }): Promise<ContextSynthesis> {
        return this.pageAnalyzer.synthesizeContext(params)
    }

    /**
     * Analyze errors and suggest fixes
     */
    async analyzeError(
        error: Error,
        context: {
            action: LLMAction
            domSnapshot: string
            logs: string[]
        }
    ): Promise<ErrorAnalysis> {
        return this.pageAnalyzer.analyzeError(error, context)
    }

    // ===== Metrics =====

    /**
     * Get metrics for monitoring
     */
    getMetrics() {
        return this.modelClient.getMetrics()
    }
}
