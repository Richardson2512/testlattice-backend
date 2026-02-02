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
     * Returns plain English narrative with titled sections (What/How/Why/Result)
     */
    async analyzePageTestability(context: VisionContext): Promise<TestabilityAnalysis> {
        // Limit elements to 30 for faster analysis
        const limitedElements = context.elements.slice(0, 30)
        const elementSummary = limitedElements
            .map((e, idx) => {
                const label = e.text || e.ariaLabel || e.name || 'unnamed'
                return `${e.type}: "${label.substring(0, 40)}"`
            })
            .join(', ')

        const pageUrl = context.metadata?.pageUrl || 'Unknown page'

        const prompt = `Diagnose this web page for automated testing.

Page: ${pageUrl}
Elements found: ${limitedElements.length} (${elementSummary.substring(0, 500)})

Write exactly 4 titled paragraphs:

WHAT IS BEING DIAGNOSED?
[1-2 sentences about the specific flows and risk areas on this page]

HOW IS IT BEING DIAGNOSED?
[1-2 sentences about the high-level method used]

WHY IS IT BEING DIAGNOSED?
[1-2 sentences tying to user experience or business impact]

RESULT
[Start with "Passed —" or "Failed —" followed by one sentence explanation]

HARD RULES:
- Plain English only
- No bullet points or lists
- No JSON or code
- No internal service names
- Max 120 words total
- Keep each section to 1-2 sentences`

        const systemPrompt = `You are a QA diagnostician who writes clear, concise reports for humans. Output ONLY plain English paragraphs with titled sections. Never use JSON, code blocks, or bullet points. Be direct and opinionated in your assessment.`

        console.log('[PageAnalyzer] Starting AI analysis for page:', pageUrl)
        const result = await this.modelClient.call(
            prompt,
            systemPrompt,
            'analyze'
        )
        console.log('[PageAnalyzer] AI analysis complete, content length:', result.content?.length)

        // Parse the plain text response into structured format
        return this.parseNarrativeResponse(result.content, context)
    }

    /**
     * Parse plain English narrative into TestabilityAnalysis structure
     */
    private parseNarrativeResponse(narrative: string, context: VisionContext): TestabilityAnalysis {
        // Extract sections from narrative
        const whatMatch = narrative.match(/WHAT IS BEING DIAGNOSED\??\s*([\s\S]*?)(?=HOW IS IT|$)/i)
        const howMatch = narrative.match(/HOW IS IT BEING DIAGNOSED\??\s*([\s\S]*?)(?=WHY IS IT|$)/i)
        const whyMatch = narrative.match(/WHY IS IT BEING DIAGNOSED\??\s*([\s\S]*?)(?=RESULT|$)/i)
        const resultMatch = narrative.match(/RESULT\s*([\s\S]*?)$/i)

        const what = whatMatch?.[1]?.trim() || ''
        const how = howMatch?.[1]?.trim() || ''
        const why = whyMatch?.[1]?.trim() || ''
        const resultText = resultMatch?.[1]?.trim() || ''

        const passed = resultText.toLowerCase().startsWith('passed')

        // Build summary from narrative
        const summary = `${what} ${resultText}`.trim()

        // Create diagnosis narrative object
        const diagnosisNarrative = {
            what,
            how,
            why,
            result: resultText,
            passed,
            fullNarrative: narrative
        }

        return {
            summary,
            testableComponents: passed ? context.elements.slice(0, 5).map(e => ({
                name: e.text || e.type,
                selector: e.selector || '',
                description: 'Interactive element',
                testability: 'high' as const,
            })) : [],
            nonTestableComponents: [],
            recommendedTests: passed ? ['Visual regression', 'Navigation flow'] : ['Manual review required'],
            highRiskAreas: passed ? [] : [{
                name: 'Diagnosis Issue',
                type: 'manual_judgment',
                description: resultText,
                riskLevel: 'high',
                requiresManualIntervention: true,
                reason: resultText,
            }],
            // New field for narrative display
            diagnosisNarrative,
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
