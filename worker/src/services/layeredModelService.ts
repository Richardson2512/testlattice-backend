// Layered Model Service - Routes tasks to appropriate models based on complexity
// Architecture:
// 1. Vision Layer - GPT-4V (commercial) - screenshot analysis only
// 2. Mid-Reasoning Layer - Qwen-2.5-Coder-7B-Instruct - merging outputs, interpreting logs, classifying failures
// 3. Heavy Reasoning Layer - Qwen-2.5-Coder-14B-Instruct - deep reasoning, root-cause analysis
// 4. Utility Layer - Llama 8B - trivial parsing, routing, metadata extraction

import axios from 'axios'
import { VisionValidatorService } from './visionValidator'

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

export interface VisionAnalysis {
  semanticInterpretation: string
  uiIssues: Array<{ type: string; description: string; severity: 'high' | 'medium' | 'low' }>
  inconsistencies: Array<{ type: string; description: string }>
  deviceFrame?: { type: string; detected: boolean }
  textInImages: string[]
  summary: string
}

export interface MergedAnalysis {
  visionOutput: VisionAnalysis
  consoleLogs: string[]
  backendResponses: any[]
  classification: {
    failureType: 'ui' | 'backend' | 'network' | 'logic' | 'none'
    severity: 'high' | 'medium' | 'low'
    confidence: number
  }
  causeVsSymptom: {
    rootCause: string
    symptoms: string[]
    explanation: string
  }
  userFriendlyExplanation: string
}

export interface DeepReasoningResult {
  chainOfThought: string[]
  conflictResolution?: {
    uiSays: string
    backendSays: string
    resolution: string
    confidence: number
  }
  rootCauseAnalysis: {
    primaryCause: string
    contributingFactors: string[]
    evidence: string[]
  }
  recommendedFixes: Array<{
    action: string
    priority: 'high' | 'medium' | 'low'
    rationale: string
  }>
  fullStackView: {
    frontend: any
    backend: any
    integration: string
  }
}

export class LayeredModelService {
  // Vision Layer - GPT-4V (commercial)
  private visionService: VisionValidatorService | null

  // Mid-Reasoning Layer - Qwen-2.5-Coder-7B-Instruct (replaces Qwen 32B)
  private qwenCoder7bApiUrl: string
  private qwenCoder7bApiKey: string
  private qwenCoder7bModel: string

  // Heavy Reasoning Layer - Qwen-2.5-Coder-14B-Instruct (replaces Llama 4 Scout)
  private qwenCoder14bApiUrl: string
  private qwenCoder14bApiKey: string
  private qwenCoder14bModel: string

  // Utility Layer - Llama 8B
  private llama8bApiUrl: string
  private llama8bApiKey: string
  private llama8bModel: string

  constructor() {
    // Vision Layer - GPT-4V
    const visionApiKey = process.env.OPENAI_API_KEY || process.env.GPT4V_API_KEY || ''
    this.visionService = visionApiKey ? new VisionValidatorService(
      visionApiKey,
      process.env.VISION_MODEL || 'gpt-4-vision-preview',
      process.env.VISION_MODEL_ENDPOINT || 'https://api.openai.com/v1/chat/completions'
    ) : null

    // Mid-Reasoning Layer - Qwen-2.5-Coder-7B-Instruct (replaces Qwen 32B, local Ollama)
    this.qwenCoder7bApiUrl = process.env.QWEN_CODER_7B_API_URL || 'http://localhost:11434/v1'
    this.qwenCoder7bApiKey = process.env.QWEN_CODER_7B_API_KEY || 'ollama'
    this.qwenCoder7bModel = process.env.QWEN_CODER_7B_MODEL || 'qwen2.5-coder:7b'

    // Heavy Reasoning Layer - Qwen-2.5-Coder-14B-Instruct (replaces Llama 4 Scout, local Ollama)
    this.qwenCoder14bApiUrl = process.env.QWEN_CODER_14B_API_URL || 'http://localhost:11434/v1'
    this.qwenCoder14bApiKey = process.env.QWEN_CODER_14B_API_KEY || 'ollama'
    this.qwenCoder14bModel = process.env.QWEN_CODER_14B_MODEL || 'qwen2.5-coder:14b'

    // Utility Layer - Llama 8B (local Ollama) - kept for backward compatibility
    this.llama8bApiUrl = process.env.LLAMA_8B_API_URL || 'http://localhost:11434/v1'
    this.llama8bApiKey = process.env.LLAMA_8B_API_KEY || 'ollama'
    this.llama8bModel = process.env.LLAMA_8B_MODEL || 'llama3.2:8b'

    if (DEBUG_LLM) {
      console.log('LayeredModelService initialized:')
      console.log('  Vision (GPT-4V):', this.visionService ? '✅' : '❌')
      console.log('  Mid-Reasoning (Qwen-Coder-7B):', this.qwenCoder7bModel, 'at', this.qwenCoder7bApiUrl)
      console.log('  Heavy Reasoning (Qwen-Coder-14B):', this.qwenCoder14bModel, 'at', this.qwenCoder14bApiUrl)
      console.log('  Utility (Llama 8B):', this.llama8bModel, 'at', this.llama8bApiUrl)
    }
  }

