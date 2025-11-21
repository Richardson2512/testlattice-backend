// Mistral Large 2 service for LLM interactions
import { LLMAction, VisionContext } from '../types'
import axios from 'axios'

interface MistralMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface MistralResponse {
  choices: Array<{
    message: {
      role: string
      content: string
    }
  }>
}

export class MistralService {
  private apiKey: string
  private apiUrl = 'https://api.mistral.ai/v1'
  private model = 'mistral-large-2407'

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  /**
   * Generate next action based on context and history
   * Goal may contain Deepseek-parsed instructions
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
    }
  ): Promise<LLMAction> {
    try {
      // Check if goal contains Deepseek-parsed instructions or regular user instructions
      const hasDeepseekInstructions = goal.includes('PARSED BY DEEPSEEK')
      const hasUserInstructions = goal.includes('USER INSTRUCTIONS') || goal.includes('PARSED BY DEEPSEEK')
      const userInstructionsText = hasUserInstructions 
        ? (goal.includes('PARSED BY DEEPSEEK') 
            ? goal.split('PARSED BY DEEPSEEK - HIGHEST PRIORITY):')[1]?.split('\n\nAdditionally')[0]?.trim() || goal
            : goal.split('USER INSTRUCTIONS (PRIORITY):')[1]?.split('\n\n')[0]?.trim() || goal)
        : ''
      
      // Build prompt with context and history
      const systemPrompt = `You are an AI test automation agent working with Deepseek-parsed instructions. ${hasDeepseekInstructions
        ? `\n\n🎯 DEEPSEEK-PARSED USER INSTRUCTIONS (HIGHEST PRIORITY - FOLLOW EXACTLY):\n${userInstructionsText}\n\nThese instructions have been analyzed and structured by Deepseek AI. Follow them precisely.`
        : hasUserInstructions 
          ? `\n\n🎯 USER INSTRUCTIONS (HIGHEST PRIORITY - FOLLOW THESE FIRST):\n${userInstructionsText}\n\n`
          : `Your goal is to help complete the test: "${goal}".\n\n`
      }CRITICAL: ${hasUserInstructions 
        ? 'The user has provided specific instructions (parsed by Deepseek for clarity). You MUST follow those instructions as your primary objective. '
        : ''
      }Only mark the test as complete when you have fully satisfied ${hasUserInstructions ? 'all the parsed user instructions' : 'the test goal'}.

IMPORTANT RULES:
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
10. Use "scroll" to see more content if needed
11. Only use "complete" when you have thoroughly tested the page and ${hasUserInstructions ? 'completed the user instructions' : 'achieved the goal'}

Available actions:
- click: Click on an element (REQUIRES selector from the elements list below)
- type: Type text into an input field (REQUIRES selector and value)
- scroll: Scroll down the page to see more content
- navigate: Navigate to a URL (only if needed to go to a different page)
- wait: ONLY if page is still loading (avoid this - prefer other actions)
- assert: Assert a condition
- complete: ONLY when test goal is fully achieved (avoid early completion)

Return your response as a JSON object with: action, target (optional), selector (REQUIRED for click/type), value (optional), description, confidence (0-1).`

      const contextDescription = context.elements.length > 0
        ? `Current page has ${context.elements.length} interactive elements available (including hidden elements for validation):
${context.elements.slice(0, 40).map((e: any, idx) => {
  const hidden = e.isHidden ? ' [HIDDEN - verify exists]' : ''
  const href = e.href ? ` -> ${e.href}` : ''
  return `${idx + 1}. ${e.type}${hidden}: "${e.text || 'unnamed'}"${href} - selector: "${e.selector}"`
}).join('\n')}

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
      
      const userPrompt = `${contextDescription}\n\n${historyDescription}${trackingInfoStr}\n\n${hasUserInstructions 
        ? `🎯 REMEMBER: Your PRIMARY objective is to follow the user instructions: "${userInstructionsText}"\n\n`
        : ''
      }Based on ${hasUserInstructions ? 'the user instructions above' : `the goal "${goal}"`}, what is the next action? 

CRITICAL RULES:
- DO NOT click elements you've already visited (check visited elements list above)
- DO NOT repeatedly click email addresses, phone numbers, or support links
- For search inputs: Use relevant search terms based on the website type (e.g., for e-commerce: "product", "shoes", "laptop" - NOT "test")
- For "all pages" mode: Navigate to discovered pages that haven't been visited yet
- Prefer clicking navigation links, buttons, and menu items over contact information
- Remember: prefer click/type/scroll over wait. Only complete if ${hasUserInstructions ? 'user instructions are fully completed' : 'goal is fully achieved'}.`

      const messages: MistralMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]

      const response = await axios.post<MistralResponse>(
        `${this.apiUrl}/chat/completions`,
        {
          model: this.model,
          messages,
          temperature: 0.7,
          response_format: { type: 'json_object' }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      )

      const content = response.data.choices[0]?.message?.content
      if (!content) {
        throw new Error('No response from Mistral API')
      }

      console.log('Mistral API response:', content.substring(0, 200)) // Log first 200 chars for debugging

      // Parse JSON response
      let actionData: any
      try {
        actionData = JSON.parse(content)
      } catch (parseError: any) {
        console.error('Mistral: Failed to parse JSON response:', parseError.message)
        console.error('Mistral: Raw response:', content)
        throw new Error(`Invalid JSON response from Mistral: ${parseError.message}`)
      }
      
      // Validate action type
      const validActions = ['click', 'type', 'scroll', 'navigate', 'wait', 'assert', 'complete']
      if (!validActions.includes(actionData.action)) {
        console.warn(`Mistral: Invalid action "${actionData.action}", defaulting to scroll`)
        actionData.action = 'scroll'
      }
      
      // Map to LLMAction format
      const action: LLMAction = {
        action: actionData.action || 'scroll', // Default to scroll instead of wait
        target: actionData.target,
        selector: actionData.selector,
        value: actionData.value,
        description: actionData.description || 'No description provided',
        confidence: actionData.confidence || 0.8
      }
      
      console.log('Mistral: Parsed action:', action.action, action.selector || action.target || '')

      return action
    } catch (error: any) {
      console.error('Mistral API error:', error.message)
      
      // Fallback to simple heuristic if API fails
      return this.fallbackAction(context, history, goal)
    }
  }

  /**
   * Analyze screenshot and extract context from DOM
   * Extracts real elements from the DOM snapshot instead of using hardcoded values
   */
  async analyzeScreenshot(screenshotBase64: string, domSnapshot: string, goal: string): Promise<VisionContext> {
    try {
      console.log('Mistral: Analyzing screenshot and DOM for goal:', goal)
      
      // Parse DOM to extract interactive elements
      const elements = this.extractElementsFromDOM(domSnapshot)
      
      console.log(`Mistral: Found ${elements.length} interactive elements in DOM`)

      return {
        elements,
        screenshot: screenshotBase64,
        timestamp: new Date().toISOString(),
      }
    } catch (error: any) {
      console.error('Mistral screenshot analysis error:', error.message)
      // Return empty context on error instead of throwing
      return {
        elements: [],
        screenshot: screenshotBase64,
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Extract interactive elements from DOM HTML
   * Includes ALL elements (visible and hidden) for comprehensive testing
   * Hidden elements are important for finding breakdowns
   */
  private extractElementsFromDOM(html: string): Array<{ type: string; text?: string; selector: string; bounds: { x: number; y: number; width: number; height: number }; isHidden?: boolean; href?: string }> {
    const elements: Array<{ type: string; text?: string; selector: string; bounds: { x: number; y: number; width: number; height: number }; isHidden?: boolean; href?: string }> = []
    
    try {
      // Helper to check if element is hidden
      const isElementHidden = (fullTag: string): boolean => {
        return (
          fullTag.includes('type="hidden"') ||
          fullTag.includes('aria-hidden="true"') ||
          fullTag.includes('hidden') ||
          fullTag.includes('display:none') ||
          fullTag.includes('visibility:hidden')
        )
      }
      
      // Find buttons (including hidden ones for validation)
      const buttonRegex = /<button[^>]*>([^<]*)<\/button>/gi
      let match
      while ((match = buttonRegex.exec(html)) !== null) {
        const fullTag = match[0]
        const text = match[1].trim()
        const hidden = isElementHidden(fullTag)
        
        // Extract attributes to build selector (prioritize stable selectors)
        const idMatch = fullTag.match(/id=["']([^"']+)["']/)
        const dataTestIdMatch = fullTag.match(/data-testid=["']([^"']+)["']/)
        const dataIdMatch = fullTag.match(/data-id=["']([^"']+)["']/)
        const ariaLabelMatch = fullTag.match(/aria-label=["']([^"']+)["']/)
        const typeMatch = fullTag.match(/type=["']([^"']+)["']/)
        
        let selector = ''
        if (idMatch && idMatch[1]) {
          selector = `#${idMatch[1]}`
        } else if (dataTestIdMatch && dataTestIdMatch[1]) {
          selector = `[data-testid="${dataTestIdMatch[1]}"]`
        } else if (dataIdMatch && dataIdMatch[1]) {
          selector = `[data-id="${dataIdMatch[1]}"]`
        } else if (ariaLabelMatch && ariaLabelMatch[1]) {
          selector = `button[aria-label="${ariaLabelMatch[1]}"]`
        } else if (text && text.length > 0 && text.length < 100) {
          // Use Playwright text selector - more reliable than CSS
          selector = `button:has-text("${text.replace(/"/g, '\\"').replace(/\n/g, ' ').trim()}")`
        } else if (typeMatch && typeMatch[1]) {
          selector = `button[type="${typeMatch[1]}"]`
        } else {
          // Last resort: use button index (not ideal but better than nothing)
          const buttonIndex = elements.filter(e => e.type === 'button').length
          selector = `button:nth-of-type(${buttonIndex + 1})`
        }
        
        elements.push({
          type: 'button',
          text: text || undefined,
          selector,
          bounds: { x: 0, y: 0, width: 120, height: 40 },
          isHidden: hidden,
        })
      }
      
      // Find inputs (INCLUDING hidden inputs - they're important for validation)
      const inputRegex = /<input[^>]*>/gi
      while ((match = inputRegex.exec(html)) !== null) {
        const fullTag = match[0]
        const typeMatch = fullTag.match(/type=["']([^"']+)["']/)
        const inputType = typeMatch ? typeMatch[1].toLowerCase() : 'text'
        const hidden = inputType === 'hidden' || isElementHidden(fullTag)
        
        // Extract attributes to build selector
        const idMatch = fullTag.match(/id=["']([^"']+)["']/)
        const dataTestIdMatch = fullTag.match(/data-testid=["']([^"']+)["']/)
        const nameMatch = fullTag.match(/name=["']([^"']+)["']/)
        const placeholderMatch = fullTag.match(/placeholder=["']([^"']+)["']/)
        const valueMatch = fullTag.match(/value=["']([^"']+)["']/)
        
        let selector = ''
        if (idMatch && idMatch[1]) {
          selector = `#${idMatch[1]}`
        } else if (dataTestIdMatch && dataTestIdMatch[1]) {
          selector = `[data-testid="${dataTestIdMatch[1]}"]`
        } else if (nameMatch && nameMatch[1]) {
          selector = `[name="${nameMatch[1]}"]`
        } else if (placeholderMatch && placeholderMatch[1]) {
          selector = `input[placeholder="${placeholderMatch[1]}"]`
        } else if (inputType) {
          selector = `input[type="${inputType}"]`
        } else {
          continue
        }
        
        elements.push({
          type: hidden ? 'hidden-input' : 'input',
          selector,
          bounds: { x: 0, y: 0, width: 300, height: 40 },
          isHidden: hidden,
        })
      }
      
      // Find links (INCLUDING all links - we want to test redirects)
      const linkRegex = /<a[^>]*>([^<]*)<\/a>/gi
      while ((match = linkRegex.exec(html)) !== null) {
        const fullTag = match[0]
        const text = match[1].trim()
        const hrefMatch = fullTag.match(/href=["']([^"']+)["']/)
        const href = hrefMatch ? hrefMatch[1] : ''
        const hidden = isElementHidden(fullTag)
        
        // Extract attributes to build selector
        const idMatch = fullTag.match(/id=["']([^"']+)["']/)
        const dataTestIdMatch = fullTag.match(/data-testid=["']([^"']+)["']/)
        const dataIdMatch = fullTag.match(/data-id=["']([^"']+)["']/)
        
        let selector = ''
        if (idMatch && idMatch[1]) {
          selector = `#${idMatch[1]}`
        } else if (dataTestIdMatch && dataTestIdMatch[1]) {
          selector = `[data-testid="${dataTestIdMatch[1]}"]`
        } else if (dataIdMatch && dataIdMatch[1]) {
          selector = `[data-id="${dataIdMatch[1]}"]`
        } else if (href && href.length > 0) {
          // Use href as selector (escape special chars)
          const escapedHref = href.replace(/"/g, '\\"')
          selector = `a[href="${escapedHref}"]`
        } else if (text && text.length > 0 && text.length < 100) {
          // Use Playwright text selector - more reliable than CSS
          selector = `a:has-text("${text.replace(/"/g, '\\"').replace(/\n/g, ' ').trim()}")`
        } else {
          // Last resort: use href if available
          if (href) {
            const escapedHref = href.replace(/"/g, '\\"')
            selector = `a[href="${escapedHref}"]`
          } else {
            continue
          }
        }
        
        elements.push({
          type: 'link',
          text: text || undefined,
          selector,
          bounds: { x: 0, y: 0, width: 100, height: 20 },
          isHidden: hidden,
          href: href || undefined,
        })
      }
      
      // Find select elements (dropdowns)
      const selectRegex = /<select[^>]*>/gi
      while ((match = selectRegex.exec(html)) !== null) {
        const fullTag = match[0]
        
        if (fullTag.includes('aria-hidden="true"') || fullTag.includes('hidden')) {
          continue
        }
        
        const idMatch = fullTag.match(/id=["']([^"']+)["']/)
        const nameMatch = fullTag.match(/name=["']([^"']+)["']/)
        const dataTestIdMatch = fullTag.match(/data-testid=["']([^"']+)["']/)
        
        let selector = ''
        if (idMatch && idMatch[1]) {
          selector = `#${idMatch[1]}`
        } else if (dataTestIdMatch && dataTestIdMatch[1]) {
          selector = `[data-testid="${dataTestIdMatch[1]}"]`
        } else if (nameMatch && nameMatch[1]) {
          selector = `select[name="${nameMatch[1]}"]`
        } else {
          continue
        }
        
        elements.push({
          type: 'select',
          selector,
          bounds: { x: 0, y: 0, width: 200, height: 40 },
        })
      }
      
      console.log(`Mistral: Extracted ${elements.length} interactive elements (including hidden elements for validation)`)
      
    } catch (error: any) {
      console.warn('Mistral: Error extracting elements from DOM:', error.message)
    }
    
    return elements
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
    console.warn('Mistral: Using fallback action generator (API may have failed)')
    
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
    
    // Look for common interactive elements
    const shopButton = context.elements.find(e => 
      e.text?.toLowerCase().includes('shop') || 
      e.text?.toLowerCase().includes('buy') ||
      e.text?.toLowerCase().includes('product')
    )
    
    const loginButton = context.elements.find(e => 
      e.text?.toLowerCase().includes('login') || 
      e.text?.toLowerCase().includes('sign in')
    )
    
    const searchInput = context.elements.find(e => e.type === 'input')
    
    // Prioritize based on goal
    if (goal.toLowerCase().includes('shop') && shopButton) {
      return {
        action: 'click',
        target: 'shop-button',
        selector: shopButton.selector,
        description: 'Click shop button',
        confidence: 0.85,
      }
    }
    
    if (loginButton && history.length === 0) {
      return {
        action: 'click',
        target: 'login-button',
        selector: loginButton.selector,
        description: 'Click the login button',
        confidence: 0.85,
      }
    }
    
    if (searchInput && history.filter(h => h.action.action === 'type').length === 0) {
      // Generate context-aware search term based on website type
      let searchTerm = 'product'
      
      // Detect website type from goal/context
      const goalLower = goal.toLowerCase()
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
    
    // Try clicking first available link or button
    if (context.elements.length > 0) {
      const firstElement = context.elements[0]
      if (firstElement.type === 'link' || firstElement.type === 'button') {
        return {
          action: 'click',
          target: firstElement.text || firstElement.type,
          selector: firstElement.selector,
          description: `Click ${firstElement.text || firstElement.type}`,
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

