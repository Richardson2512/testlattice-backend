// Model Client - Handles API calls to OpenAI GPT-5 Mini
// Single model, no fallback logic

import axios from 'axios'
import { ModelMessage, ModelResponse, ModelCallResult } from './types'

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
    private config: ModelConfig

    // Metrics tracking
    private metrics = {
        totalCalls: 0,
        success: 0,
        failures: 0,
    }

    constructor(config: ModelConfig) {
        this.config = config

        if (DEBUG_LLM) {
            console.log('ModelClient initialized:')
            console.log(`  Model: ${config.model} at ${config.apiUrl}`)
        }
    }

    /**
     * Call GPT-5 Mini model with same-model retry envelope
     * Retries transient failures (429, network) once with same model and prompt
     * Maximum 1 retry with 200-400ms randomized backoff
     */
    async call(
        prompt: string,
        systemPrompt: string,
        task: 'action' | 'parse' | 'analyze' | 'synthesize' | 'heal'
    ): Promise<ModelCallResult> {
        this.metrics.totalCalls++
        const maxRetries = 1
        let lastError: Error | null = null

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const response = await this.callModel(this.config, prompt, systemPrompt)

                // Parse response
                let parsedResponse: any
                try {
                    parsedResponse = JSON.parse(response)
                } catch {
                    // If not JSON, treat as success
                    this.metrics.success++
                    return {
                        content: response,
                        model: 'gpt-5-mini',
                        attempt: attempt + 1,
                        fallbackUsed: false,
                    }
                }

                this.metrics.success++
                return {
                    content: response,
                    model: 'gpt-5-mini',
                    attempt: attempt + 1,
                    fallbackUsed: false,
                    confidence: parsedResponse.confidence,
                }
            } catch (error: any) {
                lastError = error
                const errorMessage = error?.message || String(error)
                const statusCode = error.response?.status

                // Non-retryable errors: fail immediately
                if (statusCode === 400 || statusCode === 401) {
                    this.metrics.failures++
                    if (statusCode === 400) {
                        const errorDetail = error.response?.data?.error?.message || error.response?.data?.message || 'Bad request'
                        throw new Error(`GPT-5 Mini API error (400): ${errorDetail}. Check API key validity and model name.`)
                    }
                    if (statusCode === 401) {
                        throw new Error(`GPT-5 Mini API authentication failed (401). Check OPENAI_API_KEY is valid.`)
                    }
                }

                // Retryable errors: 429 (rate limit), network errors, timeouts
                const isRetryable = statusCode === 429 || 
                                   error.code === 'ECONNRESET' || 
                                   error.code === 'ETIMEDOUT' ||
                                   error.code === 'ENOTFOUND' ||
                                   (error.response === undefined && attempt < maxRetries)

                if (isRetryable && attempt < maxRetries) {
                    // Randomized backoff: 200-400ms
                    const backoffMs = 200 + Math.random() * 200
                    if (DEBUG_LLM) {
                        console.warn(`[ModelClient] GPT-5 Mini call failed (attempt ${attempt + 1}/${maxRetries + 1}): ${errorMessage}. Retrying in ${backoffMs.toFixed(0)}ms...`)
                    }
                    await this.delay(backoffMs)
                    continue
                }

                // Final failure or non-retryable error
                this.metrics.failures++
                if (DEBUG_LLM) {
                    console.warn(`[ModelClient] GPT-5 Mini call failed after ${attempt + 1} attempt(s): ${errorMessage}`)
                }
                throw new Error(`GPT-5 Mini call failed after ${attempt + 1} attempt(s): ${errorMessage}`)
            }
        }

        // Should never reach here, but TypeScript requires it
        throw lastError || new Error('GPT-5 Mini call failed: Unknown error')
    }

    /**
     * Delay helper for retry backoff
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms))
    }

    /**
     * Legacy method name for backward compatibility
     * @deprecated Use call() instead
     */
    async callWithFallback(
        prompt: string,
        systemPrompt: string,
        task: 'action' | 'parse' | 'analyze' | 'synthesize' | 'heal'
    ): Promise<ModelCallResult> {
        return this.call(prompt, systemPrompt, task)
    }

    /**
     * Call OpenAI GPT-5 Mini via API
     */
    private async callModel(config: ModelConfig, prompt: string, systemPrompt: string): Promise<string> {
        // Validate configuration before making request
        if (!config.apiUrl || !config.model) {
            throw new Error(`Invalid model configuration: apiUrl=${config.apiUrl}, model=${config.model}`)
        }

        // Validate API key for OpenAI
        if (!config.apiKey) {
            throw new Error('OPENAI_API_KEY is required for GPT-5 Mini')
        }

        const messages: ModelMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
        ]

        // Build headers for OpenAI
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
        }

        // Add organization header if provided
        if (process.env.OPENAI_ORG_ID) {
            headers['OpenAI-Organization'] = process.env.OPENAI_ORG_ID
        }

        try {
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
                throw new Error('No response from GPT-5 Mini')
            }

            return content
        } catch (error: any) {
            // Provide clearer error messages
            if (error.response?.status === 400) {
                const errorDetail = error.response?.data?.error?.message || error.response?.data?.message || 'Bad request'
                throw new Error(`GPT-5 Mini API 400 error: ${errorDetail}. Check API key validity and model name.`)
            }
            if (error.response?.status === 401) {
                throw new Error(`GPT-5 Mini API authentication failed (401). Check OPENAI_API_KEY is valid.`)
            }
            if (error.response?.status === 429) {
                throw new Error(`GPT-5 Mini API rate limit exceeded (429). Please retry later.`)
            }
            // Re-throw with context
            throw error
        }
    }

    /**
     * Get metrics for monitoring
     */
    getMetrics() {
        const totalCalls = this.metrics.totalCalls
        return {
            ...this.metrics,
            successRate: totalCalls > 0 ? this.metrics.success / totalCalls : 0,
            failureRate: totalCalls > 0 ? this.metrics.failures / totalCalls : 0,
        }
    }
}
