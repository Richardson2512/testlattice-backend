// Qwen Instruct API service for understanding and parsing user instructions
import axios from 'axios'

const LOG_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase()
const DEBUG_QWEN = LOG_LEVEL === 'debug' || process.env.DEBUG_LLM === 'true'

interface QwenMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface QwenResponse {
  choices: Array<{
    message: {
      role: string
      content: string
    }
  }>
}

export interface ParsedInstructions {
  primaryGoal: string
  specificActions: string[]
  elementsToCheck: string[]
  expectedOutcomes: string[]
  priority: 'high' | 'medium' | 'low'
  structuredPlan: string
}

export class QwenService {
  private apiKey: string
  private apiUrl: string
  private model: string
  private isLocalOllama: boolean = false

  constructor(apiKey: string, apiUrl?: string, model?: string) {
    this.apiKey = apiKey || ''
    // Default to local Ollama (localhost:11434) for local installation
    const defaultUrl = process.env.QWEN_API_URL || 'http://localhost:11434/v1'
    this.apiUrl = apiUrl || defaultUrl
    
    // Detect if this is a local Ollama instance
    this.isLocalOllama = this.apiUrl.includes('localhost') || 
                         this.apiUrl.includes('127.0.0.1') || 
                         this.apiUrl.includes(':11434')
    
    this.model = model || process.env.QWEN_MODEL || 'qwen2.5:latest'
    
    if (this.isLocalOllama) {
      console.log(`QwenService: Using local Ollama at ${this.apiUrl} (no API key required)`)
    } else {
      console.log(`QwenService: Using remote API at ${this.apiUrl} (API key required)`)
    }
  }

  /**
   * Parse and understand user instructions using Qwen
   * Returns structured understanding of what the user wants to test
   */
  async parseInstructions(userInstructions: string, currentUrl?: string): Promise<ParsedInstructions> {
    try {
      if (!userInstructions || userInstructions.trim().length === 0) {
        // Return default if no instructions
        return {
          primaryGoal: 'Perform basic user flow test',
          specificActions: [],
          elementsToCheck: [],
          expectedOutcomes: [],
          priority: 'medium',
          structuredPlan: 'Explore the website and test basic functionality',
        }
      }

      if (DEBUG_QWEN) {
        console.log('Qwen: Parsing user instructions:', userInstructions.substring(0, 100))
      }

      const systemPrompt = `You are an expert test instruction analyzer. Your job is to understand user-provided testing instructions and break them down into a structured, actionable plan.

Analyze the user's instructions and extract:
1. Primary Goal: What is the main objective?
2. Specific Actions: What specific actions need to be performed? (e.g., "click login button", "check navbar", "verify footer")
3. Elements to Check: What specific UI elements should be tested? (e.g., "navbar", "login button", "search bar")
4. Expected Outcomes: What should happen? (e.g., "should redirect to dashboard", "should show error message")
5. Priority: How important is this test? (high/medium/low)
6. Structured Plan: A step-by-step plan to execute these instructions

Return your response as a JSON object with this exact structure:
{
  "primaryGoal": "string - main objective",
  "specificActions": ["array of specific actions"],
  "elementsToCheck": ["array of elements to check"],
  "expectedOutcomes": ["array of expected outcomes"],
  "priority": "high|medium|low",
  "structuredPlan": "string - detailed step-by-step plan"
}

Be specific and actionable. If the user mentions "check navbar", break it down into specific actions like "click navbar links", "verify navbar is visible", etc.`

      const userPrompt = `User Instructions: "${userInstructions}"
${currentUrl ? `Current Website: ${currentUrl}` : ''}

Analyze these instructions and provide a structured test plan.`

      const messages: QwenMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]

      // Build headers - only use Bearer auth for remote APIs, not local Ollama
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }
      
      // Only add Authorization header for remote APIs (OpenAI, etc.)
      if (!this.isLocalOllama && this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`
      } else if (this.isLocalOllama && this.apiKey && this.apiKey !== 'ollama' && this.apiKey.trim() !== '') {
        // Some Ollama setups might use custom auth, but typically not needed
        headers['Authorization'] = `Bearer ${this.apiKey}`
      }
      
      const response = await axios.post<QwenResponse>(
        `${this.apiUrl}/chat/completions`,
        {
          model: this.model,
          messages,
          temperature: 0.3, // Lower temperature for more consistent parsing
          response_format: { type: 'json_object' }
        },
        {
          headers,
          timeout: 30000
        }
      )

      const content = response.data.choices[0]?.message?.content
      if (!content) {
        throw new Error('No response from Qwen API')
      }

      if (DEBUG_QWEN) {
        console.log('Qwen: Raw response:', content.substring(0, 300))
      }

      // Parse JSON response
      let parsedData: any
      try {
        parsedData = JSON.parse(content)
      } catch (parseError: any) {
        console.error('Qwen: Failed to parse JSON response:', parseError.message)
        console.error('Qwen: Raw response:', content)
        // Fallback to simple parsing
        return this.fallbackParse(userInstructions)
      }

      // Validate and structure the response
      const parsed: ParsedInstructions = {
        primaryGoal: parsedData.primaryGoal || userInstructions,
        specificActions: Array.isArray(parsedData.specificActions) ? parsedData.specificActions : [],
        elementsToCheck: Array.isArray(parsedData.elementsToCheck) ? parsedData.elementsToCheck : [],
        expectedOutcomes: Array.isArray(parsedData.expectedOutcomes) ? parsedData.expectedOutcomes : [],
        priority: ['high', 'medium', 'low'].includes(parsedData.priority) ? parsedData.priority : 'medium',
        structuredPlan: parsedData.structuredPlan || userInstructions,
      }

      if (DEBUG_QWEN) {
        console.log('Qwen: Parsed instructions:', JSON.stringify(parsed, null, 2))
      }

      return parsed
    } catch (error: any) {
      console.error('Qwen API error:', error.message)
      // Fallback to simple parsing if API fails
      return this.fallbackParse(userInstructions)
    }
  }

  /**
   * Fallback parser if Qwen API fails
   */
  private fallbackParse(userInstructions: string): ParsedInstructions {
    console.warn('Qwen: Using fallback parser')
    
    // Simple keyword-based parsing
    const lowerInstructions = userInstructions.toLowerCase()
    const actions: string[] = []
    const elements: string[] = []
    
    // Extract actions
    if (lowerInstructions.includes('click')) {
      const clickMatch = userInstructions.match(/click\s+([^\s,]+)/i)
      if (clickMatch) actions.push(`Click ${clickMatch[1]}`)
    }
    if (lowerInstructions.includes('check')) {
      const checkMatch = userInstructions.match(/check\s+([^\s,]+)/i)
      if (checkMatch) {
        elements.push(checkMatch[1])
        actions.push(`Check ${checkMatch[1]}`)
      }
    }
    if (lowerInstructions.includes('verify')) {
      const verifyMatch = userInstructions.match(/verify\s+([^\s,]+)/i)
      if (verifyMatch) {
        elements.push(verifyMatch[1])
        actions.push(`Verify ${verifyMatch[1]}`)
      }
    }
    if (lowerInstructions.includes('test')) {
      const testMatch = userInstructions.match(/test\s+([^\s,]+)/i)
      if (testMatch) {
        elements.push(testMatch[1])
        actions.push(`Test ${testMatch[1]}`)
      }
    }
    
    return {
      primaryGoal: userInstructions,
      specificActions: actions.length > 0 ? actions : [userInstructions],
      elementsToCheck: elements,
      expectedOutcomes: [],
      priority: 'medium',
      structuredPlan: userInstructions,
    }
  }
}

