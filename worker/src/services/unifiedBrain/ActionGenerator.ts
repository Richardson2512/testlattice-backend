// Action Generator - Generates test actions using AI or learned heuristics
// Supports God Mode Memory for learned actions

import {
    VisionContext,
    VisionElement,
    LLMAction,
    DeterministicFallbackContext,
    ParsedInstructions,
    AlternativeSelector,
    ActionGenerationOptions
} from './types'
import { ModelClient } from './ModelClient'
import { FallbackStrategy } from './FallbackStrategy'

const LOG_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase()
const DEBUG_LLM = LOG_LEVEL === 'debug' || process.env.DEBUG_LLM === 'true'

export class ActionGenerator {
    private modelClient: ModelClient
    private fallbackStrategy: FallbackStrategy
    private learningService?: any // Lazy-loaded

    constructor(modelClient: ModelClient, fallbackStrategy: FallbackStrategy) {
        this.modelClient = modelClient
        this.fallbackStrategy = fallbackStrategy
    }

    /**
     * Generate next action based on context and history
     * Enhanced: Checks for learned actions (heuristics) before calling AI
     */
    async generateAction(
        context: VisionContext,
        history: Array<{ action: LLMAction; timestamp: string }>,
        goal: string,
        trackingInfo?: ActionGenerationOptions
    ): Promise<LLMAction> {
        // STEP 1: Heuristic Check - Check for learned actions before calling AI
        if (trackingInfo?.projectId && trackingInfo?.page && context.elements && context.elements.length > 0) {
            try {
                const learnedAction = await this.tryLearnedAction(context, trackingInfo)
                if (learnedAction) {
                    return learnedAction
                }
            } catch (error: any) {
                console.warn('[ActionGenerator] Heuristic lookup failed, using AI:', error.message)
            }
        }

        // STEP 2: AI Generation
        const prompt = this.buildActionGenerationPrompt(context, history, goal, trackingInfo)
        const systemPrompt = this.buildActionSystemPrompt(goal, trackingInfo)

        const fallbackContext: DeterministicFallbackContext = {
            retryCount: trackingInfo?.retryCount || 0,
            elementCount: context.elements?.length || 0,
            hasConflicts: this.detectConflicts(context, history),
            actionFailed: trackingInfo?.previousActionFailed || false,
            selector: trackingInfo?.previousSelector,
            actionError: trackingInfo?.previousActionError,
            domDepth: trackingInfo?.domAnalysis?.maxDepth,
            hasShadowDOM: trackingInfo?.domAnalysis?.hasShadowDOM,
            shadowDOMCount: trackingInfo?.domAnalysis?.shadowDOMCount,
        }

        const result = await this.modelClient.callWithFallback(
            prompt,
            systemPrompt,
            'action',
            fallbackContext,
            (resp, ctx) => this.fallbackStrategy.shouldFallback(resp, ctx),
            (resp, ctx) => this.fallbackStrategy.getReason(resp, ctx)
        )

        const action = JSON.parse(result.content) as LLMAction

        if (result.fallbackUsed && DEBUG_LLM) {
            console.log(`[ActionGenerator] Used 14B fallback for action generation`)
        }

        return action
    }

    /**
     * Parse test instructions into structured plan
     */
    async parseTestInstructions(instructions: string, currentUrl?: string): Promise<ParsedInstructions> {
        const prompt = `Parse and understand these test instructions: "${instructions}"
${currentUrl ? `Current URL: ${currentUrl}` : ''}

Extract:
1. Primary goal
2. Specific actions to perform
3. Elements to check
4. Expected outcomes
5. Priority level
6. Structured step-by-step plan

Return JSON with: primaryGoal, specificActions[], elementsToCheck[], expectedOutcomes[], priority, structuredPlan`

        const systemPrompt = `You are an expert test instruction analyzer. Parse user instructions into structured, actionable test plans. Return valid JSON.`

        const result = await this.modelClient.callWithFallback(
            prompt,
            systemPrompt,
            'parse',
            { instructionLength: instructions.length }
        )

        return JSON.parse(result.content) as ParsedInstructions
    }

    /**
     * Find alternative selector for self-healing
     */
    async findAlternativeSelector(
        failedSelector: string,
        domSnapshot: string,
        errorMessage: string,
        targetText?: string
    ): Promise<AlternativeSelector[]> {
        const prompt = `Find alternative selector for failed action.

Failed Selector: ${failedSelector}
Error: ${errorMessage}
${targetText ? `Target Text: ${targetText}` : ''}

DOM Snapshot (first 3000 chars):
${domSnapshot.substring(0, 3000)}

Find alternative selectors that match the target element.
Return JSON:
{
  "alternatives": [
    {
      "selector": "...",
      "strategy": "text|attribute|position|role",
      "confidence": 0.0-1.0,
      "reason": "explanation"
    }
  ]
}`

        const systemPrompt = `You are a test automation expert specializing in selector strategies. Find reliable alternative selectors when primary selectors fail. Return valid JSON.`

        const result = await this.modelClient.callWithFallback(
            prompt,
            systemPrompt,
            'heal',
            { errorMessage }
        )

        const parsed = JSON.parse(result.content)
        return parsed.alternatives || []
    }

