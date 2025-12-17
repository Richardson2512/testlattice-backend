// Unified Brain Service - Single model approach with 7B primary and 14B fallback
// Replaces: LayeredModelService, QwenService, and most LlamaService usage
// Architecture: Qwen 2.5 Coder 7B (primary) + Qwen 2.5 Coder 14B (fallback) + GPT-4o vision (selective)
// Using Together.ai API for Qwen models: https://api.together.xyz/v1

import axios from 'axios'
import * as cheerio from 'cheerio'
import type { Element } from 'domhandler'
import { LLMAction, VisionContext, VisionElement, AccessibilityNode, HighRiskArea } from '../types'

const LOG_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase()
const DEBUG_LLM = LOG_LEVEL === 'debug' || process.env.DEBUG_LLM === 'true'

interface ModelMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ModelResponse {
  choices: Array<{
    message: {
      role: string
      content: string
    }
  }>
}

interface ParsedInstructions {
  primaryGoal: string
  specificActions: string[]
  elementsToCheck: string[]
  expectedOutcomes: string[]
  priority: 'high' | 'medium' | 'low'
  structuredPlan: string
}

interface AlternativeSelector {
  selector: string
  strategy: 'text' | 'attribute' | 'position' | 'role'
  confidence: number
  reason: string
}

interface FallbackConfig {
  fallbackOnError: boolean
  fallbackOnLowConfidence: boolean
  fallbackConfidenceThreshold: number
  fallbackOnComplex: boolean
  // Phase 1: Deterministic triggers
  fallbackOnActionFailure: boolean // Action failure (selector not found)
  // Phase 2: Structural complexity
  fallbackOnDOMDepth: boolean // DOM depth > threshold
  fallbackDOMDepthThreshold: number // Default: 15
  fallbackOnShadowDOM: boolean // Shadow DOM detected
}

interface DeterministicFallbackContext {
  // Phase 1: Action failure
  actionFailed?: boolean // Selector not found in DOM
  actionError?: string // Playwright error message
  selector?: string // The selector that failed
  
  // Phase 2: Structural complexity
  domDepth?: number // Max nesting depth
  hasShadowDOM?: boolean // Shadow DOM detected
  shadowDOMCount?: number
  
  // Legacy (kept for backward compatibility)
  retryCount?: number
  elementCount?: number
  hasConflicts?: boolean
  errorMessage?: string
  [key: string]: any
}

interface ModelCallResult {
  content: string
  model: '7b' | '14b'
  attempt: number
  fallbackUsed: boolean
  confidence?: number
}

export class UnifiedBrainService {
  // Primary model (7B)
  private primaryApiUrl: string
  private learningService?: any // Lazy-loaded LearningService
  private primaryApiKey: string
  private primaryModel: string
  private primaryTemperature: number
  private primaryMaxTokens: number

  // Fallback model (14B)
  private fallbackApiUrl: string
  private fallbackApiKey: string
  private fallbackModel: string | null
  private fallbackTemperature: number
  private fallbackMaxTokens: number

  // Fallback configuration
  private fallbackConfig: FallbackConfig

  // Metrics tracking
  private metrics = {
    totalCalls: 0,
    primarySuccess: 0,
    fallbackUsed: 0,
    fallbackSuccess: 0,
    fallbackReasons: {
      error: 0,
      lowConfidence: 0,
      complex: 0,
      explicit: 0,
    },
  }

