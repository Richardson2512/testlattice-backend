/**
 * Metrics Collection
 * Issue #20: Observability - metrics for monitoring
 * 
 * Counters and gauges for:
 * - Test execution metrics
 * - AI call metrics
 * - Error rates
 * - Performance baselines
 */

// In-memory metrics (can be exported to Prometheus/Datadog)
interface MetricValue {
    value: number
    labels: Record<string, string>
    timestamp: number
}

interface Counter {
    name: string
    help: string
    values: Map<string, MetricValue>
}

interface Gauge {
    name: string
    help: string
    values: Map<string, MetricValue>
}

interface Histogram {
    name: string
    help: string
    buckets: number[]
    values: Map<string, number[]>
}

// Metrics storage
const counters = new Map<string, Counter>()
const gauges = new Map<string, Gauge>()
const histograms = new Map<string, Histogram>()

// Default histogram buckets (milliseconds)
const DEFAULT_BUCKETS = [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000]

/**
 * Create a label key from labels object
 */
function labelKey(labels: Record<string, string>): string {
    return Object.entries(labels)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}="${v}"`)
        .join(',')
}

/**
 * Increment a counter
 */
export function incCounter(
    name: string,
    labels: Record<string, string> = {},
    value: number = 1
): void {
    if (!counters.has(name)) {
        counters.set(name, {
            name,
            help: name,
            values: new Map(),
        })
    }

    const counter = counters.get(name)!
    const key = labelKey(labels)
    const current = counter.values.get(key)

    if (current) {
        current.value += value
        current.timestamp = Date.now()
    } else {
        counter.values.set(key, {
            value,
            labels,
            timestamp: Date.now(),
        })
    }
}

/**
 * Set a gauge value
 */
export function setGauge(
    name: string,
    value: number,
    labels: Record<string, string> = {}
): void {
    if (!gauges.has(name)) {
        gauges.set(name, {
            name,
            help: name,
            values: new Map(),
        })
    }

    const gauge = gauges.get(name)!
    const key = labelKey(labels)

    gauge.values.set(key, {
        value,
        labels,
        timestamp: Date.now(),
    })
}

/**
 * Record a histogram observation
 */
export function observeHistogram(
    name: string,
    value: number,
    labels: Record<string, string> = {}
): void {
    if (!histograms.has(name)) {
        histograms.set(name, {
            name,
            help: name,
            buckets: DEFAULT_BUCKETS,
            values: new Map(),
        })
    }

    const histogram = histograms.get(name)!
    const key = labelKey(labels)

    if (!histogram.values.has(key)) {
        histogram.values.set(key, [])
    }

    histogram.values.get(key)!.push(value)
}

// Pre-defined metrics
export const metrics = {
    // Test metrics
    testsStarted: (testMode: string, userTier: string) =>
        incCounter('tests_started_total', { test_mode: testMode, user_tier: userTier }),

    testsCompleted: (testMode: string, status: string, userTier: string) =>
        incCounter('tests_completed_total', { test_mode: testMode, status, user_tier: userTier }),

    testDuration: (testMode: string, duration: number) =>
        observeHistogram('test_duration_seconds', duration / 1000, { test_mode: testMode }),

    testSteps: (testMode: string, steps: number) =>
        setGauge('test_steps', steps, { test_mode: testMode }),

    // AI metrics
    aiCalls: (model: string, status: 'success' | 'error') =>
        incCounter('ai_calls_total', { model, status }),

    aiTokens: (model: string, tokens: number) =>
        incCounter('ai_tokens_total', { model }, tokens),

    aiLatency: (model: string, duration: number) =>
        observeHistogram('ai_latency_seconds', duration / 1000, { model }),

    aiRateLimited: (model: string, userTier: string) =>
        incCounter('ai_rate_limited_total', { model, user_tier: userTier }),

    // Circuit breaker metrics
    circuitBreakerState: (service: string, state: 'open' | 'closed' | 'halfOpen') =>
        setGauge('circuit_breaker_state', state === 'open' ? 1 : 0, { service }),

    // Error metrics
    errors: (type: string, code: string) =>
        incCounter('errors_total', { type, code }),

    // Performance metrics
    heapUsed: (bytes: number) =>
        setGauge('process_heap_used_bytes', bytes),

    activeTests: (count: number) =>
        setGauge('active_tests', count),

    queuedTests: (tier: string, count: number) =>
        setGauge('queued_tests', count, { tier }),

    // Cumulative performance regression tracker
    perfRegression: (ratio: number) =>
        setGauge('cumulative_perf_regression', ratio),
}

/**
 * Get all metrics in Prometheus format
 */
export function getMetricsPrometheus(): string {
    const lines: string[] = []

    // Counters
    counters.forEach((counter) => {
        lines.push(`# HELP ${counter.name} ${counter.help}`)
        lines.push(`# TYPE ${counter.name} counter`)
        counter.values.forEach((metric, key) => {
            const labelStr = key ? `{${key}}` : ''
            lines.push(`${counter.name}${labelStr} ${metric.value}`)
        })
    })

    // Gauges
    gauges.forEach((gauge) => {
        lines.push(`# HELP ${gauge.name} ${gauge.help}`)
        lines.push(`# TYPE ${gauge.name} gauge`)
        gauge.values.forEach((metric, key) => {
            const labelStr = key ? `{${key}}` : ''
            lines.push(`${gauge.name}${labelStr} ${metric.value}`)
        })
    })

    // Histograms (simplified output)
    histograms.forEach((histogram) => {
        lines.push(`# HELP ${histogram.name} ${histogram.help}`)
        lines.push(`# TYPE ${histogram.name} histogram`)
        histogram.values.forEach((values, key) => {
            if (values.length === 0) return
            const labelStr = key ? `{${key}}` : ''
            const sum = values.reduce((a, b) => a + b, 0)
            const count = values.length
            lines.push(`${histogram.name}_sum${labelStr} ${sum}`)
            lines.push(`${histogram.name}_count${labelStr} ${count}`)
        })
    })

    return lines.join('\n')
}

