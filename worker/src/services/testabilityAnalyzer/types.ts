/**
 * Testability Contract Types
 * 
 * These types define the output of the pre-test diagnosis phase.
 * The diagnosis answers: "Can this test run, and under what limits?"
 * 
 * NOT: "How good is the site?" (that's Audit mode)
 */

import { Page } from 'playwright'

// ============================================================================
// Test Types
// ============================================================================

export type TestType =
    // Core test types
    | 'login'
    | 'signup'
    | 'checkout'
    | 'form_submission'
    | 'navigation'
    | 'search'
    | 'data_entry'
    | 'file_upload'
    | 'custom'
    // Strongly recommended (unique blockers)
    | 'visual'
    | 'accessibility'
    // Optional / future-proof
    | 'performance'
    | 'payment'
    | 'settings'
    | 'logout'

// Frontend test types (simplified UI options)
export type FrontendTestType =
    | 'visual'
    | 'login'
    | 'signup'
    | 'form'
    | 'navigation'
    | 'accessibility'
    | 'rage_bait'

// Map frontend types to backend analysis combinations
export const TEST_TYPE_MAPPINGS: Record<FrontendTestType, TestType[]> = {
    visual: ['visual'],                                          // SEO merged into visual diagnosis
    login: ['login', 'logout'],                                  // Login + logout detection
    signup: ['signup'],                                          // Registration flows
    form: ['form_submission', 'data_entry', 'file_upload', 'checkout', 'payment'], // All form types + checkout
    navigation: ['navigation', 'search'],                        // Links + search functionality
    accessibility: ['accessibility', 'performance'],             // A11y + Core Web Vitals
    rage_bait: ['custom'],                                       // Edge cases
}

// ============================================================================
// Input Types
// ============================================================================

export interface TestabilityContractInput {
    urls: string[]
    selectedTestTypes: TestType[]
    executionMode: 'single' | 'multi-page'
    browserMatrix?: string[]
    instructions?: string
}

// ============================================================================
// Output Types - The Testability Contract
// ============================================================================

export interface TestabilityContract {
    // Per test type analysis
    testTypeAnalysis: TestTypeCapability[]

    // Global blockers (apply to all tests)
    globalBlockers: GlobalBlocker[]

    // System actions (what we'll adapt)
    systemActions: SystemAction[]

    // Overall confidence
    overallConfidence: 'high' | 'medium' | 'low'
    confidenceReason: string

    // What user must accept
    riskAcceptance: RiskAcceptanceItem[]

    // Can we proceed at all?
    canProceed: boolean
    proceedBlockedReason?: string

    // Metadata
    analyzedAt: string
    duration: number
    url: string
    pageTitle: string
}

export interface TestTypeCapability {
    testType: TestType

    // ✅ Will work reliably
    testable: {
        elements: CapabilityItem[]
        confidence: 'high' | 'medium'
    }

    // ⚠️ Might be flaky
    conditionallyTestable: {
        elements: CapabilityItem[]
        conditions: string[]
        confidence: 'medium' | 'low'
    }

    // ❌ Will not work
    notTestable: {
        elements: CapabilityItem[]
        reasons: string[]
    }
}

export interface CapabilityItem {
    name: string
    selector?: string
    reason: string
    elementType?: 'button' | 'input' | 'link' | 'select' | 'textarea' | 'form' | 'other'
}

export interface GlobalBlocker {
    type: 'captcha' | 'mfa' | 'cross_origin_iframe' | 'native_dialog' | 'email_verification' | 'payment_gateway'
    detected: boolean
    location?: string
    selector?: string
    impact: string
    severity: 'blocking' | 'warning'
}

export interface SystemAction {
    action: 'skip_selector' | 'avoid_page' | 'downgrade_check' | 'use_fallback' | 'wait_extra'
    target: string
    reason: string
}

export interface RiskAcceptanceItem {
    risk: string
    impact: string
    userMustAccept: boolean
}

// ============================================================================
// Detection Types
// ============================================================================

export interface CaptchaDetection {
    detected: boolean
    type?: 'recaptcha' | 'hcaptcha' | 'cloudflare' | 'funcaptcha' | 'unknown'
    selector?: string
    location?: string
}

export interface MFADetection {
    detected: boolean
    type?: 'otp' | 'sms' | 'email' | 'authenticator' | 'unknown'
    indicators: string[]
}

export interface IframeDetection {
    url: string
    isCrossOrigin: boolean
    purpose?: 'payment' | 'auth' | 'embed' | 'unknown'
    selector: string
}

export interface DialogDetection {
    hasAlertHandlers: boolean
    hasConfirmHandlers: boolean
    hasPromptHandlers: boolean
    hasBeforeUnload: boolean
}

export interface PageReadiness {
    isReady: boolean
    issues: string[]
    loadTime: number
    hasOverlays: boolean
    overlaySelectors: string[]
}

// ============================================================================
// Lightweight Accessibility Map (for testability only)
// ============================================================================

export interface LightweightAccessibilityMap {
    elements: LightweightElement[]
    pageInfo: {
        url: string
        title: string
    }
}

export interface LightweightElement {
    selector: string
    type: 'button' | 'input' | 'link' | 'select' | 'textarea' | 'form'
    inputType?: string
    isVisible: boolean
    hasLabel: boolean
    text?: string
    name?: string
    id?: string
    role?: string
}

// ============================================================================
// Service Interface
// ============================================================================

export interface ITestabilityAnalyzer {
    generateContract(input: TestabilityContractInput, page: Page): Promise<TestabilityContract>
}
