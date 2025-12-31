/**
 * Token Usage Service
 * Tracks and persists token consumption per test run for admin analytics
 */

import { supabase } from '../lib/supabase'

// Model pricing (per 1M tokens)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
    'gpt-5-mini': { input: 0.25, output: 2.00 },
    'gpt-4o': { input: 5.00, output: 15.00 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'gemini-2.0-flash': { input: 0.10, output: 0.40 },
    'claude-3-5-sonnet': { input: 3.00, output: 15.00 },
}

export interface TokenUsageRecord {
    testRunId: string
    testMode?: string
    model: string
    promptTokens: number
    completionTokens: number
    totalTokens: number
    apiCalls: number
    estimatedCostUsd?: number
}

export interface AggregatedTokenStats {
    totalPromptTokens: number
    totalCompletionTokens: number
    totalTokens: number
    totalApiCalls: number
    totalCostUsd: number
    byTestMode: TestModeStats[]
    byModel: ModelStats[]
    recentUsage: DailyUsage[]
}

export interface TestModeStats {
    testMode: string
    testCount: number
    promptTokens: number
    completionTokens: number
    totalTokens: number
    apiCalls: number
    costUsd: number
}

export interface ModelStats {
    model: string
    promptTokens: number
    completionTokens: number
    totalTokens: number
    apiCalls: number
    costUsd: number
}

export interface DailyUsage {
    date: string
    totalTokens: number
    costUsd: number
}

/**
 * Calculate cost based on model pricing
 */
function calculateCost(model: string, promptTokens: number, completionTokens: number): number {
    const pricing = MODEL_PRICING[model] || MODEL_PRICING['gpt-5-mini']
    const inputCost = (promptTokens / 1000000) * pricing.input
    const outputCost = (completionTokens / 1000000) * pricing.output
    return inputCost + outputCost
}

/**
 * Save token usage record for a test run
 */
export async function saveTokenUsage(record: TokenUsageRecord): Promise<void> {
    const cost = record.estimatedCostUsd ?? calculateCost(
        record.model,
        record.promptTokens,
        record.completionTokens
    )

    const { error } = await supabase.from('token_usage').insert({
        test_run_id: record.testRunId,
        test_mode: record.testMode || 'unknown',
        model: record.model,
        prompt_tokens: record.promptTokens,
        completion_tokens: record.completionTokens,
        total_tokens: record.totalTokens,
        api_calls: record.apiCalls,
        estimated_cost_usd: cost,
    })

    if (error) {
        console.error('[TokenUsage] Failed to save:', error.message)
        // Don't throw - token tracking should not block test execution
    }
}

/**
 * Get token usage for a specific test run
 */
export async function getTokenUsageByTestRun(testRunId: string): Promise<TokenUsageRecord[]> {
    const { data, error } = await supabase
        .from('token_usage')
        .select('*')
        .eq('test_run_id', testRunId)

    if (error) {
        throw new Error(`Failed to get token usage: ${error.message}`)
    }

    return (data || []).map(row => ({
        testRunId: row.test_run_id,
        testMode: row.test_mode,
        model: row.model,
        promptTokens: row.prompt_tokens,
        completionTokens: row.completion_tokens,
        totalTokens: row.total_tokens,
        apiCalls: row.api_calls,
        estimatedCostUsd: parseFloat(row.estimated_cost_usd),
    }))
}

/**
 * Get aggregated token usage statistics for admin dashboard
 */
export async function getAggregatedStats(daysBack: number = 30): Promise<AggregatedTokenStats> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - daysBack)

    // Get all token usage records
    const { data, error } = await supabase
        .from('token_usage')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })

    if (error) {
        throw new Error(`Failed to get aggregated stats: ${error.message}`)
    }

    const records = data || []

    // Calculate totals
    let totalPromptTokens = 0
    let totalCompletionTokens = 0
    let totalTokens = 0
    let totalApiCalls = 0
    let totalCostUsd = 0

    // Group by test mode
    const testModeMap = new Map<string, TestModeStats>()
    // Group by model
    const modelMap = new Map<string, ModelStats>()
    // Group by date
    const dailyMap = new Map<string, DailyUsage>()
    // Count unique test runs per mode
    const testRunsPerMode = new Map<string, Set<string>>()

    for (const row of records) {
        const promptTokens = row.prompt_tokens || 0
        const completionTokens = row.completion_tokens || 0
        const tokens = row.total_tokens || 0
        const apiCalls = row.api_calls || 0
        const cost = parseFloat(row.estimated_cost_usd) || 0

        // Update totals
        totalPromptTokens += promptTokens
        totalCompletionTokens += completionTokens
        totalTokens += tokens
        totalApiCalls += apiCalls
        totalCostUsd += cost

        // Update test mode stats
        const mode = row.test_mode || 'unknown'
        if (!testModeMap.has(mode)) {
            testModeMap.set(mode, {
                testMode: mode,
                testCount: 0,
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0,
                apiCalls: 0,
                costUsd: 0,
            })
            testRunsPerMode.set(mode, new Set())
        }
        const modeStats = testModeMap.get(mode)!
        modeStats.promptTokens += promptTokens
        modeStats.completionTokens += completionTokens
        modeStats.totalTokens += tokens
        modeStats.apiCalls += apiCalls
        modeStats.costUsd += cost
        testRunsPerMode.get(mode)!.add(row.test_run_id)

        // Update model stats
        const model = row.model || 'unknown'
        if (!modelMap.has(model)) {
            modelMap.set(model, {
                model,
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0,
                apiCalls: 0,
                costUsd: 0,
            })
        }
        const modelStats = modelMap.get(model)!
        modelStats.promptTokens += promptTokens
        modelStats.completionTokens += completionTokens
        modelStats.totalTokens += tokens
        modelStats.apiCalls += apiCalls
        modelStats.costUsd += cost

        // Update daily stats
        const date = new Date(row.created_at).toISOString().split('T')[0]
        if (!dailyMap.has(date)) {
            dailyMap.set(date, { date, totalTokens: 0, costUsd: 0 })
        }
        const dailyStats = dailyMap.get(date)!
        dailyStats.totalTokens += tokens
        dailyStats.costUsd += cost
    }

    // Set test counts from unique test runs
    for (const [mode, runs] of testRunsPerMode) {
        testModeMap.get(mode)!.testCount = runs.size
    }

    // Sort by usage (descending)
    const byTestMode = Array.from(testModeMap.values())
        .sort((a, b) => b.totalTokens - a.totalTokens)
    const byModel = Array.from(modelMap.values())
        .sort((a, b) => b.totalTokens - a.totalTokens)
    const recentUsage = Array.from(dailyMap.values())
        .sort((a, b) => a.date.localeCompare(b.date))

    return {
        totalPromptTokens,
        totalCompletionTokens,
        totalTokens,
        totalApiCalls,
        totalCostUsd,
        byTestMode,
        byModel,
        recentUsage,
    }
}

/**
 * Get model pricing for display
 */
export function getModelPricing(): Record<string, { input: number; output: number }> {
    return { ...MODEL_PRICING }
}