  constructor() {
    // Primary model (7B) - Using Together.ai
    this.primaryApiUrl = process.env.UNIFIED_BRAIN_API_URL || 'https://api.together.xyz/v1'
    this.primaryApiKey = process.env.TOGETHER_API_KEY || process.env.UNIFIED_BRAIN_API_KEY || ''
    this.primaryModel = process.env.UNIFIED_BRAIN_MODEL || 'Qwen/Qwen2.5-Coder-7B-Instruct'
    this.primaryTemperature = parseFloat(process.env.UNIFIED_BRAIN_TEMPERATURE || '0.3')
    this.primaryMaxTokens = parseInt(process.env.UNIFIED_BRAIN_MAX_TOKENS || '4096', 10)

    // Fallback model (14B) - Using Together.ai
    this.fallbackApiUrl = process.env.UNIFIED_BRAIN_FALLBACK_API_URL || 'https://api.together.xyz/v1'
    this.fallbackApiKey = process.env.TOGETHER_API_KEY || process.env.UNIFIED_BRAIN_FALLBACK_API_KEY || ''
    this.fallbackModel = process.env.UNIFIED_BRAIN_FALLBACK_MODEL || 'Qwen/Qwen2.5-Coder-14B-Instruct'
    this.fallbackTemperature = parseFloat(process.env.UNIFIED_BRAIN_FALLBACK_TEMPERATURE || '0.3')
    this.fallbackMaxTokens = parseInt(process.env.UNIFIED_BRAIN_FALLBACK_MAX_TOKENS || '4096', 10)

    // Fallback configuration
    this.fallbackConfig = {
      fallbackOnError: process.env.UNIFIED_BRAIN_FALLBACK_ON_ERROR !== 'false',
      fallbackOnLowConfidence: process.env.UNIFIED_BRAIN_FALLBACK_ON_LOW_CONFIDENCE !== 'false', // Phase 3: Make optional
      fallbackConfidenceThreshold: parseFloat(process.env.UNIFIED_BRAIN_FALLBACK_CONFIDENCE_THRESHOLD || '0.5'),
      fallbackOnComplex: process.env.UNIFIED_BRAIN_FALLBACK_ON_COMPLEX !== 'false',
      // Phase 1: Deterministic triggers
      fallbackOnActionFailure: process.env.UNIFIED_BRAIN_FALLBACK_ON_ACTION_FAILURE !== 'false', // Default: true
      // Phase 2: Structural complexity
      fallbackOnDOMDepth: process.env.UNIFIED_BRAIN_FALLBACK_ON_DOM_DEPTH !== 'false', // Default: true
      fallbackDOMDepthThreshold: parseInt(process.env.UNIFIED_BRAIN_FALLBACK_DOM_DEPTH_THRESHOLD || '15', 10),
      fallbackOnShadowDOM: process.env.UNIFIED_BRAIN_FALLBACK_ON_SHADOW_DOM !== 'false', // Default: true
    }

    if (DEBUG_LLM) {
      console.log('UnifiedBrainService initialized:')
      console.log(`  Primary (7B): ${this.primaryModel} at ${this.primaryApiUrl}`)
      console.log(`  Fallback (14B): ${this.fallbackModel} at ${this.fallbackApiUrl}`)
      console.log(`  Fallback config:`, this.fallbackConfig)
    }
  }

