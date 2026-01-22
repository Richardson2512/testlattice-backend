
// Model Client - Handles API calls to OpenAI GPT-5 Mini
// Single model, no fallback logic

import axios from 'axios'
import { ModelMessage, ModelResponse, ModelCallResult } from './types'
// Observability: AI call tracking
import { aiEvents, metrics, getTraceContext } from '../../observability'
import { AIRateLimiter } from '../aiRateLimiter'

const LOG_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase()
const DEBUG_LLM = LOG_LEVEL === 'debug' || process.env.DEBUG_LLM === 'true'

export interface ModelConfig {
    apiUrl: string
    apiKey: string
    model: string
    temperature: number
    maxTokens: number
    provider?: 'openai' | 'anthropic' | 'google'
    clientLabel?: string  // Optional label for token tracking (e.g., 'Guest', 'Registered')
}

export class ModelClient {
    private config: ModelConfig
    private clientLabel: string
    private rateLimiter?: AIRateLimiter

    // Metrics tracking (ADMIN ONLY - not exposed to users)
    private metrics = {
        totalCalls: 0,
        success: 0,
        failures: 0,
        // Token usage tracking
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalTokens: 0,
    }

    constructor(config: ModelConfig, rateLimiter?: AIRateLimiter) {
        this.config = config
        this.rateLimiter = rateLimiter
        this.clientLabel = config.clientLabel || 'Default'

        if (DEBUG_LLM) {
            console.log(`ModelClient [${this.clientLabel}] initialized:`)
            console.log(`  Model: ${config.model} at ${config.apiUrl}`)
        }
    }

    /**
     * Call GPT-5 Mini model with exponential backoff retry envelope
     * Retries transient failures (429, network) up to 3 times
     * Backoff: 1s → 2s → 4s (exponential)
     */
    async call(
        prompt: string,
        systemPrompt: string,
        task: 'action' | 'parse' | 'analyze' | 'synthesize' | 'heal'
    ): Promise<ModelCallResult> {
        this.metrics.totalCalls++
        const maxRetries = 2
        const baseDelayMs = 1000 // 1 second initial delay
        let lastError: Error | null = null
        const startTime = Date.now()

        // Rate Limiter Check
        if (this.rateLimiter) {
            const context = getTraceContext()
            // Only check limits if we have user context (registered/guest tests)
            if (context?.userId && context?.userTier) {
                const estimatedTokens = (prompt.length + systemPrompt.length) / 4 + 500 // Rough estimate + buffer
                const result = await this.rateLimiter.check(
                    this.config.model,
                    context.userId,
                    context.userTier,
                    Math.ceil(estimatedTokens)
                )

                if (!result.allowed) {
                    aiEvents.rateLimited(this.config.model, context.userId, result.retryAfterMs || 0)
                    metrics.aiRateLimited(this.config.model, context.userTier)

                    // Don't retry rate limits from our own limiter
                    throw new Error(result.userMessage || 'Rate limit exceeded')
                }
            }
        }

        // Track AI call start
        aiEvents.callStarted(this.config.model, task, prompt.length)

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
                    const duration = Date.now() - startTime
                    aiEvents.callCompleted(this.config.model, task, response.length, duration)
                    metrics.aiCalls(this.config.model, 'success')
                    metrics.aiLatency(this.config.model, duration)
                    return {
                        content: response,
                        model: 'gpt-5-mini', // Type cast not needed if string matches literal type, but keeping it for safety
                        attempt: attempt + 1,
                        fallbackUsed: false,
                    }
                }

                this.metrics.success++
                const duration = Date.now() - startTime
                aiEvents.callCompleted(this.config.model, task, response.length, duration)
                metrics.aiCalls(this.config.model, 'success')
                metrics.aiLatency(this.config.model, duration)
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

