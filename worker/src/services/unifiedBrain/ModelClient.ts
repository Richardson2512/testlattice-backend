// Model Client - Handles API calls to LLM models
// Supports Together.ai with Qwen models

import axios from 'axios'
import { ModelMessage, ModelResponse, ModelCallResult, FallbackConfig, DeterministicFallbackContext } from './types'

const LOG_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase()
const DEBUG_LLM = LOG_LEVEL === 'debug' || process.env.DEBUG_LLM === 'true'

export interface ModelConfig {
    apiUrl: string
    apiKey: string
    model: string
    temperature: number
    maxTokens: number
}

export class ModelClient {
    private primaryConfig: ModelConfig
    private fallbackConfig: ModelConfig | null
    private strategyConfig: FallbackConfig

    // Metrics tracking
    private metrics = {
        totalCalls: 0,
        primarySuccess: 0,
        fallbackUsed: 0,
        fallbackSuccess: 0,
        fallbackReasons: {
            error: 0,
            lowConfidence: 0,
            complex: 0,
            explicit: 0,
        },
    }

    constructor(
        primaryConfig: ModelConfig,
        fallbackConfig: ModelConfig | null,
        strategyConfig: FallbackConfig
    ) {
        this.primaryConfig = primaryConfig
        this.fallbackConfig = fallbackConfig
        this.strategyConfig = strategyConfig

        if (DEBUG_LLM) {
            console.log('ModelClient initialized:')
            console.log(`  Primary: ${primaryConfig.model} at ${primaryConfig.apiUrl}`)
            if (fallbackConfig) {
                console.log(`  Fallback: ${fallbackConfig.model} at ${fallbackConfig.apiUrl}`)
            }
        }
    }

    /**
     * Call model with automatic fallback to 14B if needed
     */
    async callWithFallback(
        prompt: string,
        systemPrompt: string,
        task: 'action' | 'parse' | 'analyze' | 'synthesize' | 'heal',
        context?: DeterministicFallbackContext,
        shouldFallback?: (response: any, context?: DeterministicFallbackContext) => boolean,
        getFallbackReason?: (response: any, context?: DeterministicFallbackContext) => string
    ): Promise<ModelCallResult> {
        this.metrics.totalCalls++
        let attempt = 0
        let lastError: Error | null = null

        // Try primary (7B) first
        try {
            attempt++
            const response = await this.callModel(this.primaryConfig, prompt, systemPrompt)

            // Parse response to check confidence
            let parsedResponse: any
            try {
                parsedResponse = JSON.parse(response)
            } catch {
                // If not JSON, treat as success
                this.metrics.primarySuccess++
                return {
                    content: response,
                    model: '7b',
                    attempt,
                    fallbackUsed: false,
                }
            }

            // Check if we should fallback
            if (shouldFallback && shouldFallback(parsedResponse, context)) {
                const reason = getFallbackReason ? getFallbackReason(parsedResponse, context) : 'unknown'
                console.log(`[ModelClient] Primary response requires fallback (${reason}), using fallback model`)
                throw new Error(`Fallback required: ${reason}`)
            }

            this.metrics.primarySuccess++
            return {
                content: response,
                model: '7b',
                attempt,
                fallbackUsed: false,
                confidence: parsedResponse.confidence,
            }
        } catch (error: any) {
            lastError = error
            const errorMessage = error?.message || String(error)

            if (DEBUG_LLM) {
                console.warn(`[ModelClient] Primary failed: ${errorMessage}`)
            }

            // Fallback to 14B if enabled
            if (this.strategyConfig.fallbackOnError && this.fallbackConfig) {
                try {
                    attempt++
                    this.metrics.fallbackUsed++
                    this.metrics.fallbackReasons.error++

                    if (DEBUG_LLM) {
                        console.log(`[ModelClient] Attempting fallback model...`)
                    }

                    // Enhance prompt for fallback
                    const enhancedPrompt = this.enhancePromptForFallback(prompt, error, context)

                    const response = await this.callModel(this.fallbackConfig, enhancedPrompt, systemPrompt)

                    let parsedResponse: any
                    try {
                        parsedResponse = JSON.parse(response)
                        this.metrics.fallbackSuccess++
                        return {
                            content: response,
                            model: '14b',
                            attempt,
                            fallbackUsed: true,
                            confidence: parsedResponse.confidence,
                        }
                    } catch {
                        this.metrics.fallbackSuccess++
                        return {
                            content: response,
                            model: '14b',
                            attempt,
                            fallbackUsed: true,
                        }
                    }
                } catch (fallbackError: any) {
                    console.error(`[ModelClient] Both models failed: ${fallbackError.message}`)
                    throw new Error(
                        `Primary and fallback models both failed. Primary: ${lastError?.message}, Fallback: ${fallbackError.message}`
                    )
                }
            } else {
                throw error
            }
        }
    }

    /**
     * Call a model via OpenAI-compatible API
     */
    private async callModel(config: ModelConfig, prompt: string, systemPrompt: string): Promise<string> {
        const messages: ModelMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
        ]

        // Build headers
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        }
        if (config.apiKey && config.apiKey !== 'ollama') {
            headers['Authorization'] = `Bearer ${config.apiKey}`
        } else if (config.apiUrl.includes('together.xyz')) {
            throw new Error('TOGETHER_API_KEY is required for Together.ai API')
        }

        const response = await axios.post<ModelResponse>(
            `${config.apiUrl}/chat/completions`,
            {
                model: config.model,
                messages,
                response_format: { type: 'json_object' },
                temperature: config.temperature,
                max_tokens: config.maxTokens,
            },
            {
                headers,
                timeout: 60000,
            }
        )

        const content = response.data.choices[0]?.message?.content
        if (!content) {
            throw new Error('No response from model')
        }

        return content
    }

    /**
     * Enhance prompt for fallback with failure context
     */
    private enhancePromptForFallback(originalPrompt: string, error: Error, context?: any): string {
        return `${originalPrompt}

[FALLBACK CONTEXT]
The primary model failed with: ${error.message}
${context?.errorMessage ? `Original error: ${context.errorMessage}` : ''}
${context ? `Additional context: ${JSON.stringify(context, null, 2)}` : ''}

Please provide a more detailed analysis using your enhanced reasoning capabilities.`
    }

    /**
     * Get metrics for monitoring
     */
    getMetrics() {
        const totalCalls = this.metrics.totalCalls
        const fallbackUsed = this.metrics.fallbackUsed
        const fallbackSuccess = this.metrics.fallbackSuccess

        return {
            ...this.metrics,
            fallbackRate: totalCalls > 0 ? fallbackUsed / totalCalls : 0,
            fallbackSuccessRate: fallbackUsed > 0 ? fallbackSuccess / fallbackUsed : 0,
            primaryModelSuccessRate: totalCalls > 0 ? this.metrics.primarySuccess / totalCalls : 0,
        }
    }

    /**
     * Record a fallback reason
     */
    recordFallbackReason(reason: 'error' | 'lowConfidence' | 'complex' | 'explicit') {
        this.metrics.fallbackReasons[reason]++
    }
}
