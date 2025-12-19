// Unified Brain Service - Main Entry Point
// Composes all modules into a single cohesive service
// Architecture: Qwen 2.5 Coder 7B (primary) + Qwen 2.5 Coder 14B (fallback)

export * from './types'
export { ModelClient, ModelConfig } from './ModelClient'
export { FallbackStrategy, createDefaultFallbackConfig } from './FallbackStrategy'
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
import { FallbackStrategy, createDefaultFallbackConfig } from './FallbackStrategy'
import { PageAnalyzer } from './PageAnalyzer'
import { ActionGenerator } from './ActionGenerator'

const LOG_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase()
const DEBUG_LLM = LOG_LEVEL === 'debug' || process.env.DEBUG_LLM === 'true'

/**
 * Unified Brain Service - Main orchestrator
 * Provides a unified interface for all AI/LLM operations
 */
export class UnifiedBrainService {
    private modelClient: ModelClient
    private fallbackStrategy: FallbackStrategy
    private pageAnalyzer: PageAnalyzer
    private actionGenerator: ActionGenerator

    constructor() {
        // Create model configurations from environment
        const primaryConfig: ModelConfig = {
            apiUrl: process.env.UNIFIED_BRAIN_API_URL || 'https://api.together.xyz/v1',
            apiKey: process.env.TOGETHER_API_KEY || process.env.UNIFIED_BRAIN_API_KEY || '',
            model: process.env.UNIFIED_BRAIN_MODEL || 'Qwen/Qwen2.5-Coder-7B-Instruct',
            temperature: parseFloat(process.env.UNIFIED_BRAIN_TEMPERATURE || '0.3'),
            maxTokens: parseInt(process.env.UNIFIED_BRAIN_MAX_TOKENS || '4096', 10),
        }

        const fallbackConfigModel: ModelConfig | null = process.env.UNIFIED_BRAIN_FALLBACK_MODEL ? {
            apiUrl: process.env.UNIFIED_BRAIN_FALLBACK_API_URL || 'https://api.together.xyz/v1',
            apiKey: process.env.TOGETHER_API_KEY || process.env.UNIFIED_BRAIN_FALLBACK_API_KEY || '',
            model: process.env.UNIFIED_BRAIN_FALLBACK_MODEL || 'Qwen/Qwen2.5-Coder-14B-Instruct',
            temperature: parseFloat(process.env.UNIFIED_BRAIN_FALLBACK_TEMPERATURE || '0.3'),
            maxTokens: parseInt(process.env.UNIFIED_BRAIN_FALLBACK_MAX_TOKENS || '4096', 10),
        } : {
            apiUrl: 'https://api.together.xyz/v1',
            apiKey: process.env.TOGETHER_API_KEY || '',
            model: 'Qwen/Qwen2.5-Coder-14B-Instruct',
            temperature: 0.3,
            maxTokens: 4096,
        }

        // Create fallback strategy
        const strategyConfig = createDefaultFallbackConfig()
        this.fallbackStrategy = new FallbackStrategy(strategyConfig)

        // Create model client
        this.modelClient = new ModelClient(primaryConfig, fallbackConfigModel, strategyConfig)

        // Create sub-services
        this.pageAnalyzer = new PageAnalyzer(this.modelClient, this.fallbackStrategy)
        this.actionGenerator = new ActionGenerator(this.modelClient, this.fallbackStrategy)

        if (DEBUG_LLM) {
            console.log('UnifiedBrainService initialized (modular architecture)')
            console.log(`  Primary: ${primaryConfig.model} at ${primaryConfig.apiUrl}`)
            console.log(`  Fallback: ${fallbackConfigModel?.model}`)
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
        const modelMetrics = this.modelClient.getMetrics()
        return {
            ...modelMetrics,
            fallbackReasonsBreakdown: {
                actionFailure: modelMetrics.fallbackReasons?.error || 0,
                lowConfidence: modelMetrics.fallbackReasons?.lowConfidence || 0,
                complex: modelMetrics.fallbackReasons?.complex || 0,
                explicit: modelMetrics.fallbackReasons?.explicit || 0,
            },
            costOptimization: {
                primaryModelCalls: modelMetrics.primarySuccess || 0,
                fallbackCalls: modelMetrics.fallbackUsed || 0,
                unnecessaryFallbacks: (modelMetrics.fallbackUsed || 0) - (modelMetrics.fallbackSuccess || 0),
            },
        }
    }
}