                // Retryable errors: 429 (rate limit), 500/502/503 (server), network errors, timeouts
                const isRetryable = statusCode === 429 ||
                    statusCode === 500 ||
                    statusCode === 502 ||
                    statusCode === 503 ||
                    error.code === 'ECONNRESET' ||
                    error.code === 'ETIMEDOUT' ||
                    error.code === 'ENOTFOUND' ||
                    (error.response === undefined && attempt < maxRetries)

                if (isRetryable && attempt < maxRetries) {
                    // Exponential backoff: 1s, 2s, 4s (with ±10% jitter to avoid thundering herd)
                    const exponentialDelay = baseDelayMs * Math.pow(2, attempt)
                    const jitter = exponentialDelay * 0.1 * (Math.random() - 0.5) // ±10% jitter
                    const backoffMs = Math.round(exponentialDelay + jitter)

                    console.log(`[ModelClient][${this.clientLabel}] Rate limit or transient error (${statusCode || error.code}). Retry ${attempt + 1}/${maxRetries} in ${backoffMs}ms...`)
                    await this.delay(backoffMs)
                    continue
                }

                // Final failure or non-retryable error
                this.metrics.failures++
                aiEvents.callFailed(this.config.model, task, errorMessage)
                metrics.aiCalls(this.config.model, 'error')
                console.warn(`[ModelClient][${this.clientLabel}] GPT-5 Mini call failed after ${attempt + 1} attempt(s): ${errorMessage}`)
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
     * Call Model logic (OpenAI / Anthropic / Gemini)
     */
    private async callModel(config: ModelConfig, prompt: string, systemPrompt: string): Promise<string> {
        // Dispatch based on provider
        if (config.provider === 'anthropic') {
            return this.callAnthropic(config, prompt, systemPrompt)
        }
        if (config.provider === 'google') {
            return this.callGemini(config, prompt, systemPrompt)
        }
        // Default to OpenAI
        return this.callOpenAI(config, prompt, systemPrompt)
    }

