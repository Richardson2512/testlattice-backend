
import {
    ComprehensiveTestResults,
    EvaluationResult,
    EvaluationStatus,
    PerformanceMetrics,
    AccessibilityIssue,
    SecurityIssue,
    VisualIssue
} from '../types'

/**
 * SUCCESS RULES & THRESHOLDS
 * Based on industry standards (Google Web Vitals, WCAG, OWASP)
 */
export const THRESHOLDS = {
    performance: {
        lcp: { warning: 2500, fail: 4000 },      // ms
        cls: { warning: 0.1, fail: 0.25 },       // score
        lighthouse: { warning: 90, fail: 50 }    // score (0-100)
    },
    accessibility: {
        criticalAllowed: 0,                      // Hard fail if > 0 critical issues
        seriousAllowed: 0                        // Hard fail if > 0 serious issues
    },
    visual: {
        diffPercentage: { warning: 1.0, fail: 5.0 } // 1% warning, 5% soft fail
    },
    security: {
        criticalAllowed: 0,
        highAllowed: 0,
        mediumAllowed: 0 // Zero tolerance policy for OWASP top 10
    }
}

export class SuccessEvaluator {

    /**
     * Evaluate comprehensive results against standard success rules
     */
    evaluate(results: ComprehensiveTestResults): EvaluationResult {
        const issues: string[] = []
        const thresholds: Record<string, { actual: any; limit: any; status: EvaluationStatus }> = {}
        let status: EvaluationStatus = 'pass'

        // 1. Performance Evaluation
        const perfStatus = this.evaluatePerformance(results.performance, issues, thresholds)
        status = this.aggregateStatus(status, perfStatus)

        // 2. Accessibility Evaluation
        const a11yStatus = this.evaluateAccessibility(results.accessibility, issues, thresholds)
        status = this.aggregateStatus(status, a11yStatus)

        // 3. Visual Evaluation (Advanced Product Quality Guardrails)
        if (results.visualIssues?.length > 0) {
            const visualStatus = this.evaluateVisuals(results.visualIssues, issues, thresholds)
            status = this.aggregateStatus(status, visualStatus)
        }

        // 4. Security Evaluation (if available)
        if (results.security) {
            const secStatus = this.evaluateSecurity(results.security, issues, thresholds)
            status = this.aggregateStatus(status, secStatus)
        }

        return {
            status,
            score: this.calculateOverallScore(status, issues.length),
            issues,
            thresholds
        }
    }

    private evaluatePerformance(
        metrics: PerformanceMetrics | undefined,
        issues: string[],
        thresholds: Record<string, any>
    ): EvaluationStatus {
        if (!metrics) return 'pass'

        let status: EvaluationStatus = 'pass'

        // LCP Check
        if (metrics.largestContentfulPaint) {
            const lcp = metrics.largestContentfulPaint
            if (lcp > THRESHOLDS.performance.lcp.fail) {
                status = 'soft-fail'
                issues.push(`LCP (${lcp}ms) exceeds limit (${THRESHOLDS.performance.lcp.fail}ms)`)
                thresholds['LCP'] = { actual: lcp, limit: THRESHOLDS.performance.lcp.fail, status: 'soft-fail' }
            } else if (lcp > THRESHOLDS.performance.lcp.warning) {
                status = this.aggregateStatus(status, 'warning')
                issues.push(`LCP (${lcp}ms) needs improvement (> ${THRESHOLDS.performance.lcp.warning}ms)`)
                thresholds['LCP'] = { actual: lcp, limit: THRESHOLDS.performance.lcp.warning, status: 'warning' }
            }
        }

        // CLS Check
        if (metrics.cumulativeLayoutShift !== undefined) {
            const cls = metrics.cumulativeLayoutShift
            if (cls > THRESHOLDS.performance.cls.fail) {
                status = 'soft-fail'
                issues.push(`CLS (${cls.toFixed(3)}) exceeds limit (${THRESHOLDS.performance.cls.fail})`)
                thresholds['CLS'] = { actual: cls, limit: THRESHOLDS.performance.cls.fail, status: 'soft-fail' }
            } else if (cls > THRESHOLDS.performance.cls.warning) {
                status = this.aggregateStatus(status, 'warning')
                issues.push(`CLS (${cls.toFixed(3)}) needs improvement (> ${THRESHOLDS.performance.cls.warning})`)
                thresholds['CLS'] = { actual: cls, limit: THRESHOLDS.performance.cls.warning, status: 'warning' }
            }
        }

        return status
    }