  /**
   * Call model with automatic fallback to 14B if needed
   */
  private async callModelWithFallback(
    prompt: string,
    systemPrompt: string,
    task: 'action' | 'parse' | 'analyze' | 'synthesize' | 'heal',
    context?: DeterministicFallbackContext
  ): Promise<ModelCallResult> {
    this.metrics.totalCalls++
    let attempt = 0
    let lastError: Error | null = null

    // Try 7B first
    try {
      attempt++
      const response = await this.callModel(
        this.primaryApiUrl,
        this.primaryApiKey,
        this.primaryModel,
        prompt,
        systemPrompt,
        this.primaryTemperature,
        this.primaryMaxTokens
      )

      // Parse response to check confidence
      let parsedResponse: any
      try {
        parsedResponse = JSON.parse(response)
      } catch {
        // If not JSON, treat as success (some tasks return plain text)
        this.metrics.primarySuccess++
        return {
          content: response,
          model: '7b',
          attempt,
          fallbackUsed: false,
        }
      }

      // Check if we should fallback based on confidence or complexity
      if (this.shouldFallbackTo14B(parsedResponse, context)) {
        const reason = this.getFallbackReason(parsedResponse, context)
        console.log(`[UnifiedBrain] 7B response requires fallback (${reason}), using 14B`)
        throw new Error(`Fallback required: ${reason}`)
      }

      this.metrics.primarySuccess++
      return {
        content: response,
        model: '7b',
        attempt,
        fallbackUsed: false,
        confidence: parsedResponse.confidence,
      }
    } catch (error: any) {
      lastError = error
      const errorMessage = error?.message || String(error)

      if (DEBUG_LLM) {
        console.warn(`[UnifiedBrain] 7B failed: ${errorMessage}`)
      }

      // Fallback to 14B if enabled
      if (this.fallbackConfig.fallbackOnError && this.fallbackModel) {
        try {
          attempt++
          this.metrics.fallbackUsed++
          this.metrics.fallbackReasons.error++

          if (DEBUG_LLM) {
            console.log(`[UnifiedBrain] Attempting fallback to 14B...`)
          }

          // Enhance prompt for 14B with context about failure
          const enhancedPrompt = this.enhancePromptForFallback(prompt, error, context)

          const response = await this.callModel(
            this.fallbackApiUrl,
            this.fallbackApiKey,
            this.fallbackModel,
            enhancedPrompt,
            systemPrompt,
            this.fallbackTemperature,
            this.fallbackMaxTokens
          )

          let parsedResponse: any
          try {
            parsedResponse = JSON.parse(response)
            this.metrics.fallbackSuccess++
            return {
              content: response,
              model: '14b',
              attempt,
              fallbackUsed: true,
              confidence: parsedResponse.confidence,
            }
          } catch {
            // Not JSON, still success
            this.metrics.fallbackSuccess++
            return {
              content: response,
              model: '14b',
              attempt,
              fallbackUsed: true,
            }
          }
        } catch (fallbackError: any) {
          console.error(`[UnifiedBrain] Both 7B and 14B failed: ${fallbackError.message}`)
          throw new Error(
            `Primary (7B) and fallback (14B) models both failed. 7B error: ${lastError?.message}, 14B error: ${fallbackError.message}`
          )
        }
      } else {
        throw error
      }
    }
  }

  /**
   * Determine if we should fallback to 14B
   * Phase 1-3: Deterministic triggers prioritized over confidence
   */
  private shouldFallbackTo14B(response: any, context?: DeterministicFallbackContext): boolean {
    // Phase 1: Action Failure (Primary trigger - deterministic)
    if (this.fallbackConfig.fallbackOnActionFailure && context?.actionFailed) {
      if (DEBUG_LLM) {
        console.log(`[UnifiedBrain] Fallback triggered: Action failure (selector: ${context.selector})`)
      }
      return true
    }

    // Phase 2: Structural Complexity (Deterministic)
    if (context) {
      // DOM Depth check
      if (this.fallbackConfig.fallbackOnDOMDepth && context.domDepth !== undefined) {
        if (context.domDepth > this.fallbackConfig.fallbackDOMDepthThreshold) {
          if (DEBUG_LLM) {
            console.log(`[UnifiedBrain] Fallback triggered: DOM depth ${context.domDepth} > ${this.fallbackConfig.fallbackDOMDepthThreshold}`)
          }
          return true
        }
      }

      // Shadow DOM check
      if (this.fallbackConfig.fallbackOnShadowDOM && context.hasShadowDOM) {
        if (DEBUG_LLM) {
          console.log(`[UnifiedBrain] Fallback triggered: Shadow DOM detected (count: ${context.shadowDOMCount || 0})`)
        }
        return true
      }
    }

    // Legacy: Confidence threshold (Phase 3: Make optional, lower priority)
    if (this.fallbackConfig.fallbackOnLowConfidence && response.confidence !== undefined) {
      if (response.confidence < this.fallbackConfig.fallbackConfidenceThreshold) {
        if (DEBUG_LLM) {
          console.log(`[UnifiedBrain] Fallback triggered: Low confidence ${response.confidence} < ${this.fallbackConfig.fallbackConfidenceThreshold}`)
        }
        return true
      }
    }

    // Legacy: Complex scenarios (kept for backward compatibility)
    if (this.fallbackConfig.fallbackOnComplex && context) {
      // Multiple retries
      if (context.retryCount && context.retryCount >= 2) {
        if (DEBUG_LLM) {
          console.log(`[UnifiedBrain] Fallback triggered: Multiple retries (${context.retryCount})`)
        }
        return true
      }
      // Conflicting signals
      if (context.hasConflicts) {
        if (DEBUG_LLM) {
          console.log(`[UnifiedBrain] Fallback triggered: Conflicting signals`)
        }
        return true
      }
      // Complex DOM structure (legacy - element count)
      if (context.elementCount && context.elementCount > 200) {
        if (DEBUG_LLM) {
          console.log(`[UnifiedBrain] Fallback triggered: Complex DOM (${context.elementCount} elements)`)
        }
        return true
      }
    }

    return false
  }