    private async callOpenAI(config: ModelConfig, prompt: string, systemPrompt: string): Promise<string> {
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

            // ADMIN ONLY: Log token usage for cost tracking
            const usage = response.data.usage
            if (usage) {
                this.metrics.totalPromptTokens += usage.prompt_tokens || 0
                this.metrics.totalCompletionTokens += usage.completion_tokens || 0
                this.metrics.totalTokens += usage.total_tokens || 0

                console.log(`[TokenUsage][${this.clientLabel}] Call: prompt=${usage.prompt_tokens}, completion=${usage.completion_tokens}, total=${usage.total_tokens} | Cumulative: ${this.metrics.totalTokens} tokens`)
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

    private async callAnthropic(config: ModelConfig, prompt: string, systemPrompt: string): Promise<string> {
        if (!config.apiKey) throw new Error('ANTHROPIC_API_KEY is required')

        try {
            const response = await axios.post(
                'https://api.anthropic.com/v1/messages',
                {
                    model: config.model || 'claude-3-5-sonnet-20240620',
                    max_tokens: config.maxTokens,
                    temperature: config.temperature,
                    system: systemPrompt,
                    messages: [{ role: 'user', content: prompt }]
                },
                {
                    headers: {
                        'x-api-key': config.apiKey,
                        'anthropic-version': '2023-06-01',
                        'content-type': 'application/json'
                    }
                }
            )
            return response.data.content[0].text
        } catch (error: any) {
            console.error('Anthropic API Error:', error.response?.data || error.message)
            throw new Error(`Anthropic API failed: ${error.message}`)
        }
    }

    private async callGemini(config: ModelConfig, prompt: string, systemPrompt: string): Promise<string> {
        if (!config.apiKey) throw new Error('GEMINI_API_KEY is required')

        try {
            // Gemini doesn't have a system prompt in the same way, we prepend it
            const fullPrompt = `${systemPrompt}\n\n${prompt}`

            const response = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/${config.model || 'gemini-1.5-flash'}:generateContent?key=${config.apiKey}`,
                {
                    contents: [{
                        parts: [{ text: fullPrompt }]
                    }],
                    generationConfig: {
                        temperature: config.temperature,
                        maxOutputTokens: config.maxTokens,
                        // Force JSON if possible, but Gemini validation is trickier
                        responseMimeType: "application/json"
                    }
                }
            )
            return response.data.candidates[0].content.parts[0].text
        } catch (error: any) {
            console.error('Gemini API Error:', error.response?.data || error.message)
            throw new Error(`Gemini API failed: ${error.message}`)
        }
    }

    /**
     * Call GPT-4o with vision (screenshot analysis)
     * Uses separate vision model for image understanding
     */
    async callWithVision(
        screenshotBase64: string,
        prompt: string,
        systemPrompt: string
    ): Promise<ModelCallResult> {
        this.metrics.totalCalls++

        // Use GPT-4o for vision (same model as VisionValidatorService)
        const visionModel = process.env.VISION_MODEL || 'gpt-4o'
        const visionEndpoint = process.env.VISION_MODEL_ENDPOINT || 'https://api.openai.com/v1/chat/completions'

        // Validate API key
        if (!this.config.apiKey) {
            throw new Error('OPENAI_API_KEY is required for vision calls')
        }

        const messages = [
            {
                role: 'system',
                content: systemPrompt
            },
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: prompt
                    },
                    {
                        type: 'image_url',
                        image_url: {
                            url: `data:image/png;base64,${screenshotBase64}`,
                            detail: 'high' // Use high detail for accurate element detection
                        }
                    }
                ]
            }
        ]

        try {
            const response = await axios.post(
                visionEndpoint,
                {
                    model: visionModel,
                    messages,
                    response_format: { type: 'json_object' },
                    temperature: 0.2, // Lower temperature for more consistent element detection
                    max_tokens: 4096,
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.config.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    timeout: 60000,
                }
            )

            const content = response.data.choices?.[0]?.message?.content
            if (!content) {
                throw new Error('No response from GPT-4o Vision')
            }

            // Track token usage
            const usage = response.data.usage
            if (usage) {
                this.metrics.totalPromptTokens += usage.prompt_tokens || 0
                this.metrics.totalCompletionTokens += usage.completion_tokens || 0
                this.metrics.totalTokens += usage.total_tokens || 0
                console.log(`[TokenUsage][${this.clientLabel}][Vision] Call: prompt=${usage.prompt_tokens}, completion=${usage.completion_tokens}, total=${usage.total_tokens}`)
            }

            this.metrics.success++
            return {
                content,
                model: 'gpt-5-mini' as const, // Type compatibility
                attempt: 1,
                fallbackUsed: false,
            }
        } catch (error: any) {
            this.metrics.failures++
            const statusCode = error.response?.status
            const errorMessage = error.response?.data?.error?.message || error.message

            console.warn(`[ModelClient][${this.clientLabel}] Vision call failed (${statusCode}): ${errorMessage}`)

            // Return empty result instead of throwing - allow DOM-only fallback
            return {
                content: JSON.stringify({ visibleElements: [], error: errorMessage }),
                model: 'gpt-5-mini' as const,
                attempt: 1,
                fallbackUsed: false,
            }
        }
    }

    /**
     * Get metrics for monitoring (ADMIN ONLY)
     * Not exposed to users - only visible in server logs and admin dashboards
     */
    getMetrics() {
        const totalCalls = this.metrics.totalCalls
        return {
            ...this.metrics,
            successRate: totalCalls > 0 ? this.metrics.success / totalCalls : 0,
            failureRate: totalCalls > 0 ? this.metrics.failures / totalCalls : 0,
            // Estimated cost (GPT-5-mini pricing: $0.25/1M input, $2.00/1M output)
            estimatedCostUSD: (
                (this.metrics.totalPromptTokens / 1000000) * 0.25 +
                (this.metrics.totalCompletionTokens / 1000000) * 2.00
            ).toFixed(6),
        }
    }
}
