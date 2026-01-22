/**
 * Circuit Breakers for AI Services
 * Issue #7: Resilience for external service failures
 * 
 * Uses cockatiel for circuit breaker pattern with:
 * - Automatic failure detection
 * - Half-open recovery testing
 * - Exponential backoff retries
 */

import {
    CircuitBreakerPolicy,
    ConsecutiveBreaker,
    ExponentialBackoff,
    handleAll,
    retry,
    wrap,
    circuitBreaker,
    CircuitState,
} from 'cockatiel'
import { CIRCUIT_BREAKER_CONFIG, RETRY_CONFIG } from '../config/constants'

// Event types for monitoring
type CircuitBreakerEvent = 'open' | 'close' | 'halfOpen' | 'success' | 'failure'

interface CircuitBreakerOptions {
    name: string
    failureThreshold?: number
    halfOpenAfterMs?: number
    onStateChange?: (event: CircuitBreakerEvent, name: string) => void
}

/**
 * Create a circuit breaker for a specific service
 */
function createCircuitBreaker(options: CircuitBreakerOptions): CircuitBreakerPolicy {
    const {
        name,
        failureThreshold = CIRCUIT_BREAKER_CONFIG.failureThreshold,
        halfOpenAfterMs = CIRCUIT_BREAKER_CONFIG.halfOpenAfterMs,
        onStateChange,
    } = options

    const breaker = circuitBreaker(handleAll, {
        halfOpenAfter: halfOpenAfterMs,
        breaker: new ConsecutiveBreaker(failureThreshold),
    })

    // Monitor state changes
    breaker.onStateChange(state => {
        const event = state === CircuitState.Open ? 'open'
            : state === CircuitState.Closed ? 'close'
                : 'halfOpen'

        console.log(`[CircuitBreaker:${name}] State changed to: ${event}`)

        if (onStateChange) {
            onStateChange(event, name)
        }
    })

    breaker.onSuccess(() => {
        if (onStateChange) {
            onStateChange('success', name)
        }
    })

    breaker.onFailure((result) => {
        const reason = (result.reason as unknown) as Error | undefined
        console.warn(`[CircuitBreaker:${name}] Failure recorded:`, reason?.message || String(result.reason))
        if (onStateChange) {
            onStateChange('failure', name)
        }
    })

    return breaker
}

/**
 * Create a retry policy with exponential backoff
 */
function createRetryPolicy() {
    return retry(handleAll, {
        maxAttempts: RETRY_CONFIG.maxAttempts,
        backoff: new ExponentialBackoff({
            initialDelay: RETRY_CONFIG.initialDelayMs,
            maxDelay: RETRY_CONFIG.maxDelayMs,
            exponent: RETRY_CONFIG.backoffMultiplier,
        }),
    })
}

// Store for circuit breakers
const circuitBreakers = new Map<string, CircuitBreakerPolicy>()

/**
 * Get or create a circuit breaker for a service
 */
export function getCircuitBreaker(
    serviceName: string,
    onStateChange?: (event: CircuitBreakerEvent, name: string) => void
): CircuitBreakerPolicy {
    if (!circuitBreakers.has(serviceName)) {
        circuitBreakers.set(
            serviceName,
            createCircuitBreaker({ name: serviceName, onStateChange })
        )
    }
    return circuitBreakers.get(serviceName)!
}

// Pre-configured circuit breakers for known services
export const openaiBreaker = createCircuitBreaker({
    name: 'openai',
    failureThreshold: 5,
    halfOpenAfterMs: 60000,
    onStateChange: (event, name) => {
        if (event === 'open') {
            console.error(`🚨 [CircuitBreaker:${name}] OPEN - AI calls will be queued`)
        } else if (event === 'close') {
            console.log(`✅ [CircuitBreaker:${name}] CLOSED - AI calls resumed`)
        }
    },
})

export const geminiBreaker = createCircuitBreaker({
    name: 'gemini',
    failureThreshold: 5,
    halfOpenAfterMs: 60000,
    onStateChange: (event, name) => {
        if (event === 'open') {
            console.error(`🚨 [CircuitBreaker:${name}] OPEN - Gemini calls will be queued`)
        }
    },
})

export const visionBreaker = createCircuitBreaker({
    name: 'vision',
    failureThreshold: 3,  // Lower threshold for expensive vision calls
    halfOpenAfterMs: 90000,  // Longer recovery for vision
})

// Shared retry policy
export const retryPolicy = createRetryPolicy()

/**
 * Execute a function with circuit breaker and retry protection
 * 
 * @param breaker - The circuit breaker to use
 * @param fn - The async function to execute
 * @param fallback - Optional fallback function if circuit is open
 */
export async function executeWithResilience<T>(
    breaker: CircuitBreakerPolicy,
    fn: () => Promise<T>,
    fallback?: () => T | Promise<T>
): Promise<T> {
    const policy = wrap(retryPolicy, breaker)

    try {
        return await policy.execute(fn)
    } catch (error: any) {
        // Check if circuit is open
        if (error.message?.includes('circuit') || error.name === 'BrokenCircuitError') {
            console.warn(`[Resilience] Circuit open, attempting fallback`)

            if (fallback) {
                return await fallback()
            }

            throw error
        }

        throw error
    }
}

/**
 * Get the current state of all circuit breakers
 */
export function getCircuitBreakerStates(): Record<string, string> {
    const states: Record<string, string> = {}

    // Check pre-configured breakers
    states['openai'] = CircuitState[openaiBreaker.state]
    states['gemini'] = CircuitState[geminiBreaker.state]
    states['vision'] = CircuitState[visionBreaker.state]

    // Check dynamic breakers
    circuitBreakers.forEach((breaker, name) => {
        states[name] = CircuitState[breaker.state]
    })

    return states
}

/**
 * Check if a specific circuit breaker is open
 */
export function isCircuitOpen(serviceName: string): boolean {
    const breaker = circuitBreakers.get(serviceName)
    if (breaker) {
        return breaker.state === CircuitState.Open
    }

    // Check pre-configured breakers
    switch (serviceName) {
        case 'openai':
            return openaiBreaker.state === CircuitState.Open
        case 'gemini':
            return geminiBreaker.state === CircuitState.Open
        case 'vision':
            return visionBreaker.state === CircuitState.Open
        default:
            return false
    }
}

/**
 * Reset a circuit breaker (for testing or manual recovery)
 */
export function resetCircuitBreaker(serviceName: string): void {
    const breaker = circuitBreakers.get(serviceName)
    if (breaker) {
        // Cockatiel doesn't have a direct reset, but we can recreate
        circuitBreakers.delete(serviceName)
        console.log(`[CircuitBreaker:${serviceName}] Reset`)
    }
}
