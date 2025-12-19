// Unified Brain Types
// Shared interfaces and types for the Unified Brain Service

import { LLMAction, VisionContext, VisionElement, AccessibilityNode, HighRiskArea } from '../../types'

export interface ModelMessage {
    role: 'system' | 'user' | 'assistant'
    content: string
}

export interface ModelResponse {
    choices: Array<{
        message: {
            role: string
            content: string
        }
    }>
}

export interface ParsedInstructions {
    primaryGoal: string
    specificActions: string[]
    elementsToCheck: string[]
    expectedOutcomes: string[]
    priority: 'high' | 'medium' | 'low'
    structuredPlan: string
}

export interface AlternativeSelector {
    selector: string
    strategy: 'text' | 'attribute' | 'position' | 'role'
    confidence: number
    reason: string
}

export interface FallbackConfig {
    fallbackOnError: boolean
    fallbackOnLowConfidence: boolean
    fallbackConfidenceThreshold: number
    fallbackOnComplex: boolean
    // Phase 1: Deterministic triggers
    fallbackOnActionFailure: boolean
    // Phase 2: Structural complexity
    fallbackOnDOMDepth: boolean
    fallbackDOMDepthThreshold: number
    fallbackOnShadowDOM: boolean
}

export interface DeterministicFallbackContext {
    // Phase 1: Action failure
    actionFailed?: boolean
    actionError?: string
    selector?: string

    // Phase 2: Structural complexity
    domDepth?: number
    hasShadowDOM?: boolean
    shadowDOMCount?: number

    // Legacy (kept for backward compatibility)
    retryCount?: number
    elementCount?: number
    hasConflicts?: boolean
    errorMessage?: string
    [key: string]: any
}

export interface ModelCallResult {
    content: string
    model: '7b' | '14b'
    attempt: number
    fallbackUsed: boolean
    confidence?: number
}

export interface UnifiedBrainMetrics {
    totalCalls: number
    primarySuccess: number
    fallbackUsed: number
    fallbackSuccess: number
    fallbackReasons: {
        error: number
        lowConfidence: number
        complex: number
        explicit: number
    }
}

export interface ActionGenerationOptions {
    visitedUrls?: string[]
    visitedSelectors?: string[]
    discoveredPages?: Array<{ url: string; title: string; selector: string }>
    currentUrl?: string
    isAllPagesMode?: boolean
    browser?: 'chromium' | 'firefox' | 'webkit'
    viewport?: string
    retryCount?: number
    domAnalysis?: {
        maxDepth: number
        hasShadowDOM: boolean
        shadowDOMCount: number
    }
    previousActionFailed?: boolean
    previousSelector?: string
    previousActionError?: string
    projectId?: string
    page?: any
}

export interface TestabilityAnalysis {
    summary: string
    testableComponents: Array<{
        name: string
        selector: string
        description: string
        testability: 'high' | 'medium' | 'low'
    }>
    nonTestableComponents: Array<{ name: string; reason: string }>
    recommendedTests: string[]
    highRiskAreas?: HighRiskArea[]
}

export interface ErrorAnalysis {
    rootCause: string
    suggestedFixes: Array<{
        action: string
        priority: 'high' | 'medium' | 'low'
        rationale: string
    }>
}

export interface ContextSynthesis {
    summary: string
    issues: Array<{
        type: string
        description: string
        severity: 'high' | 'medium' | 'low'
    }>
    recommendations: string[]
}

// Re-export types from parent
export { LLMAction, VisionContext, VisionElement, AccessibilityNode, HighRiskArea }