  /**
   * Get reason for fallback
   */
  private getFallbackReason(response: any, context?: DeterministicFallbackContext): string {
    // Phase 1: Action failure (highest priority)
    if (context?.actionFailed) {
      this.metrics.fallbackReasons.error++
      return `action failure (selector: ${context.selector || 'unknown'})`
    }

    // Phase 2: Structural complexity
    if (context?.domDepth && context.domDepth > this.fallbackConfig.fallbackDOMDepthThreshold) {
      this.metrics.fallbackReasons.complex++
      return `DOM depth ${context.domDepth} > ${this.fallbackConfig.fallbackDOMDepthThreshold}`
    }
    if (context?.hasShadowDOM) {
      this.metrics.fallbackReasons.complex++
      return `Shadow DOM detected (${context.shadowDOMCount || 0} instances)`
    }

    // Legacy reasons
    if (response.confidence !== undefined && response.confidence < this.fallbackConfig.fallbackConfidenceThreshold) {
      this.metrics.fallbackReasons.lowConfidence++
      return 'low confidence'
    }
    if (context?.retryCount && context.retryCount >= 2) {
      this.metrics.fallbackReasons.complex++
      return 'multiple retries'
    }
    if (context?.hasConflicts) {
      this.metrics.fallbackReasons.complex++
      return 'conflicting signals'
    }
    if (context?.elementCount && context.elementCount > 200) {
      this.metrics.fallbackReasons.complex++
      return 'complex DOM (legacy)'
    }
    return 'unknown'
  }

  /**
   * Enhance prompt for 14B fallback with failure context
   */
  private enhancePromptForFallback(originalPrompt: string, error: Error, context?: any): string {
    return `${originalPrompt}

[FALLBACK CONTEXT]
The primary model (7B) failed with: ${error.message}
${context?.errorMessage ? `Original error: ${context.errorMessage}` : ''}
${context ? `Additional context: ${JSON.stringify(context, null, 2)}` : ''}

Please provide a more detailed analysis using your enhanced reasoning capabilities.`
  }

  /**
   * Call any model via OpenAI-compatible API
   */
  private async callModel(
    apiUrl: string,
    apiKey: string,
    model: string,
    prompt: string,
    systemPrompt: string,
    temperature: number,
    maxTokens: number
  ): Promise<string> {
    const messages: ModelMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ]

