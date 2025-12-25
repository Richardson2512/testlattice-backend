export interface ConsoleError {
    type: 'error' | 'warning' | 'info'
    message: string
    source?: string
    line?: number
    column?: number
    stack?: string
    timestamp: string
}

export interface NetworkError {
    url: string
    method: string
    status: number
    statusText: string
    failed: boolean
    errorText?: string
    timestamp: string
    resourceType?: string
}

export interface PerformanceMetrics {
    pageLoadTime: number
    firstContentfulPaint?: number
    domContentLoaded?: number
    totalPageSize?: number
    jsBundleSize?: number
    cssSize?: number
    imageSize?: number
    lighthouseScore?: {
        performance: number
        accessibility: number
        bestPractices: number
        seo: number
    }
    largestContentfulPaint?: number
    firstInputDelay?: number
    cumulativeLayoutShift?: number
    timeToInteractive?: number
    totalBlockingTime?: number
    slowResources?: Array<{
        url: string
        loadTime: number
        size: number
        type: string
    }>
    duplicateScripts?: string[]
}

export interface AccessibilityIssue {
    id: string
    type: 'error' | 'warning' | 'info'
    message: string
    element?: string
    selector?: string
    impact: 'critical' | 'serious' | 'moderate' | 'minor'
    fix?: string
}

export interface VisualIssue {
    type:
    | 'layout-shift'
    | 'text-overflow'
    | 'element-overlap'
    | 'missing-element'
    | 'misaligned'
    | 'alignment-issue'
    | 'spacing-inconsistent'
    | 'broken-image'
    | 'color-inconsistent'
    | 'typography-inconsistent'
    | 'missing-hover-state'
    | 'missing-focus-state'
    | 'error-message-placement'
    | 'error-message-clarity'
    element?: string
    selector?: string
    description: string
    severity: 'high' | 'medium' | 'low'
    screenshot?: string
    expectedValue?: string
    actualValue?: string
    recommendation?: string
    browserEngine?: string
    viewport?: string
    orientation?: 'portrait' | 'landscape'
}

export interface DOMHealth {
    missingAltText: Array<{ selector: string; element: string }>
    missingLabels: Array<{ selector: string; element: string }>
    orphanedElements: Array<{ selector: string; element: string }>
    hiddenElements: Array<{ selector: string; element: string; reason: string }>
    jsErrors: ConsoleError[]
}

export interface SecurityIssue {
    type: 'xss' | 'csp' | 'insecure-resource' | 'missing-https' | 'mixed-content' | 'csrf' | 'cookies'
    severity: 'high' | 'medium' | 'low'
    message: string
    element?: string
    selector?: string
    url?: string
    fix?: string
}

export interface SEOIssue {
    type: 'missing-meta' | 'invalid-meta' | 'missing-structured-data' | 'duplicate-title' | 'missing-canonical'
    severity: 'high' | 'medium' | 'low'
    message: string
    element?: string
    fix?: string
}

export interface ThirdPartyDependency {
    domain: string
    type: 'analytics' | 'advertising' | 'cdn' | 'widget' | 'social' | 'payment' | 'unknown'
    scripts: string[]
    cookies?: string[]
    privacyRisk: 'high' | 'medium' | 'low'
    description: string
}

export type EvaluationStatus = 'pass' | 'warning' | 'fail' | 'soft-fail'

export interface EvaluationResult {
    status: EvaluationStatus
    score: number
    issues: string[]
    thresholds: Record<string, { actual: any; limit: any; status: EvaluationStatus }>
}

export interface ComprehensiveTestResults {
    consoleErrors: ConsoleError[]
    networkErrors: NetworkError[]
    performance: PerformanceMetrics
    accessibility: AccessibilityIssue[]
    visualIssues: VisualIssue[]
    domHealth: DOMHealth
    security?: SecurityIssue[]
    seo?: SEOIssue[]
    thirdPartyDependencies?: ThirdPartyDependency[]
    evaluation?: EvaluationResult
    wcagScore?: {
        level: 'A' | 'AA' | 'AAA' | 'none'
        score: number
        passed: number
        failed: number
        warnings: number
    }
}
