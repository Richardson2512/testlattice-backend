// Llama 4 service for LLM interactions
import { LLMAction, VisionContext, VisionElement, AccessibilityNode, HighRiskArea } from '../types'
import axios from 'axios'
import * as cheerio from 'cheerio'
import type { Element } from 'domhandler'

const LOG_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase()
const DEBUG_LLM = LOG_LEVEL === 'debug' || process.env.DEBUG_LLM === 'true'
const MAX_INTERACTIVE_ELEMENTS = Math.max(parseInt(process.env.DOM_SUMMARY_LIMIT || '200', 10), 20)
const ACCESSIBILITY_SUMMARY_LIMIT = Math.max(parseInt(process.env.ACCESSIBILITY_SUMMARY_LIMIT || '40', 10), 5)

// Instruction parsing markers - centralized for maintainability
const INSTRUCTION_MARKERS = {
  QWEN_DETECTION: 'PARSED BY QWEN',
  QWEN_START: 'PARSED BY QWEN - HIGHEST PRIORITY):',
  QWEN_END: '\n\nAdditionally',
  USER_DETECTION: 'USER INSTRUCTIONS',
  USER_START: 'USER INSTRUCTIONS (PRIORITY):',
  USER_END: '\n\n'
} as const

interface LlamaMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface LlamaResponse {
  choices: Array<{
    message: {
      role: string
      content: string
    }
  }>
}

export class LlamaService {
  private apiKey: string
  private apiUrl: string
  private model: string
  private missingKeyWarned = false
  private isLocalOllama: boolean = false

  constructor(apiKey: string, apiUrl?: string, model?: string) {
    this.apiKey = apiKey || ''
    // Default to local Ollama (localhost:11434) for local installation
    const defaultUrl = process.env.LLAMA_API_URL || 'http://localhost:11434/v1'
    this.apiUrl = apiUrl || defaultUrl
    
    // Detect if this is a local Ollama instance
    this.isLocalOllama = this.apiUrl.includes('localhost') || 
                         this.apiUrl.includes('127.0.0.1') || 
                         this.apiUrl.includes(':11434')
    
    this.model = model || process.env.LLAMA_MODEL || 'llama3.2:latest'
    
    if (this.isLocalOllama) {
      console.log(`LlamaService: Using local Ollama at ${this.apiUrl} (no API key required)`)
    } else {
      console.log(`LlamaService: Using remote API at ${this.apiUrl} (API key required)`)
    }
  }

  /**
   * Parse user instructions from goal string
   * Returns structured data about instruction type and content
   */
  private _parseUserInstructions(goal: string): {
    hasQwenInstructions: boolean
    hasUserInstructions: boolean
    userInstructionsText: string
  } {
    const hasQwenInstructions = goal.includes(INSTRUCTION_MARKERS.QWEN_DETECTION)
    const hasUserInstructions = goal.includes(INSTRUCTION_MARKERS.USER_DETECTION) || goal.includes(INSTRUCTION_MARKERS.QWEN_DETECTION)
    
    let userInstructionsText = ''
    if (hasUserInstructions) {
      if (goal.includes(INSTRUCTION_MARKERS.QWEN_DETECTION)) {
        // Extract Qwen-parsed instructions
        const qwenMatch = goal.split(INSTRUCTION_MARKERS.QWEN_START)
        if (qwenMatch.length > 1) {
          const afterQwen = qwenMatch[1]
          const additionalMatch = afterQwen.split(INSTRUCTION_MARKERS.QWEN_END)
          userInstructionsText = additionalMatch[0]?.trim() || goal
        } else {
          userInstructionsText = goal
        }
      } else {
        // Extract regular user instructions
        const userMatch = goal.split(INSTRUCTION_MARKERS.USER_START)
        if (userMatch.length > 1) {
          const afterUser = userMatch[1]
          const nextSection = afterUser.split(INSTRUCTION_MARKERS.USER_END)
          userInstructionsText = nextSection[0]?.trim() || goal
        } else {
          userInstructionsText = goal
        }
      }
    }
    
    return {
      hasQwenInstructions,
      hasUserInstructions,
      userInstructionsText
    }
  }