    // Build headers (API key required for Together.ai)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (apiKey && apiKey !== 'ollama') {
      headers['Authorization'] = `Bearer ${apiKey}`
    } else if (apiUrl.includes('together.xyz')) {
      // Together.ai requires API key
      throw new Error('TOGETHER_API_KEY is required for Together.ai API')
    }

    const response = await axios.post<ModelResponse>(
      `${apiUrl}/chat/completions`,
      {
        model,
        messages,
        response_format: { type: 'json_object' },
        temperature,
        max_tokens: maxTokens,
      },
      {
        headers,
        timeout: 60000,
      }
    )

    const content = response.data.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from model')
    }

    return content
  }

  /**
   * Generate next action based on context and history
   * Enhanced: Checks for learned actions (heuristics) before calling AI
   * Compatible with LlamaService interface
   */
  async generateAction(
    context: VisionContext,
    history: Array<{ action: LLMAction; timestamp: string }>,
    goal: string,
    trackingInfo?: {
      visitedUrls?: string[]
      visitedSelectors?: string[]
      discoveredPages?: Array<{ url: string; title: string; selector: string }>
      currentUrl?: string
      isAllPagesMode?: boolean
      browser?: 'chromium' | 'firefox' | 'webkit'
      viewport?: string
      retryCount?: number
      // Phase 1-2: DOM analysis context
      domAnalysis?: {
        maxDepth: number
        hasShadowDOM: boolean
        shadowDOMCount: number
      }
      // Phase 1: Action failure context
      previousActionFailed?: boolean
      previousSelector?: string
      previousActionError?: string
      // God Mode Memory: Project ID and page context for heuristic lookup
      projectId?: string
      page?: any // Playwright Page instance for component hash generation
    }
  ): Promise<LLMAction> {
    // STEP 1: Heuristic Check - Check for learned actions before calling AI
    if (trackingInfo?.projectId && trackingInfo?.page && context.elements && context.elements.length > 0) {
      try {
        // Lazy-load LearningService
        if (!this.learningService) {
          const { LearningService } = await import('./learningService')
          this.learningService = new LearningService()
        }

        // Try to find learned action for the first relevant element
        const targetElement = context.elements[0] // Primary target
        if (targetElement.selector) {
          const componentHash = await this.learningService.generateComponentHash(
            trackingInfo.page,
            targetElement.selector
          )

          const learnedAction = await this.learningService.retrieveLearnedAction(
            trackingInfo.projectId,
            componentHash
          )

          if (learnedAction && learnedAction.userAction) {
            console.log(`[UnifiedBrain] 🧠 Using learned action from Run #${learnedAction.runId || 'unknown'}`)
            
            // Convert learned action to LLMAction format
            const action: LLMAction = {
              action: learnedAction.userAction.action as any,
              selector: learnedAction.userAction.selector,
              value: learnedAction.userAction.value,
              description: learnedAction.userAction.description || `Learned action (reliability: ${learnedAction.reliabilityScore})`,
              confidence: learnedAction.reliabilityScore,
            }

            // Record usage (async, don't wait)
            if (learnedAction.id) {
              this.learningService.recordHeuristicUsage(learnedAction.id, true).catch(() => {})
            }

            return action
          }
        }
      } catch (error: any) {
        // If heuristic lookup fails, fall through to AI generation
        console.warn('[UnifiedBrain] Heuristic lookup failed, using AI:', error.message)
      }
    }

    // STEP 2: AI Generation (original logic)
    const prompt = this.buildActionGenerationPrompt(context, history, goal, trackingInfo)
    const systemPrompt = this.buildActionSystemPrompt(goal, trackingInfo)

    // Build deterministic fallback context
    const fallbackContext: DeterministicFallbackContext = {
      retryCount: trackingInfo?.retryCount || 0,
      elementCount: context.elements?.length || 0,
      hasConflicts: this.detectConflicts(context, history),
      // Phase 1: Action failure
      actionFailed: trackingInfo?.previousActionFailed || false,
      selector: trackingInfo?.previousSelector,
      actionError: trackingInfo?.previousActionError,
      // Phase 2: Structural complexity
      domDepth: trackingInfo?.domAnalysis?.maxDepth,
      hasShadowDOM: trackingInfo?.domAnalysis?.hasShadowDOM,
      shadowDOMCount: trackingInfo?.domAnalysis?.shadowDOMCount,
    }

    const result = await this.callModelWithFallback(
      prompt,
      systemPrompt,
      'action',
      fallbackContext
    )

    const action = JSON.parse(result.content) as LLMAction

    if (result.fallbackUsed && DEBUG_LLM) {
      console.log(`[UnifiedBrain] Used 14B fallback for action generation`)
    }

    return action
  }

  /**
   * Parse test instructions
   * Compatible with LayeredModelService interface
   */
  async parseTestInstructions(
    instructions: string,
    currentUrl?: string
  ): Promise<ParsedInstructions> {
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

    const result = await this.callModelWithFallback(
      prompt,
      systemPrompt,
      'parse',
      { instructionLength: instructions.length }
    )

    return JSON.parse(result.content) as ParsedInstructions
  }

  /**
   * Find alternative selector for self-healing (DOM-based, no vision needed)
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

    const result = await this.callModelWithFallback(
      prompt,
      systemPrompt,
      'heal',
      { errorMessage }
    )

    const parsed = JSON.parse(result.content)
    return parsed.alternatives || []
  }

  /**
   * Synthesize context from multiple sources
   */
  async synthesizeContext(params: {
    domSnapshot: string
    consoleLogs: string[]
    networkErrors: any[]
    goal: string
  }): Promise<{
    summary: string
    issues: Array<{ type: string; description: string; severity: 'high' | 'medium' | 'low' }>
    recommendations: string[]
  }> {
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

    const result = await this.callModelWithFallback(prompt, systemPrompt, 'synthesize')

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
  ): Promise<{
    rootCause: string
    suggestedFixes: Array<{ action: string; priority: 'high' | 'medium' | 'low'; rationale: string }>
  }> {
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

    const result = await this.callModelWithFallback(prompt, systemPrompt, 'analyze', {
      errorMessage: error.message,
    })

    return JSON.parse(result.content)
  }

  /**
   * Build action generation prompt
   */
  private buildActionGenerationPrompt(
    context: VisionContext,
    history: Array<{ action: LLMAction; timestamp: string }>,
    goal: string,
    trackingInfo?: any
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
  private buildActionSystemPrompt(goal: string, trackingInfo?: any): string {
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
  private detectConflicts(context: VisionContext, history: Array<{ action: LLMAction; timestamp: string }>): boolean {
    // Simple conflict detection: multiple failed attempts with same selector
    const recentFailures = history
      .slice(-5)
      .filter((h) => h.action.action === 'click' || h.action.action === 'type')
      .map((h) => h.action.selector)
      .filter((s) => s)

    const uniqueSelectors = new Set(recentFailures)
    return recentFailures.length > uniqueSelectors.size * 2 // Same selector tried multiple times
  }

  /**
   * Analyze DOM snapshot and build a lightweight interaction context
   * Compatible with LlamaService interface
   */
  async analyzeScreenshot(_screenshotBase64: string, domSnapshot: string, goal: string): Promise<VisionContext> {
    try {
      const MAX_INTERACTIVE_ELEMENTS = Math.max(parseInt(process.env.DOM_SUMMARY_LIMIT || '200', 10), 20)
      const ACCESSIBILITY_SUMMARY_LIMIT = Math.max(parseInt(process.env.ACCESSIBILITY_SUMMARY_LIMIT || '40', 10), 5)

      const { elements, hiddenCount } = this.extractElementsFromDOM(domSnapshot)
      const limitedElements = elements.slice(0, MAX_INTERACTIVE_ELEMENTS)
      const accessibility = this.buildAccessibilitySummary(limitedElements)

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
      console.error('UnifiedBrain DOM analysis error:', error.message)
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
   * Compatible with LlamaService interface
   */
  async analyzePageTestability(context: VisionContext): Promise<{
    summary: string
    testableComponents: Array<{ name: string; selector: string; description: string; testability: 'high' | 'medium' | 'low' }>
    nonTestableComponents: Array<{ name: string; reason: string }>
    recommendedTests: string[]
    highRiskAreas?: HighRiskArea[]
  }> {
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

    const result = await this.callModelWithFallback(prompt, systemPrompt, 'analyze', {
      elementCount: context.elements.length,
    })

    try {
      return JSON.parse(result.content)
    } catch (error: any) {
      console.error('UnifiedBrain Diagnosis Error:', error.message)
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

  /**
   * Extract interactive elements from DOM HTML using cheerio parser
   */
  private extractElementsFromDOM(html: string): { elements: VisionElement[]; hiddenCount: number } {
    const elements: VisionElement[] = []
    let hiddenCount = 0

    const sanitize = (value?: string | null): string | undefined => {
      if (!value) return undefined
      const trimmed = value.replace(/\s+/g, ' ').trim()
      return trimmed.length > 0 ? trimmed : undefined
    }

    const addElement = (element: VisionElement) => {
      if (element.isHidden) hiddenCount++
      elements.push(element)
    }

    const buildSelector = (el: cheerio.Cheerio<Element>, tagName: string, text?: string): string => {
      const id = el.attr('id')
      if (id) return `#${id}`

      const dataTestId = el.attr('data-testid')
      if (dataTestId) return `[data-testid="${dataTestId}"]`

      const dataId = el.attr('data-id')
      if (dataId) return `[data-id="${dataId}"]`

      if (tagName === 'a') {
        const href = el.attr('href')
        if (href) return `a[href="${href.replace(/"/g, '\\"')}"]`
      }

      if (tagName === 'input') {
        const name = el.attr('name')
        if (name) return `[name="${name}"]`

        const placeholder = el.attr('placeholder')
        if (placeholder) return `input[placeholder="${placeholder.replace(/"/g, '\\"')}"]`

        const type = el.attr('type') || 'text'
        return `input[type="${type}"]`
      }

      if (tagName === 'select') {
        const name = el.attr('name')
        if (name) return `select[name="${name}"]`
      }

      if (tagName === 'button') {
        const ariaLabel = el.attr('aria-label')
        if (ariaLabel) return `button[aria-label="${ariaLabel.replace(/"/g, '\\"')}"]`

        const type = el.attr('type')
        if (type) return `button[type="${type}"]`
      }

      if (text) {
        return `${tagName}:has-text("${text.replace(/"/g, '\\"')}")`
      }

      const index = elements.filter((e) => e.type === tagName).length + 1
      return `${tagName}:nth-of-type(${index})`
    }

    const isElementHidden = (el: cheerio.Cheerio<Element>): boolean => {
      const type = el.attr('type')
      if (type === 'hidden') return true

      const ariaHidden = el.attr('aria-hidden')
      if (ariaHidden === 'true') return true

      const hidden = el.attr('hidden')
      if (hidden !== undefined) return true

      const style = el.attr('style')
      if (style && (style.includes('display:none') || style.includes('visibility:hidden'))) {
        return true
      }

      return false
    }

    try {
      const $ = cheerio.load(html, { xml: false })

      // Extract buttons
      $('button').each((_index: number, element: Element) => {
        const $el = $(element)
        const text = sanitize($el.text())
        const hidden = isElementHidden($el)
        const selector = buildSelector($el, 'button', text)

        addElement({
          type: 'button',
          role: 'button',
          text,
          name: text || sanitize($el.attr('aria-label')),
          ariaLabel: sanitize($el.attr('aria-label')),
          selector,
          bounds: { x: 0, y: 0, width: 120, height: 40 },
          isHidden: hidden,
        })
      })

      // Extract inputs
      $('input').each((_index: number, element: Element) => {
        const $el = $(element)
        const inputType = ($el.attr('type') || 'text').toLowerCase()
        const hidden = inputType === 'hidden' || isElementHidden($el)
        const isRequired = $el.attr('required') !== undefined || $el.attr('aria-required') === 'true'
        const minLengthAttr = $el.attr('minlength')
        const maxLengthAttr = $el.attr('maxlength')
        const minLength = minLengthAttr ? parseInt(minLengthAttr, 10) : undefined
        const maxLength = maxLengthAttr ? parseInt(maxLengthAttr, 10) : undefined
        const pattern = $el.attr('pattern') || undefined
        const selector = buildSelector($el, 'input')
        const role =
          inputType === 'checkbox'
            ? 'checkbox'
            : inputType === 'radio'
              ? 'radio'
              : inputType === 'submit'
                ? 'button'
                : 'textbox'

        addElement({
          type: hidden ? 'hidden-input' : 'input',
          inputType,
          role,
          text: sanitize($el.attr('placeholder')),
          name: sanitize($el.attr('placeholder')) || sanitize($el.attr('name')),
          ariaLabel: sanitize($el.attr('aria-label')),
          selector,
          bounds: { x: 0, y: 0, width: 300, height: 40 },
          isHidden: hidden,
          isRequired,
          minLength,
          maxLength,
          pattern,
        })
      })

      // Extract links
      $('a').each((_index: number, element: Element) => {
        const $el = $(element)
        const text = sanitize($el.text())
        const href = $el.attr('href') || ''
        const hidden = isElementHidden($el)
        const selector = buildSelector($el, 'a', text)

        if (!selector) return

        addElement({
          type: 'link',
          role: 'link',
          text,
          name: text || sanitize($el.attr('aria-label')),
          ariaLabel: sanitize($el.attr('aria-label')),
          selector,
          bounds: { x: 0, y: 0, width: 100, height: 20 },
          isHidden: hidden,
          href: href || undefined,
        })
      })

      // Extract select dropdowns
      $('select').each((_index: number, element: Element) => {
        const $el = $(element)
        if (isElementHidden($el)) return

        const selector = buildSelector($el, 'select')

        addElement({
          type: 'select',
          role: 'combobox',
          selector,
          bounds: { x: 0, y: 0, width: 200, height: 40 },
        })
      })
    } catch (error: any) {
      console.warn('UnifiedBrain: Error extracting elements from DOM:', error.message)
    }

    return { elements, hiddenCount }
  }

  /**
   * Build accessibility summary
   */
  private buildAccessibilitySummary(elements: VisionElement[]): AccessibilityNode[] {
    const nodes: AccessibilityNode[] = []
    const ACCESSIBILITY_SUMMARY_LIMIT = Math.max(parseInt(process.env.ACCESSIBILITY_SUMMARY_LIMIT || '40', 10), 5)

    const isInteractive = (element: VisionElement): boolean => {
      return ['button', 'link', 'input', 'select'].includes(element.type)
    }

    for (const element of elements) {
      const issues: string[] = []
      const hasLabel = Boolean(element.text || element.ariaLabel || element.name)

      if (isInteractive(element) && !hasLabel && !element.isHidden) {
        issues.push('missing_label')
      }

      if (element.isHidden) {
        issues.push('hidden')
      }

      if (issues.length > 0) {
        nodes.push({
          role: element.role || element.type,
          name: element.text || element.ariaLabel || element.name,
          selector: element.selector,
          issues,
        })
      }

      if (nodes.length >= ACCESSIBILITY_SUMMARY_LIMIT) {
        break
      }
    }

    return nodes
  }

  /**
   * Get metrics for monitoring
   */
  /**
   * Get metrics for monitoring (Phase 3: Enhanced metrics)
   */
  getMetrics() {
    const totalCalls = this.metrics.totalCalls
    const fallbackUsed = this.metrics.fallbackUsed
    const fallbackSuccess = this.metrics.fallbackSuccess

    return {
      ...this.metrics,
      fallbackRate: totalCalls > 0 ? fallbackUsed / totalCalls : 0,
      fallbackSuccessRate: fallbackUsed > 0 ? fallbackSuccess / fallbackUsed : 0,
      // Phase 3: Detailed breakdown
      fallbackReasonsBreakdown: {
        actionFailure: this.metrics.fallbackReasons.error,
        lowConfidence: this.metrics.fallbackReasons.lowConfidence,
        complex: this.metrics.fallbackReasons.complex,
        explicit: this.metrics.fallbackReasons.explicit,
      },
      // Phase 3: Effectiveness metrics
      primaryModelSuccessRate: totalCalls > 0 ? this.metrics.primarySuccess / totalCalls : 0,
      fallbackEffectiveness: fallbackUsed > 0 ? fallbackSuccess / fallbackUsed : 0,
      // Phase 3: Cost optimization metrics
      costOptimization: {
        primaryModelCalls: this.metrics.primarySuccess,
        fallbackCalls: fallbackUsed,
        unnecessaryFallbacks: fallbackUsed - fallbackSuccess, // Failed fallbacks
      },
    }
  }
}

