// Page Analyzer - Analyzes pages for testability and context
// Uses AI for semantic understanding

import {
    VisionContext,
    VisionElement,
    TestabilityAnalysis,
    ErrorAnalysis,
    ContextSynthesis,
    LLMAction,
    HighRiskArea
} from './types'
import { ModelClient } from './ModelClient'
import { DOMParser } from './DOMParser'
import { TOKEN_BUDGETS, buildBoundedPrompt, pruneDOM } from './tokenBudget'

export class PageAnalyzer {
    private modelClient: ModelClient
    private domParser: DOMParser

    constructor(modelClient: ModelClient) {
        this.modelClient = modelClient
        this.domParser = new DOMParser()
    }

    /**
     * Analyze DOM snapshot and validate with vision (screenshot)
     * Enhanced: Uses GPT-4o vision to validate which elements are actually visible
     */
    async analyzeScreenshot(screenshotBase64: string, domSnapshot: string, goal: string): Promise<VisionContext> {
        try {
            const MAX_INTERACTIVE_ELEMENTS = Math.max(parseInt(process.env.DOM_SUMMARY_LIMIT || '200', 10), 20)
            const ENABLE_VISION_VALIDATION = process.env.ENABLE_VISION_VALIDATION !== 'false'

            // Step 1: Parse DOM elements
            const { elements, hiddenCount } = this.domParser.extractElements(domSnapshot)
            const limitedElements = elements.slice(0, MAX_INTERACTIVE_ELEMENTS)
            const accessibility = this.domParser.buildAccessibilitySummary(limitedElements)

            // Step 2: Vision Validation (if enabled and screenshot provided)
            let validatedElements = limitedElements
            let visionValidated = false

            if (ENABLE_VISION_VALIDATION && screenshotBase64 && screenshotBase64.length > 100) {
                try {
                    console.log(`[PageAnalyzer] Vision validation: Sending screenshot + ${limitedElements.length} DOM elements to GPT-4o`)

                    // Build element summary for vision prompt (limit to top 30 for token efficiency)
                    const elementSummary = limitedElements.slice(0, 30)
                        .map((e, idx) => {
                            const label = e.text || e.ariaLabel || e.name || 'unnamed'
                            return `${idx + 1}. ${e.type}: "${label.substring(0, 50)}" - selector: "${e.selector}"`
                        })
                        .join('\n')

                    const visionPrompt = `Analyze this screenshot and validate which of these DOM elements are ACTUALLY VISIBLE and INTERACTABLE on screen.

Goal: ${goal}

DOM Elements found:
${elementSummary}

Instructions:
1. Look at the screenshot carefully
2. For each element, determine if it's visible on screen (not hidden, not behind overlays)
3. Identify which elements are clickable/interactable
4. Flag any elements that exist in DOM but are NOT visible (hidden, covered, off-screen)

Return JSON:
{
  "visibleElements": [
    {"index": 1, "visible": true, "interactable": true, "confidence": 0.95},
    {"index": 2, "visible": false, "interactable": false, "reason": "Behind modal overlay", "confidence": 0.9}
  ],
  "pageState": {
    "hasOverlay": true/false,
    "hasModal": true/false,
    "loadingComplete": true/false
  },
  "recommendedAction": "Description of what's actually clickable on screen"
}`

                    const systemPrompt = `You are an expert UI analyst. Analyze screenshots to validate which DOM elements are actually visible and interactable. Be precise - elements can exist in DOM but be hidden, behind overlays, or off-screen. Return valid JSON.`

                    const visionResult = await this.modelClient.callWithVision(
                        screenshotBase64,
                        visionPrompt,
                        systemPrompt
                    )

                    // Parse vision response
                    const visionData = JSON.parse(visionResult.content)

                    if (visionData.visibleElements && Array.isArray(visionData.visibleElements)) {
                        // Create visibility map
                        const visibilityMap = new Map<number, { visible: boolean; interactable: boolean; confidence: number; reason?: string }>()
                        visionData.visibleElements.forEach((ve: any) => {
                            visibilityMap.set(ve.index, {
                                visible: ve.visible ?? true,
                                interactable: ve.interactable ?? true,
                                confidence: ve.confidence ?? 0.8,
                                reason: ve.reason
                            })
                        })

                        // Enhance elements with visibility data
                        validatedElements = limitedElements.map((element, idx) => {
                            const visInfo = visibilityMap.get(idx + 1)
                            if (visInfo) {
                                return {
                                    ...element,
                                    visionValidated: true,
                                    visibleOnScreen: visInfo.visible,
                                    interactable: visInfo.interactable,
                                    visibilityConfidence: visInfo.confidence,
                                    visibilityReason: visInfo.reason,
                                }
                            }
                            return element
                        })

                        // Filter to only visible elements (but keep all if vision failed for most)
                        const visibleCount = validatedElements.filter((e: any) => e.visibleOnScreen !== false).length
                        if (visibleCount > 0) {
                            validatedElements = validatedElements.filter((e: any) => e.visibleOnScreen !== false)
                        }

                        visionValidated = true
                        console.log(`[PageAnalyzer] Vision validated: ${visibleCount}/${limitedElements.length} elements visible on screen`)

                        if (visionData.pageState) {
                            console.log(`[PageAnalyzer] Page state: overlay=${visionData.pageState.hasOverlay}, modal=${visionData.pageState.hasModal}, loaded=${visionData.pageState.loadingComplete}`)
                        }
                    }
                } catch (visionError: any) {
                    console.warn(`[PageAnalyzer] Vision validation failed, using DOM-only:`, visionError.message)
                    // Continue with DOM-only elements (graceful degradation)
                }
            }

            return {
                elements: validatedElements,
                accessibility,
                metadata: {
                    totalElements: elements.length,
                    interactiveElements: validatedElements.length,
                    hiddenElements: hiddenCount,
                    truncated: elements.length > limitedElements.length,
                    timestamp: new Date().toISOString(),
                    visionValidated, // Flag indicating vision was used
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
        // Limit elements to fit token budget (60 elements max for testability analysis)
        const limitedElements = context.elements.slice(0, 60)
        const contextDescription = limitedElements
            .map((e, idx) => {
                const hidden = e.isHidden ? ' [HIDDEN]' : ''
                const label = e.text || e.ariaLabel || e.name || 'unnamed'
                return `${idx + 1}. ${e.type}${hidden}: "${label}" - selector: "${e.selector}"`
            })
            .join('\n')

        const basePrompt = `Analyze these page elements for testability:

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

        // Build prompt with token budget enforcement
        const prompt = buildBoundedPrompt(basePrompt, {
            elements: contextDescription,
        }, TOKEN_BUDGETS.testability)

        const result = await this.modelClient.call(
            prompt,
            systemPrompt,
            'analyze'
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

        const result = await this.modelClient.call(prompt, systemPrompt, 'synthesize')

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
        // Prune inputs to fit token budget
        const prunedDOM = pruneDOM(context.domSnapshot, 1500)
        const limitedLogs = context.logs.slice(0, 10).join('\n')
        const actionJson = JSON.stringify(context.action, null, 2)

        const basePrompt = `Analyze this error and suggest fixes:

Error: ${error.message}

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

        // Build prompt with token budget enforcement
        const prompt = buildBoundedPrompt(basePrompt, {
            history: `Action: ${actionJson}\n\nDOM Snapshot:\n${prunedDOM}\n\nLogs:\n${limitedLogs}`,
        }, TOKEN_BUDGETS.errorAnalysis)

        const result = await this.modelClient.call(prompt, systemPrompt, 'analyze')

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