    /**
     * Try to find and use a learned action from God Mode Memory
     */
    private async tryLearnedAction(
        context: VisionContext,
        trackingInfo: ActionGenerationOptions
    ): Promise<LLMAction | null> {
        // Lazy-load LearningService
        if (!this.learningService) {
            const { LearningService } = await import('../learningService')
            this.learningService = new LearningService()
        }

        // Try to find learned action for the first relevant element
        const targetElement = context.elements[0]
        if (!targetElement.selector) return null

        const componentHash = await this.learningService.generateComponentHash(
            trackingInfo.page,
            targetElement.selector
        )

        const learnedAction = await this.learningService.retrieveLearnedAction(
            trackingInfo.projectId,
            componentHash
        )

        if (learnedAction && learnedAction.userAction) {
            console.log(`[ActionGenerator] 🧠 Using learned action from Run #${learnedAction.runId || 'unknown'}`)

            const action: LLMAction = {
                action: learnedAction.userAction.action as any,
                selector: learnedAction.userAction.selector,
                value: learnedAction.userAction.value,
                description: learnedAction.userAction.description || `Learned action (reliability: ${learnedAction.reliabilityScore})`,
                confidence: learnedAction.reliabilityScore,
            }

            // Record usage (async, don't wait)
            if (learnedAction.id) {
                this.learningService.recordHeuristicUsage(learnedAction.id, true).catch(() => { })
            }

            return action
        }

        return null
    }

    /**
     * Build action generation prompt
     */
    private buildActionGenerationPrompt(
        context: VisionContext,
        history: Array<{ action: LLMAction; timestamp: string }>,
        goal: string,
        trackingInfo?: ActionGenerationOptions
    ): string {
        const elements = context.elements?.slice(0, 50) || []
        const historyText = history
            .slice(-5)
            .map((h) => `${h.action.action} ${h.action.selector || h.action.target || ''}`)
            .join('\n')

        return `You are a test automation AI. Generate the next action.

Goal: ${goal}

Current URL: ${(context as any).metadata?.currentUrl || 'unknown'}
${trackingInfo?.browser ? `Browser: ${trackingInfo.browser}` : ''}
${trackingInfo?.viewport ? `Viewport: ${trackingInfo.viewport}` : ''}

Available Elements (first 50):
${elements
                .map(
                    (e: VisionElement, i: number) =>
                        `${i + 1}. ${e.type}: "${e.text || e.ariaLabel || e.name || 'unnamed'}" - selector: "${e.selector || 'N/A'}"`
                )
                .join('\n')}

Recent Actions:
${historyText || 'None'}

${trackingInfo?.visitedUrls ? `Visited URLs: ${trackingInfo.visitedUrls.slice(-5).join(', ')}` : ''}
${trackingInfo?.visitedSelectors ? `Visited Selectors: ${trackingInfo.visitedSelectors.slice(-10).join(', ')}` : ''}

Generate the next action as JSON:
{
  "action": "click|type|scroll|navigate|wait|assert|complete",
  "target": "description",
  "selector": "playwright selector",
  "value": "value if type",
  "description": "why this action",
  "confidence": 0.0-1.0
}`
    }

    /**
     * Build action generation system prompt
     */
    private buildActionSystemPrompt(goal: string, trackingInfo?: ActionGenerationOptions): string {
        const parts: string[] = []
        parts.push('You are a test automation expert. Generate precise, actionable test steps.')

        if (trackingInfo?.browser) {
            const browserName = trackingInfo.browser.charAt(0).toUpperCase() + trackingInfo.browser.slice(1)
            parts.push(`\nBrowser: ${browserName}`)
            if (trackingInfo.browser === 'firefox') {
                parts.push('Note: Prefer data-testid or ID selectors. Some CSS pseudo-selectors may behave differently.')
            } else if (trackingInfo.browser === 'webkit') {
                parts.push('Note: Verify element visibility carefully. Some modern CSS features may not be fully supported.')
            }
        }

        parts.push('\nRules:')
        parts.push('1. DO NOT return "wait" unless absolutely necessary')
        parts.push('2. DO NOT return "complete" unless the test goal is fully achieved')
        parts.push('3. Always prefer interactive actions (click, type, scroll) over passive actions')
        parts.push('4. Use element.selector if provided (most reliable)')
        parts.push('5. For text-based selection, use: button:has-text("Text") or text="Text"')
        parts.push('6. NEVER use querySelector() syntax - use Playwright locator syntax')
        parts.push('7. Return valid JSON with action, selector, description, and confidence (0.0-1.0)')

        return parts.join('\n')
    }

    /**
     * Detect conflicts in context/history
     */
    private detectConflicts(
        context: VisionContext,
        history: Array<{ action: LLMAction; timestamp: string }>
    ): boolean {
        const recentFailures = history
            .slice(-5)
            .filter((h) => h.action.action === 'click' || h.action.action === 'type')
            .map((h) => h.action.selector)
            .filter((s) => s)

        const uniqueSelectors = new Set(recentFailures)
        return recentFailures.length > uniqueSelectors.size * 2
    }
}