/**
 * Get metrics as JSON
 */
export function getMetricsJson(): Record<string, unknown> {
    const result: Record<string, unknown> = {
        counters: {},
        gauges: {},
        histograms: {},
    }

    counters.forEach((counter, name) => {
        const values: Record<string, number> = {}
        counter.values.forEach((metric, key) => {
            values[key || 'default'] = metric.value
        })
            ; (result.counters as Record<string, unknown>)[name] = values
    })

    gauges.forEach((gauge, name) => {
        const values: Record<string, number> = {}
        gauge.values.forEach((metric, key) => {
            values[key || 'default'] = metric.value
        })
            ; (result.gauges as Record<string, unknown>)[name] = values
    })

    histograms.forEach((histogram, name) => {
        const values: Record<string, { count: number; sum: number; avg: number }> = {}
        histogram.values.forEach((vals, key) => {
            if (vals.length === 0) return
            const sum = vals.reduce((a, b) => a + b, 0)
            values[key || 'default'] = {
                count: vals.length,
                sum,
                avg: sum / vals.length,
            }
        })
            ; (result.histograms as Record<string, unknown>)[name] = values
    })

    return result
}

/**
 * Reset all metrics (for testing)
 */
export function resetMetrics(): void {
    counters.clear()
    gauges.clear()
    histograms.clear()
}

// Collect process metrics periodically
let metricsInterval: NodeJS.Timeout | null = null

export function startMetricsCollection(): void {
    if (metricsInterval) return

    metricsInterval = setInterval(() => {
        const usage = process.memoryUsage()
        metrics.heapUsed(usage.heapUsed)
    }, 30000) // Every 30 seconds
}

export function stopMetricsCollection(): void {
    if (metricsInterval) {
        clearInterval(metricsInterval)
        metricsInterval = null
    }
}