  /**
   * Layer 1: Vision Analysis - GPT-4V only
   * Handles: screenshot → semantic interpretation, UI issues, inconsistencies, device frames, text in images
   */
  async analyzeVision(screenshotBase64: string, context?: { url?: string; goal?: string }): Promise<VisionAnalysis> {
    if (!this.visionService) {
      throw new Error('GPT-4V vision service not configured. Set OPENAI_API_KEY or GPT4V_API_KEY')
    }

    try {
      const visionIssues = await this.visionService.analyzeScreenshot(screenshotBase64, context)
      
      // Enhanced vision analysis with GPT-4V
      const messages: ModelMessage[] = [
        {
          role: 'system',
          content: `You are a computer vision expert analyzing UI screenshots. Extract:
1. Semantic interpretation of what the UI shows
2. UI issues (layout, overlaps, missing elements)
3. Inconsistencies (styling, alignment, spacing)
4. Device frame detection (mobile, tablet, desktop)
5. All text visible in the image

Return JSON with: semanticInterpretation, uiIssues[], inconsistencies[], deviceFrame{}, textInImages[], summary`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this screenshot. Context: ${context?.url || 'unknown'} | Goal: ${context?.goal || 'General QA'}`
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${screenshotBase64}`
              }
            }
          ]
        }
      ]

      const visionApiKey = process.env.OPENAI_API_KEY || process.env.GPT4V_API_KEY || ''
      const visionEndpoint = process.env.VISION_MODEL_ENDPOINT || 'https://api.openai.com/v1/chat/completions'
      const visionModel = process.env.VISION_MODEL || 'gpt-4-vision-preview'

      const response = await axios.post<ModelResponse>(
        visionEndpoint,
        {
          model: visionModel,
          messages,
          response_format: { type: 'json_object' },
          max_tokens: 2000
        },
        {
          headers: {
            'Authorization': `Bearer ${visionApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      )

      const content = response.data.choices[0]?.message?.content
      if (!content) {
        throw new Error('No response from GPT-4V')
      }

      const parsed = JSON.parse(content)
      return {
        semanticInterpretation: parsed.semanticInterpretation || '',
        uiIssues: parsed.uiIssues || visionIssues.map(i => ({ type: 'layout', description: i.description, severity: i.severity })),
        inconsistencies: parsed.inconsistencies || [],
        deviceFrame: parsed.deviceFrame,
        textInImages: parsed.textInImages || [],
        summary: parsed.summary || ''
      }
    } catch (error: any) {
      console.error('Vision analysis error:', error.message)
      throw error
    }
  }

  /**
   * Layer 2: Mid-Reasoning - Qwen-2.5-Coder-7B-Instruct
   * Handles: merge GPT-4V output + console logs, interpret backend responses, classify failures,
   * determine cause vs symptom, generate user-friendly explanations, parse test instructions
   */
  async midReasoning(params: {
    visionOutput: VisionAnalysis
    consoleLogs?: string[]
    backendResponses?: any[]
    testInstructions?: string
    failureContext?: string
  }): Promise<MergedAnalysis> {
    try {
      const prompt = `You are a mid-level reasoning AI. Merge and analyze:

Vision Output:
${JSON.stringify(params.visionOutput, null, 2)}

Console Logs:
${params.consoleLogs?.join('\n') || 'None'}

Backend Responses:
${JSON.stringify(params.backendResponses || [], null, 2)}

Failure Context:
${params.failureContext || 'None'}

Tasks:
1. Classify the failure type (ui, backend, network, logic, none)
2. Determine root cause vs symptoms
3. Generate user-friendly explanation
4. Assess severity and confidence

Return JSON with: classification{}, causeVsSymptom{}, userFriendlyExplanation`

      const response = await this.callModel(this.qwenCoder7bApiUrl, this.qwenCoder7bApiKey, this.qwenCoder7bModel, prompt)
      const parsed = JSON.parse(response)

      return {
        visionOutput: params.visionOutput,
        consoleLogs: params.consoleLogs || [],
        backendResponses: params.backendResponses || [],
        classification: parsed.classification || { failureType: 'none', severity: 'low', confidence: 0 },
        causeVsSymptom: parsed.causeVsSymptom || { rootCause: '', symptoms: [], explanation: '' },
        userFriendlyExplanation: parsed.userFriendlyExplanation || ''
      }
    } catch (error: any) {
      console.error('Mid-reasoning error:', error.message)
      // Fallback to simple analysis
      return {
        visionOutput: params.visionOutput,
        consoleLogs: params.consoleLogs || [],
        backendResponses: params.backendResponses || [],
        classification: { failureType: 'none', severity: 'low', confidence: 0.5 },
        causeVsSymptom: { rootCause: 'Unknown', symptoms: [], explanation: 'Analysis failed' },
        userFriendlyExplanation: 'Unable to analyze failure'
      }
    }
  }

  /**
   * Layer 3: Heavy Reasoning - Qwen-2.5-Coder-14B-Instruct
   * Handles: deep chain-of-thought, conflicting signals, multi-step logic,
   * root-cause analysis, generating recommended fixes, full-stack view
   * 
   * Uses adaptive loading: Qwen-Coder-14B is loaded on-demand when needed
   */
  async heavyReasoning(params: {
    mergedAnalysis: MergedAnalysis
    conflictingSignals?: { ui: string; backend: string }
    multiStepContext?: string[]
    requiresDeepAnalysis: boolean
  }): Promise<DeepReasoningResult> {
    if (!params.requiresDeepAnalysis) {
      // Skip heavy reasoning if not needed
      return {
        chainOfThought: [],
        rootCauseAnalysis: {
          primaryCause: params.mergedAnalysis.causeVsSymptom.rootCause,
          contributingFactors: params.mergedAnalysis.causeVsSymptom.symptoms,
          evidence: []
        },
        recommendedFixes: [],
        fullStackView: {
          frontend: params.mergedAnalysis.visionOutput,
          backend: params.mergedAnalysis.backendResponses,
          integration: 'Basic integration view'
        }
      }
    }

    try {
      // Trigger adaptive loading: Request 14B model (will load on-demand)
      const prompt = `You are a deep reasoning AI specialized in code and test automation. Perform deep analysis:

Merged Analysis:
${JSON.stringify(params.mergedAnalysis, null, 2)}

Conflicting Signals:
${params.conflictingSignals ? `UI says: ${params.conflictingSignals.ui}\nBackend says: ${params.conflictingSignals.backend}` : 'None'}

Multi-step Context:
${params.multiStepContext?.join('\n') || 'None'}

Tasks:
1. Deep chain-of-thought reasoning
2. Resolve conflicts between UI and backend
3. Root-cause analysis with evidence
4. Generate prioritized recommended fixes
5. Create full-stack integration view

Return JSON with: chainOfThought[], conflictResolution{}, rootCauseAnalysis{}, recommendedFixes[], fullStackView{}`

      // Use Qwen-Coder-14B for heavy reasoning (via Ollama)
      const response = await this.callModel(this.qwenCoder14bApiUrl, this.qwenCoder14bApiKey, this.qwenCoder14bModel, prompt)
      const parsed = JSON.parse(response)

      return {
        chainOfThought: parsed.chainOfThought || [],
        conflictResolution: parsed.conflictResolution,
        rootCauseAnalysis: parsed.rootCauseAnalysis || {
          primaryCause: params.mergedAnalysis.causeVsSymptom.rootCause,
          contributingFactors: params.mergedAnalysis.causeVsSymptom.symptoms,
          evidence: []
        },
        recommendedFixes: parsed.recommendedFixes || [],
        fullStackView: parsed.fullStackView || {
          frontend: params.mergedAnalysis.visionOutput,
          backend: params.mergedAnalysis.backendResponses,
          integration: 'Full-stack view'
        }
      }
    } catch (error: any) {
      console.error('Heavy reasoning error:', error.message)
      // Fallback
      return {
        chainOfThought: ['Heavy reasoning failed, using mid-reasoning results'],
        rootCauseAnalysis: {
          primaryCause: params.mergedAnalysis.causeVsSymptom.rootCause,
          contributingFactors: params.mergedAnalysis.causeVsSymptom.symptoms,
          evidence: []
        },
        recommendedFixes: [],
        fullStackView: {
          frontend: params.mergedAnalysis.visionOutput,
          backend: params.mergedAnalysis.backendResponses,
          integration: 'Fallback integration view'
        }
      }
    }
  }

  /**
   * Layer 4: Utility - Llama 8B
   * Handles: trivial parsing, routing, extracting test metadata, low-value classification
   */
  async utilityTask(task: 'parse' | 'route' | 'extract' | 'classify', input: any): Promise<any> {
    try {
      const prompts = {
        parse: `Parse this input and extract structured data: ${JSON.stringify(input)}`,
        route: `Route this request to appropriate handler: ${JSON.stringify(input)}`,
        extract: `Extract metadata from: ${JSON.stringify(input)}`,
        classify: `Classify this into categories: ${JSON.stringify(input)}`
      }

      const prompt = prompts[task]
      const response = await this.callModel(this.llama8bApiUrl, this.llama8bApiKey, this.llama8bModel, prompt)
      return JSON.parse(response)
    } catch (error: any) {
      console.error(`Utility task (${task}) error:`, error.message)
      return { error: error.message }
    }
  }

  /**
   * Parse test instructions using Qwen-Coder-7B (mid-reasoning layer)
   */
  async parseTestInstructions(instructions: string, currentUrl?: string): Promise<{
    primaryGoal: string
    specificActions: string[]
    elementsToCheck: string[]
    expectedOutcomes: string[]
    priority: 'high' | 'medium' | 'low'
    structuredPlan: string
  }> {
    try {
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

      const response = await this.callModel(this.qwenCoder7bApiUrl, this.qwenCoder7bApiKey, this.qwenCoder7bModel, prompt)
      return JSON.parse(response)
    } catch (error: any) {
      console.error('Instruction parsing error:', error.message)
      return {
        primaryGoal: instructions,
        specificActions: [],
        elementsToCheck: [],
        expectedOutcomes: [],
        priority: 'medium',
        structuredPlan: instructions
      }
    }
  }

  /**
   * Generate action for test automation (uses Qwen-Coder-7B by default)
   * Compatible with LlamaService interface for IRL
   */
  async generateAction(
    context: any, // VisionContext
    history: Array<{ action: any; timestamp: string }>,
    goal: string
  ): Promise<any> { // LLMAction
    try {
      // Use Qwen-Coder-7B for action generation (default, fast, via Ollama)
      const prompt = this.buildActionGenerationPrompt(context, history, goal)
      const response = await this.callModel(this.qwenCoder7bApiUrl, this.qwenCoder7bApiKey, this.qwenCoder7bModel, prompt)
      return JSON.parse(response)
    } catch (error: any) {
      console.error('Action generation error:', error.message)
      throw error
    }
  }

  /**
   * Analyze screenshot for IRL self-healing (uses Qwen-Coder-14B for heavy reasoning)
   * Compatible with LlamaService interface for IRL
   */
  async analyzeScreenshot(
    screenshotBase64: string,
    domSnapshot: string,
    goal: string
  ): Promise<any> { // VisionContext
    try {
      // Use Qwen-Coder-14B for vision analysis (heavy reasoning, via Ollama)
      const prompt = `Analyze this screenshot and DOM to help with test automation self-healing.

Goal: ${goal}

DOM Snapshot (partial):
${domSnapshot.substring(0, 2000)}

Screenshot: [Base64 image provided]

Tasks:
1. Identify interactive elements
2. Suggest alternative selectors
3. Find elements matching the goal
4. Provide actionable recommendations

Return JSON with: elements[], alternativeSelectors[], recommendations[]`
      
      const response = await this.callModel(this.qwenCoder14bApiUrl, this.qwenCoder14bApiKey, this.qwenCoder14bModel, prompt)
      return JSON.parse(response)
    } catch (error: any) {
      console.error('Screenshot analysis error:', error.message)
      throw error
    }
  }

  /**
   * Build prompt for action generation
   */
  private buildActionGenerationPrompt(context: any, history: any[], goal: string): string {
    const elements = context.elements?.slice(0, 50) || []
    const historyText = history.slice(-5).map(h => 
      `${h.action.action} ${h.action.selector || h.action.target || ''}`
    ).join('\n')

    return `You are a test automation AI. Generate the next action.

Goal: ${goal}

Current URL: ${context.metadata?.currentUrl || 'unknown'}

Available Elements (first 50):
${elements.map((e: any, i: number) => 
  `${i + 1}. ${e.type}: "${e.text || e.ariaLabel || e.name || 'unnamed'}" - selector: "${e.selector || 'N/A'}"`
).join('\n')}

Recent Actions:
${historyText || 'None'}

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
   * Helper: Call any model via OpenAI-compatible API
   */
  private async callModel(apiUrl: string, apiKey: string, model: string, prompt: string): Promise<string> {
    const messages: ModelMessage[] = [
      { role: 'system', content: 'You are a helpful AI assistant. Return valid JSON responses.' },
      { role: 'user', content: prompt }
    ]

    // Build headers (API key optional for local services)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    const response = await axios.post<ModelResponse>(
      `${apiUrl}/chat/completions`,
      {
        model,
        messages,
        response_format: { type: 'json_object' },
        temperature: 0.3
      },
      {
        headers,
        timeout: 60000
      }
    )

    const content = response.data.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from model')
    }

    return content
  }
}

