/**
 * Graceful Degradation Manager
 * Issue #17: Fallback strategies when services are unavailable
 * 
 * Provides fallback options for non-critical services:
 * - Pinecone down → Skip RAG, use direct prompts
 * - Vision down → DOM-only analysis
 * - Wasabi down → Supabase storage fallback
 */

import { isCircuitOpen } from './circuitBreakers'

export type ServiceStatus = 'healthy' | 'degraded' | 'down'
export type FallbackStrategy =
    | 'skip-rag'
    | 'dom-only'
    | 'supabase-storage'
    | 'disabled'
    | 'queue'
    | 'primary'

// Service health status
const serviceStatus = new Map<string, ServiceStatus>()

// Fallback mappings
const FALLBACK_STRATEGIES: Record<string, FallbackStrategy> = {
    'pinecone': 'skip-rag',
    'vision': 'dom-only',
    'wasabi': 'supabase-storage',
    'openai': 'queue',
    'gemini': 'queue',
}

/**
 * Check health of a service
 * Combines circuit breaker state with explicit health status
 */
export function getServiceHealth(serviceName: string): ServiceStatus {
    // Check circuit breaker first
    if (isCircuitOpen(serviceName)) {
        return 'down'
    }

    // Check explicit status
    return serviceStatus.get(serviceName) || 'healthy'
}

/**
 * Set explicit health status for a service
 */
export function setServiceHealth(serviceName: string, status: ServiceStatus): void {
    const previous = serviceStatus.get(serviceName)
    serviceStatus.set(serviceName, status)

    if (previous !== status) {
        console.log(`[DegradationManager] ${serviceName}: ${previous || 'unknown'} -> ${status}`)
    }
}

/**
 * Get fallback strategy for a service
 */
export function getFallbackStrategy(serviceName: string): FallbackStrategy {
    const health = getServiceHealth(serviceName)

    if (health === 'healthy') {
        return 'primary'
    }

    return FALLBACK_STRATEGIES[serviceName] || 'disabled'
}

/**
 * Check if a service should be used or skipped
 */
export function shouldUseService(serviceName: string): boolean {
    const strategy = getFallbackStrategy(serviceName)
    return strategy === 'primary' || strategy === 'queue'
}

/**
 * Get all service statuses
 */
export function getAllServiceStatuses(): Record<string, {
    health: ServiceStatus
    fallback: FallbackStrategy
}> {
    const services = ['openai', 'gemini', 'vision', 'pinecone', 'wasabi']
    const result: Record<string, { health: ServiceStatus; fallback: FallbackStrategy }> = {}

    for (const service of services) {
        result[service] = {
            health: getServiceHealth(service),
            fallback: getFallbackStrategy(service),
        }
    }

    return result
}

/**
 * Degradation-aware service wrapper
 * Executes with fallback if primary service is unavailable
 */
export async function withDegradation<T>(
    serviceName: string,
    primaryFn: () => Promise<T>,
    fallbackFn?: () => Promise<T> | T,
    skipFallbackValue?: T
): Promise<T> {
    const strategy = getFallbackStrategy(serviceName)

    switch (strategy) {
        case 'primary':
            return await primaryFn()

        case 'queue':
            // For AI services, we still try but may queue
            return await primaryFn()

        case 'skip-rag':
        case 'dom-only':
        case 'disabled':
            // Use fallback or skip value
            if (fallbackFn) {
                console.log(`[DegradationManager] ${serviceName} degraded, using fallback`)
                return await fallbackFn()
            }
            if (skipFallbackValue !== undefined) {
                console.log(`[DegradationManager] ${serviceName} degraded, skipping`)
                return skipFallbackValue
            }
            // If no fallback, still try primary
            console.warn(`[DegradationManager] ${serviceName} degraded but no fallback, trying primary`)
            return await primaryFn()

        case 'supabase-storage':
            // Specific fallback for storage
            if (fallbackFn) {
                return await fallbackFn()
            }
            return await primaryFn()

        default:
            return await primaryFn()
    }
}

/**
 * Health check function for external services
 * Call periodically to update service status
 */
export async function runHealthChecks(checks: Record<string, () => Promise<boolean>>): Promise<void> {
    for (const [serviceName, checkFn] of Object.entries(checks)) {
        try {
            const healthy = await checkFn()
            setServiceHealth(serviceName, healthy ? 'healthy' : 'degraded')
        } catch (error) {
            setServiceHealth(serviceName, 'down')
        }
    }
}

/**
 * Reset all service statuses to healthy (for testing)
 */
export function resetAllServiceStatuses(): void {
    serviceStatus.clear()
}
