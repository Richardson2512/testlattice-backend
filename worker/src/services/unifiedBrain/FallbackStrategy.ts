// Fallback Strategy - Determines when to switch from 7B to 14B model
// Phase 1-3: Deterministic triggers prioritized over confidence

import { FallbackConfig, DeterministicFallbackContext } from './types'

const LOG_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase()
const DEBUG_LLM = LOG_LEVEL === 'debug' || process.env.DEBUG_LLM === 'true'

export class FallbackStrategy {
    private config: FallbackConfig

    constructor(config: FallbackConfig) {
        this.config = config
    }

    /**
     * Determine if we should fallback to 14B
     * Phase 1-3: Deterministic triggers prioritized over confidence
     */
    shouldFallback(response: any, context?: DeterministicFallbackContext): boolean {
        // Phase 1: Action Failure (Primary trigger - deterministic)
        if (this.config.fallbackOnActionFailure && context?.actionFailed) {
            if (DEBUG_LLM) {
                console.log(`[FallbackStrategy] Triggered: Action failure (selector: ${context.selector})`)
            }
            return true
        }

        // Phase 2: Structural Complexity (Deterministic)
        if (context) {
            // DOM Depth check
            if (this.config.fallbackOnDOMDepth && context.domDepth !== undefined) {
                if (context.domDepth > this.config.fallbackDOMDepthThreshold) {
                    if (DEBUG_LLM) {
                        console.log(`[FallbackStrategy] Triggered: DOM depth ${context.domDepth} > ${this.config.fallbackDOMDepthThreshold}`)
                    }
                    return true
                }
            }

            // Shadow DOM check
            if (this.config.fallbackOnShadowDOM && context.hasShadowDOM) {
                if (DEBUG_LLM) {
                    console.log(`[FallbackStrategy] Triggered: Shadow DOM (count: ${context.shadowDOMCount || 0})`)
                }
                return true
            }
        }

        // Legacy: Confidence threshold (Phase 3: optional, lower priority)
        if (this.config.fallbackOnLowConfidence && response.confidence !== undefined) {
            if (response.confidence < this.config.fallbackConfidenceThreshold) {
                if (DEBUG_LLM) {
                    console.log(`[FallbackStrategy] Triggered: Low confidence ${response.confidence} < ${this.config.fallbackConfidenceThreshold}`)
                }
                return true
            }
        }

        // Legacy: Complex scenarios
        if (this.config.fallbackOnComplex && context) {
            if (context.retryCount && context.retryCount >= 2) {
                if (DEBUG_LLM) {
                    console.log(`[FallbackStrategy] Triggered: Multiple retries (${context.retryCount})`)
                }
                return true
            }
            if (context.hasConflicts) {
                if (DEBUG_LLM) {
                    console.log(`[FallbackStrategy] Triggered: Conflicting signals`)
                }
                return true
            }
            if (context.elementCount && context.elementCount > 200) {
                if (DEBUG_LLM) {
                    console.log(`[FallbackStrategy] Triggered: Complex DOM (${context.elementCount} elements)`)
                }
                return true
            }
        }

        return false
    }

    /**
     * Get reason for fallback (for logging/metrics)
     */
    getReason(response: any, context?: DeterministicFallbackContext): string {
        // Phase 1: Action failure
        if (context?.actionFailed) {
            return `action failure (selector: ${context.selector || 'unknown'})`
        }

        // Phase 2: Structural complexity
        if (context?.domDepth && context.domDepth > this.config.fallbackDOMDepthThreshold) {
            return `DOM depth ${context.domDepth} > ${this.config.fallbackDOMDepthThreshold}`
        }
        if (context?.hasShadowDOM) {
            return `Shadow DOM detected (${context.shadowDOMCount || 0} instances)`
        }

        // Legacy reasons
        if (response.confidence !== undefined && response.confidence < this.config.fallbackConfidenceThreshold) {
            return 'low confidence'
        }
        if (context?.retryCount && context.retryCount >= 2) {
            return 'multiple retries'
        }
        if (context?.hasConflicts) {
            return 'conflicting signals'
        }
        if (context?.elementCount && context.elementCount > 200) {
            return 'complex DOM (legacy)'
        }

        return 'unknown'
    }

    /**
     * Get the fallback category for metrics
     */
    getReasonCategory(response: any, context?: DeterministicFallbackContext): 'error' | 'lowConfidence' | 'complex' | 'explicit' {
        if (context?.actionFailed) return 'error'
        if (context?.domDepth && context.domDepth > this.config.fallbackDOMDepthThreshold) return 'complex'
        if (context?.hasShadowDOM) return 'complex'
        if (response.confidence !== undefined && response.confidence < this.config.fallbackConfidenceThreshold) return 'lowConfidence'
        if (context?.retryCount && context.retryCount >= 2) return 'complex'
        if (context?.hasConflicts) return 'complex'
        if (context?.elementCount && context.elementCount > 200) return 'complex'
        return 'explicit'
    }
}

/**
 * Create default fallback configuration from environment
 */
export function createDefaultFallbackConfig(): FallbackConfig {
    return {
        fallbackOnError: process.env.UNIFIED_BRAIN_FALLBACK_ON_ERROR !== 'false',
        fallbackOnLowConfidence: process.env.UNIFIED_BRAIN_FALLBACK_ON_LOW_CONFIDENCE !== 'false',
        fallbackConfidenceThreshold: parseFloat(process.env.UNIFIED_BRAIN_FALLBACK_CONFIDENCE_THRESHOLD || '0.5'),
        fallbackOnComplex: process.env.UNIFIED_BRAIN_FALLBACK_ON_COMPLEX !== 'false',
        fallbackOnActionFailure: process.env.UNIFIED_BRAIN_FALLBACK_ON_ACTION_FAILURE !== 'false',
        fallbackOnDOMDepth: process.env.UNIFIED_BRAIN_FALLBACK_ON_DOM_DEPTH !== 'false',
        fallbackDOMDepthThreshold: parseInt(process.env.UNIFIED_BRAIN_FALLBACK_DOM_DEPTH_THRESHOLD || '15', 10),
        fallbackOnShadowDOM: process.env.UNIFIED_BRAIN_FALLBACK_ON_SHADOW_DOM !== 'false',
    }
}
