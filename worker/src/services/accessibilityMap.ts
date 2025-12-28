/**
 * Accessibility Map Service
 * Creates a simplified, AI-readable representation of the page with only interactive elements
 * Includes position data, functional grouping, and nearby text context
 */

import { Page } from 'playwright'
import { VisionElement } from '../types'

export interface AccessibilityMapElement {
  tagName: string
  type: string | null
  id: string | null
  classes: string[]
  name: string | null
  'data-testid': string | null
  'aria-label': string | null
  role: string | null
  text: string | null
  placeholder: string | null
  href: string | null
  position: {
    x: number
    y: number
    width: number
    height: number
  }
  bestSelector: string
  nearbyText: string[]
  parentContext: string | null
  inputType?: string
  isRequired?: boolean
  minLength?: number
  maxLength?: number
  pattern?: string
}

export interface FunctionalGroups {
  forms: AccessibilityMapElement[]
  buttons: AccessibilityMapElement[]
  links: AccessibilityMapElement[]
  interactive: AccessibilityMapElement[]
}

export interface AccessibilityMap {
  totalInteractive: number
  elements: AccessibilityMapElement[]
  groups: FunctionalGroups
  pageInfo: {
    url: string
    title: string
    viewport: { width: number; height: number }
  }
}

export class AccessibilityMapService {
  /**
   * Create accessibility map from live browser page
   * Extracts only interactive elements with position data
   */
  async createAccessibilityMap(page: Page): Promise<AccessibilityMap> {
    const pageInfo = {
      url: page.url(),
      title: await page.title(),
      viewport: page.viewportSize() || { width: 1280, height: 720 },
    }

    // Extract interactive elements with position data
    const interactiveElements = await page.evaluate(() => {
      const elements: Array<{
        tagName: string
        type: string | null
        id: string | null
        classes: string[]
        name: string | null
        'data-testid': string | null
        'aria-label': string | null
        role: string | null
        text: string | null
        placeholder: string | null
        href: string | null
        position: { x: number; y: number; width: number; height: number }
        bestSelector: string
        nearbyText: string[]
        parentContext: string | null
        inputType?: string
        isRequired?: boolean
        minLength?: number
        maxLength?: number
        pattern?: string
      }> = []

      // Selectors for interactive elements
      const selectors = [
        'a[href]',
        'button',
        'input:not([type="hidden"])',
        'textarea',
        'select',
        '[role="button"]',
        '[role="link"]',
        '[onclick]',
        '[tabindex="0"]',
      ]

      // Helper to generate best selector
      // Helper to generate best selector
      function generateBestSelector(el: Element): string {
        if (el.id) return `#${el.id}`
        const testId = el.getAttribute('data-testid')
        if (testId) return `[data-testid="${testId}"]`
        const dataId = el.getAttribute('data-id')
        if (dataId) return `[data-id="${dataId}"]`

        if (el.tagName.toLowerCase() === 'a') {
          const href = (el as HTMLAnchorElement).href
          if (href) return `a[href="${href}"]`
        }

        if (el.tagName.toLowerCase() === 'input') {
          const input = el as HTMLInputElement
          const name = input.name
          if (name) return `[name="${name}"]`
          const placeholder = input.placeholder
          if (placeholder) return `input[placeholder="${placeholder}"]`
          const type = input.type || 'text'
          return `input[type="${type}"]`
        }

        if (el.tagName.toLowerCase() === 'select') {
          const select = el as HTMLSelectElement
          const name = select.name
          if (name) return `select[name="${name}"]`
        }

        if (el.tagName.toLowerCase() === 'button') {
          const button = el as HTMLButtonElement
          const ariaLabel = button.getAttribute('aria-label')
          if (ariaLabel) return `button[aria-label="${ariaLabel}"]`
          const type = button.type
          if (type) return `button[type="${type}"]`
        }

        const text = el.textContent?.trim()
        if (text && text.length > 0 && text.length < 50) {
          // Escape quotes in text
          const safeText = text.substring(0, 30).replace(/"/g, '\\"')
          return `${el.tagName.toLowerCase()}:has-text("${safeText}")`
        }

        return el.tagName.toLowerCase()
      }

      // Helper to get nearby text (within 100px)
      // Helper to get nearby text (within 100px)
      function getNearbyText(el: Element, radius: number): string[] {
        const rect = el.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2
        const nearby: string[] = []

        // Walk up the DOM tree to find nearby text
        let current: Element | null = el.parentElement
        let depth = 0
        while (current && depth < 3) {
          const textNodes: Text[] = []
          const walker = document.createTreeWalker(current, NodeFilter.SHOW_TEXT, null)
          let node: Node | null
          while ((node = walker.nextNode())) {
            if (node.nodeValue && node.nodeValue.trim().length > 0) {
              const textEl = node.parentElement
              if (textEl) {
                const textRect = textEl.getBoundingClientRect()
                const textX = textRect.left + textRect.width / 2
                const textY = textRect.top + textRect.height / 2
                const distance = Math.sqrt(
                  Math.pow(textX - centerX, 2) + Math.pow(textY - centerY, 2)
                )
                if (distance <= radius && distance > 0) {
                  const text = node.nodeValue.trim()
                  if (text.length > 0 && text.length < 100) {
                    nearby.push(text)
                  }
                }
              }
            }
          }
          current = current.parentElement
          depth++
        }

        return nearby.slice(0, 3) // Limit to 3 nearby text snippets
      }

      // Process each selector
      selectors.forEach((selector) => {
        document.querySelectorAll(selector).forEach((el) => {
          const rect = el.getBoundingClientRect()
          const style = window.getComputedStyle(el)

          // Skip hidden elements
          if (
            rect.width === 0 ||
            rect.height === 0 ||
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            parseFloat(style.opacity) === 0
          ) {
            return
          }

          // Build element descriptor
          const tagName = el.tagName.toLowerCase()
          const inputEl = el as HTMLInputElement
          const anchorEl = el as HTMLAnchorElement

          const element: typeof elements[0] = {
            tagName,
            type: inputEl.type || null,
            id: el.id || null,
            classes: Array.from(el.classList),
            name: inputEl.name || anchorEl.name || null,
            'data-testid': el.getAttribute('data-testid'),
            'aria-label': el.getAttribute('aria-label'),
            role: el.getAttribute('role') || null,
            text: el.textContent?.trim().substring(0, 50) || null,
            placeholder: inputEl.placeholder || null,
            href: anchorEl.href || null,
            position: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
            bestSelector: generateBestSelector(el),
            nearbyText: getNearbyText(el, 100),
            parentContext: el.parentElement?.tagName.toLowerCase() || null,
          }

          // Add input-specific attributes
          if (tagName === 'input') {
            element.inputType = inputEl.type || 'text'
            element.isRequired = inputEl.required || el.hasAttribute('aria-required')
            element.minLength = inputEl.minLength || undefined
            element.maxLength = inputEl.maxLength || undefined
            element.pattern = inputEl.pattern || undefined
          }

          elements.push(element)
        })
      })

      return elements
    })

    // Group by functionality
    const groups = this.categorizeElements(interactiveElements)

    return {
      totalInteractive: interactiveElements.length,
      elements: interactiveElements,
      groups,
      pageInfo,
    }
  }

  /**
   * Categorize elements into functional groups
   */
  private categorizeElements(
    elements: AccessibilityMapElement[]
  ): FunctionalGroups {
    return {
      forms: elements.filter(
        (e) =>
          e.tagName === 'input' ||
          e.tagName === 'textarea' ||
          e.tagName === 'select'
      ),
      buttons: elements.filter(
        (e) =>
          e.tagName === 'button' ||
          e.type === 'submit' ||
          e.role === 'button'
      ),
      links: elements.filter((e) => e.tagName === 'a' || e.role === 'link'),
      interactive: elements.filter(
        (e) => e.role === 'button' || e.tagName === 'button' || e.tagName === 'a'
      ),
    }
  }

  /**
   * Convert accessibility map to VisionElement format for compatibility
   */
  convertToVisionElements(map: AccessibilityMap): VisionElement[] {
    return map.elements.map((el) => ({
      type: this.mapTagToType(el.tagName, el.type),
      role: (el.role || this.inferRole(el.tagName, el.type)) || undefined,
      text: el.text || undefined,
      name: (el.name || el.text || el['aria-label']) || undefined,
      ariaLabel: el['aria-label'] || undefined,
      selector: el.bestSelector,
      bounds: el.position,
      isHidden: false,
      inputType: el.inputType,
      isRequired: el.isRequired,
      minLength: el.minLength,
      maxLength: el.maxLength,
      pattern: el.pattern,
      href: el.href || undefined,
      className: el.classes.join(' '),
    }))
  }

  private mapTagToType(tagName: string, type: string | null): string {
    if (tagName === 'input') {
      return type === 'hidden' ? 'hidden-input' : 'input'
    }
    return tagName
  }

  private inferRole(tagName: string, type: string | null): string {
    if (tagName === 'input') {
      if (type === 'checkbox') return 'checkbox'
      if (type === 'radio') return 'radio'
      if (type === 'submit') return 'button'
      return 'textbox'
    }
    if (tagName === 'select') return 'combobox'
    if (tagName === 'button') return 'button'
    if (tagName === 'a') return 'link'
    return tagName
  }
}

