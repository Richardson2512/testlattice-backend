/**
 * PostExecutionInterpreter
 * AI interpretation layer that runs AFTER test execution
 * Uses available AI services for findings interpretation, never blocks execution
 */

import { TestStep, VisionContext } from '../types'
import { Finding, FindingsReport } from '../processors/shared/findings/types'
import { logger } from '../observability'

export interface InterpretationResult {
    summary: string
    severity: 'critical' | 'major' | 'minor' | 'info'
    userFriendlyExplanation: string
    suggestedFixes: string[]
    confidence: number
}

export interface TestInterpretation {
    overallScore: number
    overallSummary: string
    stepInterpretations: Array<{
        stepId: string
        interpretation: InterpretationResult
    }>
    uxInsights: string[]
    recommendations: string[]
}

/**
 * PostExecutionInterpreter
 * Provides heuristic-based interpretation when AI is not available
 * Can be extended to use AI services for richer interpretation
 */
export class PostExecutionInterpreter {
    /**
     * Interpret all findings after test completion
     * Non-blocking: failures here don't affect test results
     */
    async interpretFindings(
        runId: string,
        steps: TestStep[],
        url: string
    ): Promise<TestInterpretation> {
        try {
            return this.buildInterpretation(steps, url)
        } catch (error: any) {
            logger.warn({ runId, error: error.message }, 'Interpretation failed, using defaults')
            return this.buildDefaultInterpretation(steps)
        }
    }

    /**
     * Interpret a single finding (for real-time updates)
     */
    interpretSingleFinding(finding: Finding): InterpretationResult {
        return {
            summary: finding.message,
            severity: finding.severity,
            userFriendlyExplanation: this.generateExplanation(finding),
            suggestedFixes: this.generateSuggestions(finding),
            confidence: 0.7
        }
    }

    /**
     * Generate UX insights from test execution
     */
    generateUXInsights(steps: TestStep[], url: string): string[] {
        const insights: string[] = []

        const failedSteps = steps.filter(s => !s.success)
        const slowSteps = steps.filter(s => (s.metadata?.duration || 0) > 5000)

        // Analyze failure patterns
        if (failedSteps.length > steps.length * 0.3) {
            insights.push('High failure rate detected. Consider reviewing the test targets or improving site stability.')
        }

        if (slowSteps.length > 0) {
            insights.push(`${slowSteps.length} slow interactions detected (>5s). This may indicate performance issues.`)
        }

        // Check for common patterns
        const clickFailures = failedSteps.filter(s => s.action === 'click')
        if (clickFailures.length > 2) {
            insights.push('Multiple click failures suggest possible layout shifts or invisible overlays.')
        }

        const typeFailures = failedSteps.filter(s => s.action === 'type')
        if (typeFailures.length > 0) {
            insights.push('Form input failures may indicate validation issues or missing form fields.')
        }

        return insights
    }

    private buildInterpretation(steps: TestStep[], url: string): TestInterpretation {
        const successCount = steps.filter(s => s.success).length
        const score = steps.length > 0 ? Math.round((successCount / steps.length) * 100) : 0

        const failedSteps = steps.filter(s => !s.success)
        const uxInsights = this.generateUXInsights(steps, url)

        // Generate recommendations based on failures
        const recommendations: string[] = []
        if (failedSteps.length > 0) {
            recommendations.push(`Review ${failedSteps.length} failed steps for potential fixes`)
        }
        if (score < 70) {
            recommendations.push('Consider adding explicit wait conditions between actions')
        }
        if (score < 50) {
            recommendations.push('Test target may need stability improvements before automation')
        }

        return {
            overallScore: score,
            overallSummary: this.generateSummary(steps, url),
            stepInterpretations: failedSteps.map(step => ({
                stepId: step.id,
                interpretation: this.interpretStep(step)
            })),
            uxInsights,
            recommendations
        }
    }

    private buildDefaultInterpretation(steps: TestStep[]): TestInterpretation {
        const successCount = steps.filter(s => s.success).length
        const score = steps.length > 0 ? Math.round((successCount / steps.length) * 100) : 0

        return {
            overallScore: score,
            overallSummary: `Test completed with ${successCount}/${steps.length} steps successful.`,
            stepInterpretations: [],
            uxInsights: [],
            recommendations: []
        }
    }

    private interpretStep(step: TestStep): InterpretationResult {
        const severity = step.success ? 'info' : 'major'
        return {
            summary: `${step.action} on ${step.target || 'element'}`,
            severity,
            userFriendlyExplanation: step.error || 'Step completed successfully',
            suggestedFixes: step.error ? this.suggestFixes(step) : [],
            confidence: 0.7
        }
    }

    private generateSummary(steps: TestStep[], url: string): string {
        const successCount = steps.filter(s => s.success).length
        const failCount = steps.length - successCount

        if (failCount === 0) {
            return `All ${steps.length} test steps completed successfully on ${new URL(url).hostname}.`
        }

        return `Test completed with ${successCount} successful and ${failCount} failed steps on ${new URL(url).hostname}.`
    }

    private generateExplanation(finding: Finding): string {
        const explanations: Record<string, string> = {
            'console_error': 'A JavaScript error occurred on the page. This may indicate a bug in the website code.',
            'network_error': 'A network request failed. This could affect page functionality.',
            'accessibility': 'An accessibility issue was found. This may make the site harder to use for some users.',
            'visual': 'A visual issue was detected. The layout may not appear as intended.',
            'performance': 'A performance issue was detected. The page may load slowly for users.'
        }

        return explanations[finding.type] || finding.details || finding.message
    }

    private generateSuggestions(finding: Finding): string[] {
        const suggestions: Record<string, string[]> = {
            'console_error': ['Check browser console for detailed error messages', 'Review recent code changes'],
            'network_error': ['Verify API endpoint availability', 'Check network configuration'],
            'accessibility': ['Add ARIA labels where needed', 'Ensure proper heading hierarchy'],
            'visual': ['Check CSS for layout issues', 'Verify responsive design breakpoints'],
            'performance': ['Optimize image sizes', 'Enable caching', 'Minimize JavaScript bundles']
        }

        return suggestions[finding.type] || []
    }

    private suggestFixes(step: TestStep): string[] {
        const fixes: string[] = []
        const error = step.error?.toLowerCase() || ''

        if (error.includes('timeout')) {
            fixes.push('Increase wait timeout or add explicit wait conditions')
        }
        if (error.includes('not found') || error.includes('no element')) {
            fixes.push('Verify the selector is correct and element exists')
        }
        if (error.includes('not visible') || error.includes('hidden')) {
            fixes.push('Check for overlays or popups blocking the element')
        }
        if (error.includes('navigation')) {
            fixes.push('Ensure the target URL is accessible and responds')
        }

        return fixes.length > 0 ? fixes : ['Review the step target and action']
    }
}