  /**
   * Generate next action based on context and history
   * Goal may contain Qwen-parsed instructions
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
      browser?: 'chromium' | 'firefox' | 'webkit'  // Browser context for browser-aware testing
      viewport?: string  // Viewport context for responsive testing
    }
  ): Promise<LLMAction> {
    // For local Ollama, API key is optional (can be empty or "ollama")
    // For remote APIs (OpenAI, etc.), API key is required
    const requiresApiKey = !this.isLocalOllama
    
    if (requiresApiKey && !this.apiKey) {
      if (!this.missingKeyWarned) {
        console.warn('Llama: API key missing for remote API. Falling back to heuristic actions.')
        this.missingKeyWarned = true
      }
      return this.fallbackAction(context, history, goal)
    }

    try {
      // Parse user instructions using helper method
      const instructionData = this._parseUserInstructions(goal)
      const { hasQwenInstructions, hasUserInstructions, userInstructionsText } = instructionData
      
      // Build prompt using array-based approach for clarity
      const promptParts: string[] = []
      
      // Base introduction
      promptParts.push('You are an AI test automation agent working with Qwen-parsed instructions.')
      
      // Add browser context if provided
      if (trackingInfo?.browser) {
        const browserName = trackingInfo.browser.charAt(0).toUpperCase() + trackingInfo.browser.slice(1)
        promptParts.push(`\n\n🌐 BROWSER CONTEXT: You are testing on ${browserName}.`)
        if (trackingInfo.browser === 'firefox') {
          promptParts.push('Note: Firefox may have different CSS selector behavior. Prefer data-testid or ID selectors when available. Some CSS pseudo-selectors may behave differently.')
        } else if (trackingInfo.browser === 'webkit') {
          promptParts.push('Note: WebKit (Safari) may have different rendering and JavaScript behavior. Verify element visibility carefully. Some modern CSS features may not be fully supported.')
        } else if (trackingInfo.browser === 'chromium') {
          promptParts.push('Note: Chromium (Chrome/Edge) has broad CSS and JavaScript support. Standard selectors should work reliably.')
        }
        if (trackingInfo.viewport) {
          promptParts.push(`Current viewport: ${trackingInfo.viewport}.`)
        }
        promptParts.push('')
      }
      
      // Add instruction section based on type
      if (hasQwenInstructions) {
        promptParts.push(`\n\n🎯 QWEN-PARSED USER INSTRUCTIONS (HIGHEST PRIORITY - FOLLOW EXACTLY):\n${userInstructionsText}`)
        promptParts.push('These instructions have been analyzed and structured by Qwen AI. Follow them precisely.')
      } else if (hasUserInstructions) {
        promptParts.push(`\n\n🎯 USER INSTRUCTIONS (HIGHEST PRIORITY - FOLLOW THESE FIRST):\n${userInstructionsText}\n\n`)
      } else {
        promptParts.push(`Your goal is to help complete the test: "${goal}".\n\n`)
      }
      
      // Add critical completion requirement
      promptParts.push('CRITICAL: ')
      if (hasUserInstructions) {
        promptParts.push('The user has provided specific instructions (parsed by Qwen for clarity). You MUST follow those instructions as your primary objective. ')
      }
      promptParts.push(`Only mark the test as complete when you have fully satisfied ${hasUserInstructions ? 'all the parsed user instructions' : 'the test goal'}.\n\n`)
      
      // Add IMPORTANT RULES section to promptParts
      promptParts.push(`IMPORTANT RULES:
1. ${hasUserInstructions ? 'FOLLOW THE USER INSTRUCTIONS ABOVE - they are your highest priority. ' : ''}DO NOT return "wait" unless absolutely necessary (page is still loading)
2. DO NOT return "complete" unless ${hasUserInstructions ? 'the user instructions have been fully completed' : 'the test goal has been fully achieved'}
3. Always prefer interactive actions (click, type, scroll) over passive actions (wait)
4. For LINKS: Click them to test redirects. The system will verify the URL changes correctly.
5. For HIDDEN ELEMENTS (marked [HIDDEN]): Use "assert" action to verify they exist and have correct values. DO NOT try to click hidden inputs - they cannot be clicked.
6. Hidden elements are CRITICAL for finding breakdowns - always verify they exist and have correct values.
7. SELECTOR PRIORITY (use in this order):
   - First: Use element.selector if provided (it's the most reliable)
   - Second: Use ID selector (#id) if element has an id attribute
   - Third: Use data-testid if available ([data-testid="value"])
   - Fourth: Use CSS class selector (.class-name) if unique
   - Fifth: Use Playwright text selector: button:has-text("Text") or text="Text"
   - Last resort: Use tag + attribute combinations (button[name="value"])
8. NEVER use querySelector() syntax in selectors - use Playwright locator syntax
9. For text-based selection, use: button:has-text("Exact Text") or text="Exact Text"
10. If you see clickable elements (buttons, links), click them to explore the page and test functionality
11. If you see input fields, type into them if relevant to ${hasUserInstructions ? 'the user instructions' : 'the goal'}
12. Use "scroll" to see more content if needed
13. Only use "complete" when you have thoroughly tested the page and ${hasUserInstructions ? 'completed the user instructions' : 'achieved the goal'}

TESTING STRATEGY - Follow these systematic testing patterns:

FORMS & INPUT FIELDS:
1. Happy Path First: Fill all fields with valid data and submit successfully
2. Required Fields: Try submitting with required fields blank - use "assert" to verify error messages appear
3. Validation Testing: Test invalid formats based on input type:
   - Email fields: Test "invalid-email" (should show error)
   - Number fields: Test "abc" or "12.34.56" (should show error)
   - Tel fields: Test invalid phone formats
   - Date fields: Test invalid date formats
4. Character Limits: Test min/max length by typing beyond limits, verify truncation or error
5. Error Messages: After invalid input, use "assert:error" to verify error messages are displayed
6. Form Submission: After clicking submit, verify success (URL change, success message, or form reset)

INTERACTIVE ELEMENTS:
1. State Changes: After clicking checkboxes/radio buttons, use "assert:state:checked" to verify state changed
2. Dropdowns: Select different options and use "assert:selected" to verify correct option is selected
3. Button Actions: After clicking, verify the expected result:
   - Navigation buttons: Verify URL changes (use "assert:text" to check page content)
   - Toggle buttons: Verify UI state changes
   - Submit buttons: Verify form submission result
4. Links: Click and verify URL changes or content loads

CORE USER FLOWS (E2E):
1. Login Flow: 
   - Enter credentials → click login → assert logout button or user menu appears
   - Test invalid credentials → assert error message appears
2. Search Flow: 
   - Enter query → submit → assert results appear OR "no results" message
   - Test empty search → assert appropriate message
3. Multi-Step Forms: 
   - Complete each step → assert progress indicators update
   - Test navigation between steps
4. Data Persistence: 
   - Fill form → refresh page → assert data persists (if expected by design)
   - Test browser back/forward navigation

ASSERT ACTION TYPES (use in value field):
- "assert:exists" - Verify element exists in DOM
- "assert:visible" - Verify element is visible
- "assert:value:expected" - Verify input/select has specific value
- "assert:error" - Verify error message is displayed (look for error text/class)
- "assert:state:checked" - Verify checkbox/radio is checked
- "assert:state:unchecked" - Verify checkbox/radio is unchecked
- "assert:selected:option" - Verify dropdown has specific option selected
- "assert:text:expected" - Verify element contains specific text

COMPATIBILITY & RESPONSIVENESS STRATEGY:
1. START: Always begin testing core user flows (Login, Forms) at the default Desktop viewport (1920x1080 or use setDevice: "desktop").
2. TRANSITION: After successfully completing a core flow, transition to smaller viewports using the 'setDevice' action:
   - Test Tablet (setDevice: "tablet"), then Mobile (setDevice: "mobile")
   - Use device aliases for convenience: "mobile", "tablet", "desktop", "tablet-landscape", etc.
3. RE-VERIFY: At each new viewport, perform these checks:
   - Use "assert:visible" on main content area and critical elements
   - Re-run critical functional checks (e.g., can the user still submit the form? Is the main CTA visible?)
   - Verify no elements are hidden, overlapping, or displaying incorrectly
4. LAYOUT CHECKS: After resizing, focus on:
   - Using "assert:visible" to verify critical elements are still accessible
   - Using "assert:error" to verify error messages still display correctly
   - Checking that forms and interactive elements remain functional
5. ORIENTATION: After setting device to mobile, test orientation changes:
   - Use setOrientation: "landscape" to test landscape mode
   - Re-verify critical elements and functionality in landscape orientation
6. VIEWPORT SPECIFIC: For custom viewport sizes, use setViewport with format "widthxheight" (e.g., setViewport with value "390x844")
7. SKIP IF: If desktop flow fails, skip responsive testing (log as blocker) - don't waste time testing broken flows on smaller screens

Available actions:
- click: Click on an element (REQUIRES selector from the elements list below)
- type: Type text into an input field (REQUIRES selector and value)
- scroll: Scroll down the page to see more content
- setViewport: Resize browser viewport to specific dimensions (value format: "widthxheight", e.g., "390x844")
- setDevice: Set viewport using device alias (value: "mobile", "tablet", "desktop", "mobile-small", "tablet-landscape", etc.)
- setOrientation: Change device orientation (value: "portrait" or "landscape") - swaps width and height
- navigate: Navigate to a URL (only if needed to go to a different page)
- wait: ONLY if page is still loading (avoid this - prefer other actions)
- assert: Assert a condition
- complete: ONLY when test goal is fully achieved (avoid early completion)

Return your response as a JSON object with: action, target (optional), selector (REQUIRED for click/type), value (optional), description, confidence (0-1).`)
      
      const systemPrompt = promptParts.join('')

      const elementPreview = context.elements.slice(0, 40)
      const totalElements = context.metadata?.totalElements ?? context.elements.length
      const truncatedNote = context.metadata?.truncated ? ` (showing ${elementPreview.length} of ${totalElements})` : ''

      const contextDescription = elementPreview.length > 0
        ? `Current page summary: ${totalElements} interactive elements${truncatedNote}.
${elementPreview.map((e: VisionElement, idx: number) => {
  const hidden = e.isHidden ? ' [HIDDEN]' : ''
  const label = e.text || e.ariaLabel || e.name || 'unnamed'
  const href = e.href ? ` -> ${e.href}` : ''
  return `${idx + 1}. ${e.type}${hidden}: "${label}"${href} - selector: "${e.selector}"`
}).join('\n')}

ACCESSIBILITY FINDINGS (${context.accessibility.length || 0}):
${context.accessibility.slice(0, ACCESSIBILITY_SUMMARY_LIMIT).map((node, idx) => {
  return `${idx + 1}. ${node.role}${node.name ? ` "${node.name}"` : ''}${node.selector ? ` (${node.selector})` : ''}${node.issues?.length ? ` => ${node.issues.join(', ')}` : ''}`
}).join('\n') || 'None detected in the sampled elements.'}

IMPORTANT RULES FOR SELECTING ELEMENTS:
- ONLY use selectors from the list above. Do NOT create new selectors.
- DO NOT click skip links or screen-reader-only elements (e.g., "skip to content", elements with "skip-link" or "screen-reader-text" classes, anchor links with href="#")
- DO NOT click elements that are accessibility-only (aria-hidden, visually-hidden, sr-only classes)
- For LINKS: Click them to test redirects. Verify the URL changes correctly after clicking. BUT skip anchor links (href starting with "#")
- For HIDDEN ELEMENTS (marked [HIDDEN]): Use "assert" action to verify they exist and have correct values. DO NOT try to click hidden inputs.
- For VISIBLE ELEMENTS: Use "click" for buttons/links, "type" for input fields.
- PREFER elements with IDs or data-testid for more reliable selectors.
- If an element is not in the list, scroll to see more content first.`
        : `WARNING: No interactive elements found on the page. Try scrolling to see more content.`

      const historyDescription = history.length > 0
        ? `Previous actions (last 5):\n${history.slice(-5).map((h, i) => 
            `${i + 1}. ${h.action.action}: ${h.action.description || h.action.target || 'no description'}`
          ).join('\n')}`
        : 'No previous actions - this is the first step after navigation.'

      // Build tracking info string
      let trackingInfoStr = ''
      if (trackingInfo && trackingInfo.visitedUrls && trackingInfo.visitedUrls.length > 0) {
        trackingInfoStr = `\n\n📍 NAVIGATION TRACKING:
- Current URL: ${trackingInfo.currentUrl || 'unknown'}
- Visited URLs (${trackingInfo.visitedUrls.length}): ${trackingInfo.visitedUrls.slice(0, 5).join(', ')}${trackingInfo.visitedUrls.length > 5 ? '...' : ''}
- Visited elements: ${trackingInfo.visitedSelectors?.length || 0} elements already tested
${trackingInfo.isAllPagesMode && trackingInfo.discoveredPages && trackingInfo.discoveredPages.length > 0
  ? `- Discovered pages to test (${trackingInfo.discoveredPages.length}): ${trackingInfo.discoveredPages.slice(0, 5).map(p => p.title).join(', ')}${trackingInfo.discoveredPages.length > 5 ? '...' : ''}\n\nIMPORTANT: Navigate to UNVISITED pages. Do NOT click the same elements (email, phone, support) repeatedly.`
  : ''}`
      }
      
      // Build user prompt with conditional instruction reminder
      const userPromptParts: string[] = [
        contextDescription,
        '',
        historyDescription,
        trackingInfoStr
      ]
      
      if (hasUserInstructions) {
        userPromptParts.push(`\n🎯 REMEMBER: Your PRIMARY objective is to follow the user instructions: "${userInstructionsText}"\n\n`)
      }
      
      userPromptParts.push(`Based on ${hasUserInstructions ? 'the user instructions above' : `the goal "${goal}"`}, what is the next action?`)
      
      userPromptParts.push(`\n\nCRITICAL RULES:
- DO NOT click elements you've already visited (check visited elements list above)
- DO NOT repeatedly click email addresses, phone numbers, or support links
- For search inputs: Use relevant search terms based on the website type (e.g., for e-commerce: "product", "shoes", "laptop" - NOT "test")
- For "all pages" mode: Navigate to discovered pages that haven't been visited yet
- Prefer clicking navigation links, buttons, and menu items over contact information
- Remember: prefer click/type/scroll over wait. Only complete if ${hasUserInstructions ? 'user instructions are fully completed' : 'goal is fully achieved'}.`)
      
      const userPrompt = userPromptParts.join('\n')

      const messages: LlamaMessage[] = [
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
      
      const response = await axios.post<LlamaResponse>(
        `${this.apiUrl}/chat/completions`,
        {
          model: this.model,
          messages,
          temperature: 0.7,
          response_format: { type: 'json_object' },
          max_tokens: 500 // Limit response for faster generation
        },
        {
          headers,
          timeout: 20000 // 20 second timeout
        }
      )

      const content = response.data.choices[0]?.message?.content
      if (!content) {
        throw new Error('No response from Llama API')
      }

      if (DEBUG_LLM) {
        console.log('Llama API response:', content.substring(0, 200))
      }

      // Parse JSON response
      let actionData: any
      try {
        actionData = JSON.parse(content)
      } catch (parseError: any) {
        console.error('Llama: Failed to parse JSON response:', parseError.message)
        if (DEBUG_LLM) {
          console.error('Llama: Raw response:', content)
        }
        throw new Error(`Invalid JSON response from Llama: ${parseError.message}`)
      }
      
      // Validate action type
      const validActions = ['click', 'type', 'scroll', 'navigate', 'wait', 'assert', 'complete', 'setViewport', 'setDevice', 'setOrientation']
      if (!validActions.includes(actionData.action)) {
        console.warn(`Llama: Invalid action "${actionData.action}", defaulting to scroll`)
        actionData.action = 'scroll'
      }
      
      // Validate and clean selector/target
      let selector = actionData.selector
      let target = actionData.target
      
      // Check for malformed selectors (incomplete attribute selectors, missing quotes, etc.)
      if (selector) {
        // Check for incomplete attribute selectors like "button[aria-label=" or "button:has-text("
        if (selector.includes('[') && !selector.includes(']')) {
          console.warn(`Llama: Malformed selector detected (missing closing bracket): "${selector}"`)
          selector = undefined
        }
        if (selector.includes(':has-text(') && !selector.includes(')')) {
          console.warn(`Llama: Malformed selector detected (missing closing parenthesis): "${selector}"`)
          selector = undefined
        }
        // Check for incomplete attribute values
        if (selector.includes('=') && (selector.match(/=/g) || []).length > (selector.match(/["']/g) || []).length) {
          console.warn(`Llama: Malformed selector detected (incomplete attribute value): "${selector}"`)
          selector = undefined
        }
      }
      
      // Map to LLMAction format
      const action: LLMAction = {
        action: actionData.action || 'scroll', // Default to scroll instead of wait
        target: target,
        selector: selector,
        value: actionData.value,
        description: actionData.description || 'No description provided',
        confidence: actionData.confidence || 0.8
      }
      
      // If selector is invalid and action requires it, fall back to scroll
      if ((action.action === 'click' || action.action === 'type' || action.action === 'assert') && !action.selector && !action.target) {
        console.warn(`Llama: Action "${action.action}" requires a selector but none provided, defaulting to scroll`)
        action.action = 'scroll'
      }
      
      console.log('Llama: Parsed action:', action.action, action.selector || action.target || '')

      return action
    } catch (error: any) {
      console.error('Llama API error:', error.message)
      
      // Fallback to simple heuristic if API fails
      return this.fallbackAction(context, history, goal)
    }
  }

  /**
   * Analyze page for testability - UI Diagnosis Phase
   */
  async analyzePageTestability(context: VisionContext): Promise<{
    summary: string
    testableComponents: Array<{ name: string; selector: string; description: string; testability: 'high' | 'medium' | 'low' }>
    nonTestableComponents: Array<{ name: string; reason: string }>
    recommendedTests: string[]
    highRiskAreas?: Array<{
      name: string
      type: 'third_party_integration' | 'complex_state' | 'flaky_component' | 'security_sensitive' | 'manual_judgment'
      selector?: string
      description: string
      riskLevel: 'critical' | 'high' | 'medium' | 'low'
      requiresManualIntervention: boolean
      reason: string
    }>
  }> {
    // For local Ollama, API key is optional
    // For remote APIs, API key is required
    const requiresApiKey = !this.isLocalOllama
    if (requiresApiKey && !this.apiKey) {
      throw new Error('Llama API key required for remote API diagnosis')
    }

    try {
      // Full 60 elements for comprehensive diagnosis quality
      const elementPreview = context.elements.slice(0, 60)
      const contextDescription = elementPreview.map((e, idx) => {
        const hidden = e.isHidden ? ' [HIDDEN]' : ''
        const label = e.text || e.ariaLabel || e.name || 'unnamed'
        return `${idx + 1}. ${e.type}${hidden}: "${label}" - selector: "${e.selector}"`
      }).join('\n')

      const systemPrompt = `You are an expert QA Automation Engineer specializing in risk assessment and testability analysis. Analyze the provided web page elements and generate a comprehensive Testability Diagnosis Report with HIGH-RISK AREA DETECTION.

Your goal is to identify what can be tested, what cannot be tested, suggest a test plan, and CRITICALLY flag high-risk areas that require manual intervention.

Return a JSON object with this structure:
{
  "summary": "Brief overview of the page and its purpose",
  "testableComponents": [
    { "name": "Login Form", "selector": "#login-form", "description": "Standard username/password login", "testability": "high" }
  ],
  "nonTestableComponents": [
    { "name": "Captcha", "reason": "Dynamic image content cannot be automated reliably" }
  ],
  "recommendedTests": [
    "Verify login with valid credentials",
    "Check error message for invalid password"
  ],
  "highRiskAreas": [
    {
      "name": "Payment Gateway Integration",
      "type": "third_party_integration",
      "selector": "#stripe-payment-form",
      "description": "Stripe payment form detected - requires manual verification of transaction flows",
      "riskLevel": "critical",
      "requiresManualIntervention": true,
      "reason": "Payment gateways involve real financial transactions and complex state management that cannot be fully automated"
    }
  ]
}

CRITICAL RULES FOR HIGH-RISK DETECTION:

1. **Third-Party Integrations** (ALWAYS flag as high-risk):
   - Payment gateways: Stripe, PayPal, Square, Braintree, Adyen, Razorpay, etc.
   - OAuth providers: Google, Facebook, GitHub, Microsoft login buttons
   - Social media embeds: Facebook widgets, Twitter feeds, Instagram embeds
   - Analytics/tracking: Google Analytics, Mixpanel, Segment (may affect test reliability)
   - Chat widgets: Intercom, Zendesk, Drift, Crisp
   - Video players: YouTube, Vimeo embeds
   - Maps: Google Maps, Mapbox integrations
   - Look for: iframe elements, external domain references, third-party script tags

2. **Complex State Management** (Flag as high-risk):
   - React Context API usage (check for data-testid="context-provider" or React DevTools indicators)
   - Redux/state management libraries (look for store references, dispatch actions)
   - Multi-step forms with complex validation
   - Real-time data updates (WebSocket connections, polling)
   - Undo/redo functionality
   - Optimistic UI updates
   - Look for: state-related attributes, complex form flows, async state updates

3. **Known Flaky Components** (Flag as high-risk):
   - Animations and transitions (CSS animations, transitions, keyframes)
   - Timers and delays (setTimeout, setInterval usage)
   - Date/time pickers (timezone issues, date formatting)
   - Drag and drop interfaces
   - File uploads with progress indicators
   - Infinite scroll implementations
   - Lazy-loaded content
   - Elements with dynamic classes that change frequently
   - Look for: animation-related classes, timer-based interactions, dynamic content loading

4. **Security-Sensitive Areas** (ALWAYS flag as critical):
   - Authentication flows (login, signup, password reset)
   - Two-factor authentication (2FA) components
   - CAPTCHA implementations
   - Payment processing forms
   - Personal data input forms (SSN, credit cards, etc.)

5. **Manual Intervention Indicators**:
   - Elements that require human judgment (image verification, content moderation)
   - Components that change based on user location/time
   - A/B testing variations
   - Elements that require external verification (email confirmation, SMS codes)

For each high-risk area, provide:
- "type": One of "third_party_integration", "complex_state", "flaky_component", "security_sensitive", "manual_judgment"
- "riskLevel": "critical", "high", "medium", "low"
- "requiresManualIntervention": true/false
- "reason": Detailed explanation of why this requires manual attention

Additional Rules:
- Identify high-value user flows (Login, Sign up, Checkout, Search).
- Flag items like Captchas, 2FA, or Third-party iframes as potential blockers.
- Be thorough in detecting third-party integrations - they are the #1 cause of test failures.
- Be concise but professional.`

      const userPrompt = `Analyze these page elements:\n\n${contextDescription}`

      const messages: LlamaMessage[] = [
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
      
      const response = await axios.post<LlamaResponse>(
        `${this.apiUrl}/chat/completions`,
        {
          model: this.model,
          messages,
          temperature: 0.3,
          response_format: { type: 'json_object' },
          max_tokens: 1200 // Allow full diagnosis response
        },
        {
          headers,
          timeout: 60000 // 60 second timeout for comprehensive diagnosis (60 elements)
        }
      )

      const content = response.data.choices[0]?.message?.content
      if (!content) throw new Error('No response from Llama')

      return JSON.parse(content)
    } catch (error: any) {
      console.error('Llama Diagnosis Error:', error.message)
      // Fallback if LLM fails
      return {
        summary: 'Automated diagnosis failed - verify page manually.',
        testableComponents: context.elements.slice(0, 5).map(e => ({
          name: e.text || e.type,
          selector: e.selector || '',
          description: `Detected ${e.type}`,
          testability: 'medium'
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
            reason: 'LLM analysis failed, manual verification needed to identify testability issues'
          }
        ]
      }
    }
  }

  /**
   * Analyze DOM snapshot and build a lightweight interaction context
   * Avoid sending raw HTML to the language model by summarizing interactive elements.
   */
  async analyzeScreenshot(_screenshotBase64: string, domSnapshot: string, goal: string): Promise<VisionContext> {
    try {
      console.log('Llama: Summarizing DOM for goal:', goal)
      
      const { elements, hiddenCount } = this.extractElementsFromDOM(domSnapshot)
      const limitedElements = elements.slice(0, MAX_INTERACTIVE_ELEMENTS)
      const accessibility = this.buildAccessibilitySummary(limitedElements)
      
      console.log(`Llama: Summarized ${limitedElements.length}/${elements.length} interactive elements (hidden: ${hiddenCount})`)

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
      console.error('Llama DOM analysis error:', error.message)
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
   * Extract interactive elements from DOM HTML using cheerio parser
   * More reliable than regex for handling malformed HTML and edge cases
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
      
      // Fallback: use nth-of-type
      const index = elements.filter(e => e.type === tagName).length + 1
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
      const $ = cheerio.load(html, {
        xml: false
      })

      // Extract buttons
      $('button').each((_index, element) => {
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
      $('input').each((_index, element) => {
        const $el = $(element)
        const inputType = ($el.attr('type') || 'text').toLowerCase()
        const hidden = inputType === 'hidden' || isElementHidden($el)
        
        // Enhanced: Detect required attribute using cheerio
        const isRequired = $el.attr('required') !== undefined || $el.attr('aria-required') === 'true'
        
        // Enhanced: Detect min/max length
        const minLengthAttr = $el.attr('minlength')
        const maxLengthAttr = $el.attr('maxlength')
        const minLength = minLengthAttr ? parseInt(minLengthAttr, 10) : undefined
        const maxLength = maxLengthAttr ? parseInt(maxLengthAttr, 10) : undefined
        
        // Enhanced: Detect pattern attribute
        const pattern = $el.attr('pattern') || undefined
        
        const selector = buildSelector($el, 'input')
        const role = inputType === 'checkbox' ? 'checkbox'
          : inputType === 'radio' ? 'radio'
          : inputType === 'submit' ? 'button'
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
          // Enhanced: Add metadata for testing strategy
          isRequired: isRequired,
          minLength: minLength,
          maxLength: maxLength,
          pattern: pattern,
        })
      })

      // Extract links
      $('a').each((_index, element) => {
        const $el = $(element)
        const text = sanitize($el.text())
        const href = $el.attr('href') || ''
        const hidden = isElementHidden($el)
        const selector = buildSelector($el, 'a', text)
        
        if (!selector) return // Skip if no selector can be built
        
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
      $('select').each((_index, element) => {
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
      console.warn('Llama: Error extracting elements from DOM with cheerio:', error.message)
      // Fallback: return empty array if parsing fails completely
    }

    return { elements, hiddenCount }
  }

  private buildAccessibilitySummary(elements: VisionElement[]): AccessibilityNode[] {
    const nodes: AccessibilityNode[] = []

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
   * Fallback action generator when API fails
   * Improved to avoid getting stuck on "wait" actions
   */
  private fallbackAction(
    context: VisionContext,
    history: Array<{ action: LLMAction; timestamp: string }>,
    goal: string
  ): LLMAction {
    console.warn('Llama: Using fallback action generator (API may have failed)')
    
    // Count consecutive wait actions
    const recentWaits = history.slice(-3).filter(h => h.action.action === 'wait').length
    
    // If we've been waiting too much, try to interact
    if (recentWaits >= 2 && context.elements.length > 0) {
      // Find first clickable element
      const clickableElement = context.elements.find(e => 
        e.type === 'button' || e.type === 'link' || e.text
      )
      
      if (clickableElement) {
        return {
          action: 'click',
          target: clickableElement.text || 'element',
          selector: clickableElement.selector,
          description: `Click ${clickableElement.text || clickableElement.type} to explore page`,
          confidence: 0.7,
        }
      }
      
      // If no clickable, try scrolling
      if (history.filter(h => h.action.action === 'scroll').length < 3) {
        return {
          action: 'scroll',
          description: 'Scroll down to see more content',
          confidence: 0.8,
        }
      }
    }
    
    // Enhanced element matching with regex patterns and role prioritization
    const loginPattern = /(login|sign\s*in|log\s*in|authenticate|sign\s*into)/i
    const shopPattern = /(shop|buy|purchase|store|cart|checkout|product)/i
    const searchPattern = /(search|find|lookup|query)/i
    const submitPattern = /(submit|send|continue|next|proceed|confirm)/i
    
    const goalLower = goal.toLowerCase()
    
    // Prioritize elements by role/type first, then by text matching
    // 1. Buttons and links with role='button' or role='link' are highest priority
    // 2. Inputs with type='text' or type='search' for typing
    // 3. Elements with matching text patterns
    
    // Find login button - prioritize by role, then text
    const loginButton = context.elements.find(e => {
      const isButton = (e.type === 'button' || e.role === 'button' || e.role === 'link') && !e.isHidden
      const textMatch = e.text && loginPattern.test(e.text)
      const ariaMatch = e.ariaLabel && loginPattern.test(e.ariaLabel)
      return isButton && (textMatch || ariaMatch)
    })
    
    // Find shop/e-commerce button - prioritize by role, then text
    const shopButton = context.elements.find(e => {
      const isButton = (e.type === 'button' || e.type === 'link' || e.role === 'button' || e.role === 'link') && !e.isHidden
      const textMatch = e.text && shopPattern.test(e.text)
      const ariaMatch = e.ariaLabel && shopPattern.test(e.ariaLabel)
      return isButton && (textMatch || ariaMatch)
    })
    
    // Find search input - prioritize by type and role
    const searchInput = context.elements.find(e => {
      const isInput = e.type === 'input' && (e.inputType === 'text' || e.inputType === 'search' || !e.inputType) && !e.isHidden
      const textMatch = e.text && searchPattern.test(e.text)
      const ariaMatch = e.ariaLabel && searchPattern.test(e.ariaLabel)
      const nameMatch = e.name && searchPattern.test(e.name)
      return isInput && (textMatch || ariaMatch || nameMatch)
    })
    
    // Find submit button in form context
    const submitButton = context.elements.find(e => {
      const isButton = (e.type === 'button' || e.role === 'button') && !e.isHidden
      const textMatch = e.text && submitPattern.test(e.text)
      const ariaMatch = e.ariaLabel && submitPattern.test(e.ariaLabel)
      const isSubmit = e.inputType === 'submit'
      return isButton && (textMatch || ariaMatch || isSubmit)
    })
    
    // Prioritize based on goal and element type
    if (goalLower.includes('shop') && shopButton) {
      return {
        action: 'click',
        target: 'shop-button',
        selector: shopButton.selector,
        description: 'Click shop button (fallback action)',
        confidence: 0.85,
      }
    }
    
    if (loginButton && history.length === 0) {
      return {
        action: 'click',
        target: 'login-button',
        selector: loginButton.selector,
        description: 'Click the login button (fallback action)',
        confidence: 0.85,
      }
    }
    
    // If we have a form context (submit button present), prioritize form inputs
    if (submitButton && searchInput && history.filter(h => h.action.action === 'type').length === 0) {
      // Generate context-aware search term based on website type
      let searchTerm = 'product'
      
      // Detect website type from goal/context (goalLower already defined above)
      if (goalLower.includes('e-commerce') || goalLower.includes('shop') || goalLower.includes('store') || goalLower.includes('buy')) {
        searchTerm = 'product'
      } else if (goalLower.includes('blog') || goalLower.includes('article')) {
        searchTerm = 'article'
      } else if (goalLower.includes('news')) {
        searchTerm = 'news'
      } else if (goalLower.includes('plant') || goalLower.includes('garden')) {
        searchTerm = 'plant'
      } else {
        // Try to extract a relevant term from the page context
        const pageText = context.elements.map(e => e.text || '').join(' ').toLowerCase()
        if (pageText.includes('plant') || pageText.includes('garden')) {
          searchTerm = 'plant'
        } else if (pageText.includes('product') || pageText.includes('shop')) {
          searchTerm = 'product'
        } else {
          searchTerm = 'search' // Generic fallback
        }
      }
      
      return {
        action: 'type',
        target: 'search-input',
        selector: searchInput.selector,
        value: searchTerm,
        description: `Type "${searchTerm}" in search input (context-aware search term)`,
        confidence: 0.8,
      }
    }
    
    // Try clicking first available interactive element, prioritizing by role
    if (context.elements.length > 0) {
      // Prioritize buttons and links with proper roles
      const prioritizedElement = context.elements.find(e => 
        (e.type === 'button' || e.type === 'link') && 
        (e.role === 'button' || e.role === 'link') && 
        !e.isHidden
      ) || context.elements.find(e => 
        (e.type === 'button' || e.type === 'link') && !e.isHidden
      ) || context.elements[0]
      
      if (prioritizedElement && (prioritizedElement.type === 'link' || prioritizedElement.type === 'button')) {
        return {
          action: 'click',
          target: prioritizedElement.text || prioritizedElement.type,
          selector: prioritizedElement.selector,
          description: `Click ${prioritizedElement.text || prioritizedElement.type} (fallback action)`,
          confidence: 0.7,
        }
      }
    }
    
    // Try scrolling if we haven't scrolled much
    if (history.filter(h => h.action.action === 'scroll').length < 2) {
      return {
        action: 'scroll',
        description: 'Scroll down to see more content',
        confidence: 0.75,
      }
    }
    
    // Only wait if we really have no options
    if (context.elements.length === 0 && history.length < 3) {
      return {
        action: 'wait',
        description: 'Waiting for page to load (no elements found yet)',
        confidence: 0.6,
      }
    }
    
    // After many steps, complete only if we've done substantial testing
    if (history.length >= 20) {
      return {
        action: 'complete',
        description: 'Test completed - reached step limit',
        confidence: 0.9,
      }
    }
    
    // Default: try to scroll or click something
    if (context.elements.length > 0) {
      const randomElement = context.elements[Math.floor(Math.random() * Math.min(context.elements.length, 5))]
      return {
        action: 'click',
        target: randomElement.text || randomElement.type,
        selector: randomElement.selector,
        description: `Click ${randomElement.text || randomElement.type} to continue testing`,
        confidence: 0.7,
      }
    }
    
    // Last resort: wait
    return {
      action: 'wait',
      description: 'Waiting for page to load',
      confidence: 0.5,
    }
  }
}

