// Page Analyzer - Analyzes pages for testability and context
// Uses AI for semantic understanding

import {
    VisionContext,
    VisionElement,
    TestabilityAnalysis,
    ErrorAnalysis,
    ContextSynthesis,
    DeterministicFallbackContext,
    LLMAction,
    HighRiskArea
} from './types'
import { ModelClient } from './ModelClient'
import { FallbackStrategy } from './FallbackStrategy'
import { DOMParser } from './DOMParser'

export class PageAnalyzer {
    private modelClient: ModelClient
    private fallbackStrategy: FallbackStrategy
    private domParser: DOMParser

    constructor(modelClient: ModelClient, fallbackStrategy: FallbackStrategy) {
        this.modelClient = modelClient
        this.fallbackStrategy = fallbackStrategy
        this.domParser = new DOMParser()
    }

    /**
     * Analyze DOM snapshot and build a lightweight interaction context
     */
    async analyzeScreenshot(_screenshotBase64: string, domSnapshot: string, goal: string): Promise<VisionContext> {
        try {
            const MAX_INTERACTIVE_ELEMENTS = Math.max(parseInt(process.env.DOM_SUMMARY_LIMIT || '200', 10), 20)

            const { elements, hiddenCount } = this.domParser.extractElements(domSnapshot)
            const limitedElements = elements.slice(0, MAX_INTERACTIVE_ELEMENTS)
            const accessibility = this.domParser.buildAccessibilitySummary(limitedElements)

            return {
                elements: limitedElements,
                accessibility,
                metadata: {
                    totalElements: elements.length,
                    interactiveElements: limitedElements.length,
                    hiddenElements: hiddenCount,
                    truncated: elements.length > limitedElements.length,
                    timestamp: new Date().toISOString(),
                },
            }
        } catch (error: any) {
            console.error('PageAnalyzer DOM analysis error:', error.message)
            return {
                elements: [],
                accessibility: [],
                metadata: {
                    totalElements: 0,
                    interactiveElements: 0,
                    hiddenElements: 0,
                    truncated: false,
                    timestamp: new Date().toISOString(),
                },
            }
        }
    }

    /**
     * Analyze page for testability - UI Diagnosis Phase
     */
    async analyzePageTestability(context: VisionContext): Promise<TestabilityAnalysis> {
        const contextDescription = context.elements
            .slice(0, 60)
            .map((e, idx) => {
                const hidden = e.isHidden ? ' [HIDDEN]' : ''
                const label = e.text || e.ariaLabel || e.name || 'unnamed'
                return `${idx + 1}. ${e.type}${hidden}: "${label}" - selector: "${e.selector}"`
            })
            .join('\n')

        const prompt = `Analyze these page elements for testability:

${contextDescription}

Provide:
1. Summary of page purpose
2. Testable components (name, selector, description, testability level)
3. Non-testable components (name, reason)
4. Recommended tests
5. High-risk areas (third-party integrations, complex state, flaky components, security-sensitive, manual judgment)

Return JSON:
{
  "summary": "...",
  "testableComponents": [{"name": "...", "selector": "...", "description": "...", "testability": "high|medium|low"}],
  "nonTestableComponents": [{"name": "...", "reason": "..."}],
  "recommendedTests": ["..."],
  "highRiskAreas": [{"name": "...", "type": "...", "selector": "...", "description": "...", "riskLevel": "critical|high|medium|low", "requiresManualIntervention": true/false, "reason": "..."}]
}`

        const systemPrompt = `You are an expert QA Automation Engineer specializing in risk assessment and testability analysis. Analyze web page elements and generate a comprehensive Testability Diagnosis Report with HIGH-RISK AREA DETECTION. Return valid JSON.`

        const fallbackContext: DeterministicFallbackContext = {
            elementCount: context.elements.length,
        }

        const result = await this.modelClient.callWithFallback(
            prompt,
            systemPrompt,
            'analyze',
            fallbackContext,
            (resp, ctx) => this.fallbackStrategy.shouldFallback(resp, ctx),
            (resp, ctx) => this.fallbackStrategy.getReason(resp, ctx)
        )

        try {
            return JSON.parse(result.content)
        } catch (error: any) {
            console.error('PageAnalyzer Diagnosis Error:', error.message)
            return this.getFallbackTestabilityAnalysis(context)
        }
    }

    /**
     * Synthesize context from multiple sources
     */
    async synthesizeContext(params: {
        domSnapshot: string
        consoleLogs: string[]
        networkErrors: any[]
        goal: string
    }): Promise<ContextSynthesis> {
        const prompt = `Synthesize context from multiple sources:

DOM Snapshot (first 2000 chars):
${params.domSnapshot.substring(0, 2000)}

Console Logs:
${params.consoleLogs.slice(0, 20).join('\n')}

Network Errors:
${JSON.stringify(params.networkErrors.slice(0, 10), null, 2)}

Goal: ${params.goal}

Provide:
1. Summary of current state
2. Issues found (type, description, severity)
3. Recommendations

Return JSON:
{
  "summary": "...",
  "issues": [{"type": "...", "description": "...", "severity": "high|medium|low"}],
  "recommendations": ["..."]
}`

        const systemPrompt = `You are a context synthesis expert. Analyze multiple data sources and provide clear, actionable insights. Return valid JSON.`

        const result = await this.modelClient.callWithFallback(prompt, systemPrompt, 'synthesize')

        return JSON.parse(result.content)
    }

    /**
     * Analyze errors and suggest fixes
     */
    async analyzeError(
        error: Error,
        context: {
            action: LLMAction
            domSnapshot: string
            logs: string[]
        }
    ): Promise<ErrorAnalysis> {
        const prompt = `Analyze this error and suggest fixes:

Error: ${error.message}
Action: ${JSON.stringify(context.action, null, 2)}
DOM Snapshot (first 2000 chars): ${context.domSnapshot.substring(0, 2000)}
Logs: ${context.logs.slice(0, 10).join('\n')}

Provide:
1. Root cause analysis
2. Suggested fixes with priority and rationale

Return JSON:
{
  "rootCause": "...",
  "suggestedFixes": [
    {"action": "...", "priority": "high|medium|low", "rationale": "..."}
  ]
}`

        const systemPrompt = `You are a debugging specialist. Analyze errors and provide actionable fixes. Return valid JSON.`

        const result = await this.modelClient.callWithFallback(prompt, systemPrompt, 'analyze', {
            errorMessage: error.message,
        })

        return JSON.parse(result.content)
    }

    /**
     * Fallback testability analysis when AI fails
     */
    private getFallbackTestabilityAnalysis(context: VisionContext): TestabilityAnalysis {
        return {
            summary: 'Automated diagnosis failed - verify page manually.',
            testableComponents: context.elements.slice(0, 5).map((e) => ({
                name: e.text || e.type,
                selector: e.selector || '',
                description: `Detected ${e.type}`,
                testability: 'medium' as const,
            })),
            nonTestableComponents: [],
            recommendedTests: ['Basic functionality check'],
            highRiskAreas: [
                {
                    name: 'Diagnosis Failure',
                    type: 'manual_judgment',
                    description: 'Automated diagnosis failed - manual review required',
                    riskLevel: 'high',
                    requiresManualIntervention: true,
                    reason: 'LLM analysis failed, manual verification needed to identify testability issues',
                },
            ],
        }
    }
}