    private evaluateAccessibility(
        issues: AccessibilityIssue[],
        issueList: string[],
        thresholds: Record<string, any>
    ): EvaluationStatus {
        const critical = issues.filter(i => i.impact === 'critical').length
        const serious = issues.filter(i => i.impact === 'serious').length

        if (critical > THRESHOLDS.accessibility.criticalAllowed) {
            issueList.push(`Found ${critical} CRITICAL accessibility violations`)
            thresholds['A11y Critical'] = { actual: critical, limit: 0, status: 'fail' }
            return 'fail' // Hard fail for A11y
        }

        if (serious > THRESHOLDS.accessibility.seriousAllowed) {
            issueList.push(`Found ${serious} SERIOUS accessibility violations`)
            thresholds['A11y Serious'] = { actual: serious, limit: 0, status: 'fail' }
            return 'fail'
        }

        return 'pass'
    }

    private evaluateVisuals(
        issues: VisualIssue[],
        issueList: string[],
        thresholds: Record<string, any>
    ): EvaluationStatus {
        // Filter by AI-determined severity
        const highSeverity = issues.filter(i => i.severity === 'high' || i.description.toLowerCase().includes('broken') || i.description.toLowerCase().includes('missing'))
        const mediumSeverity = issues.filter(i => i.severity === 'medium')

        // Strategy: High severity = Fail (Production Blocker), Medium = Warning (Product Polish)

        if (highSeverity.length > 0) {
            issueList.push(`Found ${highSeverity.length} CRITICAL visual bugs (AI detected)`)
            highSeverity.forEach(i => issueList.push(`   - ${i.description}`)) // Context
            thresholds['Visual Critical'] = { actual: highSeverity.length, limit: 0, status: 'fail' }
            return 'fail'
        }

        if (mediumSeverity.length > 0) {
            issueList.push(`Found ${mediumSeverity.length} visual polish issues`)
            thresholds['Visual Polish'] = { actual: mediumSeverity.length, limit: 0, status: 'warning' }
            return 'warning'
        }

        return 'pass'
    }

    private evaluateSecurity(
        issues: SecurityIssue[],
        issueList: string[],
        thresholds: Record<string, any>
    ): EvaluationStatus {
        const critical = issues.filter(i => i.severity === 'high').length // Mapping high to critical/high

        if (critical > 0) {
            issueList.push(`Found ${critical} HIGH severity security vulnerabilities`)
            thresholds['Security High'] = { actual: critical, limit: 0, status: 'fail' }
            return 'fail'
        }

        return 'pass'
    }

    /**
     * Determines overall status based on current and new status
     * Priority: fail > soft-fail > warning > pass
     */
    private aggregateStatus(current: EvaluationStatus, newStatus: EvaluationStatus): EvaluationStatus {
        const priority = { 'fail': 3, 'soft-fail': 2, 'warning': 1, 'pass': 0 }
        return priority[newStatus] > priority[current] ? newStatus : current
    }

    private calculateOverallScore(status: EvaluationStatus, issueCount: number): number {
        const baseScores = { 'pass': 100, 'warning': 85, 'soft-fail': 60, 'fail': 0 }
        // Simple deduction logic: -5 per issue, floored at status base
        return Math.max(0, baseScores[status] - (issueCount * 2))
    }
}
