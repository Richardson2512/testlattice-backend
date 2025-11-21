/**
 * Comprehensive Testing Service
 * Implements all 9 feature categories for AI-powered frontend testing
 */

import { Page } from 'playwright'

export interface ConsoleError {
  type: 'error' | 'warning' | 'info'
  message: string
  source?: string
  line?: number
  column?: number
  stack?: string
  timestamp: string
}

export interface NetworkError {
  url: string
  method: string
  status: number
  statusText: string
  failed: boolean
  errorText?: string
  timestamp: string
  resourceType?: string
}

export interface PerformanceMetrics {
  pageLoadTime: number
  firstContentfulPaint?: number
  domContentLoaded?: number
  totalPageSize?: number
  jsBundleSize?: number
  cssSize?: number
  imageSize?: number
  lighthouseScore?: {
    performance: number
    accessibility: number
    bestPractices: number
    seo: number
  }
}

export interface AccessibilityIssue {
  id: string
  type: 'error' | 'warning' | 'info'
  message: string
  element?: string
  selector?: string
  impact: 'critical' | 'serious' | 'moderate' | 'minor'
  fix?: string
}

export interface VisualIssue {
  type: 'layout-shift' | 'text-overflow' | 'element-overlap' | 'missing-element' | 'misaligned'
  element?: string
  selector?: string
  description: string
  severity: 'high' | 'medium' | 'low'
  screenshot?: string
}

export interface DOMHealth {
  brokenLinks: Array<{ url: string; selector: string; status: number }>
  missingAltText: Array<{ selector: string; element: string }>
  missingLabels: Array<{ selector: string; element: string }>
  orphanedElements: Array<{ selector: string; element: string }>
  hiddenElements: Array<{ selector: string; element: string; reason: string }>
  jsErrors: ConsoleError[]
}

export interface ComprehensiveTestResults {
  consoleErrors: ConsoleError[]
  networkErrors: NetworkError[]
  performance: PerformanceMetrics
  accessibility: AccessibilityIssue[]
  visualIssues: VisualIssue[]
  domHealth: DOMHealth
  brokenLinks: Array<{ url: string; selector: string; status: number }>
}

export class ComprehensiveTestingService {
  private consoleErrors: ConsoleError[] = []
  private networkErrors: NetworkError[] = []
  private performanceMetrics: PerformanceMetrics | null = null
  private accessibilityIssues: AccessibilityIssue[] = []
  private visualIssues: VisualIssue[] = []
  private domHealthData: DOMHealth | null = null

  /**
   * Initialize comprehensive testing on a page
   */
  async initialize(page: Page): Promise<void> {
    // Set up console error tracking
    page.on('console', (msg) => {
      const type = msg.type() as 'error' | 'warning' | 'info'
      if (type === 'error' || type === 'warning') {
        this.consoleErrors.push({
          type,
          message: msg.text(),
          source: msg.location().url,
          line: msg.location().lineNumber,
          column: msg.location().columnNumber,
          timestamp: new Date().toISOString(),
        })
      }
    })

    // Set up network error tracking
    page.on('response', (response) => {
      const status = response.status()
      if (status >= 400) {
        this.networkErrors.push({
          url: response.url(),
          method: response.request().method(),
          status,
          statusText: response.statusText(),
          failed: status >= 400,
          resourceType: response.request().resourceType(),
          timestamp: new Date().toISOString(),
        })
      }
    })

    page.on('requestfailed', (request) => {
      this.networkErrors.push({
        url: request.url(),
        method: request.method(),
        status: 0,
        statusText: 'Failed',
        failed: true,
        errorText: request.failure()?.errorText || 'Network request failed',
        resourceType: request.resourceType(),
        timestamp: new Date().toISOString(),
      })
    })
  }

  /**
   * Collect performance metrics
   */
  async collectPerformanceMetrics(page: Page): Promise<PerformanceMetrics> {
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      const paint = performance.getEntriesByType('paint')
      const fcp = paint.find((entry) => entry.name === 'first-contentful-paint')
      
      // Calculate resource sizes
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
      let totalSize = 0
      let jsSize = 0
      let cssSize = 0
      let imageSize = 0
      
      resources.forEach((resource) => {
        const size = resource.transferSize || 0
        totalSize += size
        if (resource.name.includes('.js')) jsSize += size
        else if (resource.name.includes('.css')) cssSize += size
        else if (resource.name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) imageSize += size
      })

      return {
        pageLoadTime: navigation.loadEventEnd - navigation.fetchStart,
        firstContentfulPaint: fcp ? fcp.startTime : undefined,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
        totalPageSize: totalSize,
        jsBundleSize: jsSize,
        cssSize: cssSize,
        imageSize: imageSize,
      }
    })

    this.performanceMetrics = metrics
    return metrics
  }

  /**
   * Run accessibility checks
   */
  async checkAccessibility(page: Page): Promise<AccessibilityIssue[]> {
    const issues: AccessibilityIssue[] = []

    // Check for missing ARIA labels
    const missingAriaLabels = await page.evaluate(() => {
      const elements: Array<{ selector: string; element: string }> = []
      const interactiveElements = document.querySelectorAll('button, input, select, textarea, a[href]')
      
      interactiveElements.forEach((el) => {
        const hasAriaLabel = el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby')
        const hasText = el.textContent?.trim() || (el as HTMLInputElement).placeholder
        const hasTitle = el.hasAttribute('title')
        
        if (!hasAriaLabel && !hasText && !hasTitle && el.tagName !== 'A') {
          // Try to generate a selector
          let selector = ''
          if (el.id) selector = `#${el.id}`
          else if (el.className) selector = `.${el.className.split(' ')[0]}`
          else selector = el.tagName.toLowerCase()
          
          elements.push({
            selector,
            element: el.tagName.toLowerCase(),
          })
        }
      })
      
      return elements
    })

    missingAriaLabels.forEach((item) => {
      issues.push({
        id: `missing-aria-${Date.now()}-${Math.random()}`,
        type: 'warning',
        message: `Missing ARIA label for ${item.element}`,
        element: item.element,
        selector: item.selector,
        impact: 'moderate',
        fix: `Add aria-label or aria-labelledby attribute to ${item.selector}`,
      })
    })

    // Check for contrast issues (basic check)
    const contrastIssues = await page.evaluate(() => {
      const issues: Array<{ selector: string; element: string; text: string }> = []
      const textElements = document.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6, a, button, label')
      
      textElements.forEach((el) => {
        const style = window.getComputedStyle(el)
        const color = style.color
        const bgColor = style.backgroundColor
        
        // Basic check - if text color and background are too similar, flag it
        // This is a simplified check - real contrast checking would use WCAG formulas
        if (color === bgColor || (color.includes('rgb') && bgColor.includes('rgb') && color === bgColor)) {
          let selector = ''
          if (el.id) selector = `#${el.id}`
          else if (el.className) selector = `.${el.className.split(' ')[0]}`
          else selector = el.tagName.toLowerCase()
          
          issues.push({
            selector,
            element: el.tagName.toLowerCase(),
            text: el.textContent?.substring(0, 50) || '',
          })
        }
      })
      
      return issues
    })

    contrastIssues.forEach((item) => {
      issues.push({
        id: `contrast-${Date.now()}-${Math.random()}`,
        type: 'warning',
        message: `Possible contrast issue: text color may be too similar to background`,
        element: item.element,
        selector: item.selector,
        impact: 'moderate',
        fix: `Ensure text color has sufficient contrast with background for ${item.selector}`,
      })
    })

    // Check for keyboard navigation issues (elements that should be focusable but aren't)
    const keyboardIssues = await page.evaluate(() => {
      const issues: Array<{ selector: string; element: string }> = []
      const interactiveElements = document.querySelectorAll('button, a, input, select, textarea, [role="button"], [role="link"]')
      
      interactiveElements.forEach((el) => {
        const tabIndex = el.getAttribute('tabindex')
        if (tabIndex === '-1') {
          let selector = ''
          if (el.id) selector = `#${el.id}`
          else if (el.className) selector = `.${el.className.split(' ')[0]}`
          else selector = el.tagName.toLowerCase()
          
          issues.push({
            selector,
            element: el.tagName.toLowerCase(),
          })
        }
      })
      
      return issues
    })

    keyboardIssues.forEach((item) => {
      issues.push({
        id: `keyboard-${Date.now()}-${Math.random()}`,
        type: 'warning',
        message: `Element may not be keyboard accessible (tabindex="-1")`,
        element: item.element,
        selector: item.selector,
        impact: 'serious',
        fix: `Remove tabindex="-1" or ensure element is accessible via keyboard for ${item.selector}`,
      })
    })

    this.accessibilityIssues = issues
    return issues
  }

  /**
   * Analyze DOM health
   */
  async analyzeDOMHealth(page: Page): Promise<DOMHealth> {
    const health = await page.evaluate(() => {
      const brokenLinks: Array<{ url: string; selector: string; status: number }> = []
      const missingAltText: Array<{ selector: string; element: string }> = []
      const missingLabels: Array<{ selector: string; element: string }> = []
      const orphanedElements: Array<{ selector: string; element: string }> = []
      const hiddenElements: Array<{ selector: string; element: string; reason: string }> = []

      // Check for missing alt text on images
      const images = document.querySelectorAll('img')
      images.forEach((img) => {
        if (!img.alt && !img.hasAttribute('aria-label')) {
          let selector = ''
          if (img.id) selector = `#${img.id}`
          else if (img.className) selector = `.${img.className.split(' ')[0]}`
          else selector = 'img'
          
          missingAltText.push({
            selector,
            element: 'img',
          })
        }
      })

      // Check for missing labels on form inputs
      const inputs = document.querySelectorAll('input, select, textarea')
      inputs.forEach((input) => {
        const id = input.id
        const name = (input as HTMLInputElement).name
        const hasLabel = id && document.querySelector(`label[for="${id}"]`)
        const hasAriaLabel = input.hasAttribute('aria-label') || input.hasAttribute('aria-labelledby')
        const hasPlaceholder = (input as HTMLInputElement).placeholder
        
        if (!hasLabel && !hasAriaLabel && !hasPlaceholder) {
          let selector = ''
          if (id) selector = `#${id}`
          else if (name) selector = `[name="${name}"]`
          else selector = input.tagName.toLowerCase()
          
          missingLabels.push({
            selector,
            element: input.tagName.toLowerCase(),
          })
        }
      })

      // Check for hidden elements
      const allElements = document.querySelectorAll('*')
      allElements.forEach((el) => {
        const style = window.getComputedStyle(el)
        const rect = el.getBoundingClientRect()
        
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0' || rect.width === 0 || rect.height === 0) {
          let selector = ''
          if (el.id) selector = `#${el.id}`
          else if (el.className) selector = `.${el.className.split(' ')[0]}`
          else selector = el.tagName.toLowerCase()
          
          let reason = ''
          if (style.display === 'none') reason = 'display: none'
          else if (style.visibility === 'hidden') reason = 'visibility: hidden'
          else if (style.opacity === '0') reason = 'opacity: 0'
          else if (rect.width === 0 || rect.height === 0) reason = 'zero dimensions'
          
          hiddenElements.push({
            selector,
            element: el.tagName.toLowerCase(),
            reason,
          })
        }
      })

      return {
        brokenLinks,
        missingAltText,
        missingLabels,
        orphanedElements,
        hiddenElements,
      }
    })

    const domHealth: DOMHealth = {
      ...health,
      jsErrors: this.consoleErrors.filter(e => e.type === 'error'),
    }

    this.domHealthData = domHealth
    return domHealth
  }

  /**
   * Check for broken links
   */
  async checkBrokenLinks(page: Page): Promise<Array<{ url: string; selector: string; status: number }>> {
    const links = await page.evaluate(() => {
      const linkData: Array<{ url: string; selector: string }> = []
      const anchorTags = document.querySelectorAll('a[href]')
      
      anchorTags.forEach((link) => {
        const href = (link as HTMLAnchorElement).href
        if (href && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
          let selector = ''
          if (link.id) selector = `#${link.id}`
          else if (link.className) selector = `.${link.className.split(' ')[0]}`
          else selector = `a[href="${href}"]`
          
          linkData.push({
            url: href,
            selector,
          })
        }
      })
      
      return linkData
    })

    // Check each link (sample first 10 to avoid timeout)
    const brokenLinks: Array<{ url: string; selector: string; status: number }> = []
    for (const link of links.slice(0, 10)) {
      try {
        const response = await page.goto(link.url, { waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => null)
        if (!response || response.status() >= 400) {
          brokenLinks.push({
            url: link.url,
            selector: link.selector,
            status: response?.status() || 0,
          })
        }
        // Navigate back
        await page.goBack().catch(() => {})
      } catch (error) {
        brokenLinks.push({
          url: link.url,
          selector: link.selector,
          status: 0,
        })
      }
    }

    return brokenLinks
  }

  /**
   * Detect visual issues (layout shifts, overlaps, etc.)
   */
  async detectVisualIssues(page: Page, previousScreenshot?: string): Promise<VisualIssue[]> {
    const issues: VisualIssue[] = []

    // Check for layout shifts using Layout Instability API
    const layoutShifts = await page.evaluate(() => {
      if ('PerformanceObserver' in window) {
        return new Promise<Array<{ value: number; sources: Array<{ node: string }> }>>((resolve) => {
          const shifts: Array<{ value: number; sources: Array<{ node: string }> }> = []
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.entryType === 'layout-shift' && !(entry as any).hadRecentInput) {
                shifts.push({
                  value: (entry as any).value,
                  sources: (entry as any).sources.map((s: any) => ({
                    node: s.node?.tagName || 'unknown',
                  })),
                })
              }
            }
          })
          
          try {
            observer.observe({ entryTypes: ['layout-shift'] })
            setTimeout(() => {
              observer.disconnect()
              resolve(shifts)
            }, 2000)
          } catch {
            resolve([])
          }
        })
      }
      return []
    })

    layoutShifts.forEach((shift) => {
      if (shift.value > 0.1) { // Threshold for significant layout shift
        issues.push({
          type: 'layout-shift',
          description: `Layout shift detected with value ${shift.value.toFixed(3)}`,
          severity: shift.value > 0.25 ? 'high' : 'medium',
        })
      }
    })

    // Check for text overflow
    const textOverflow = await page.evaluate(() => {
      const issues: Array<{ selector: string; element: string }> = []
      const elements = document.querySelectorAll('*')
      
      elements.forEach((el) => {
        const style = window.getComputedStyle(el)
        if (style.overflow === 'hidden' && style.textOverflow === 'ellipsis') {
          const rect = el.getBoundingClientRect()
          const scrollWidth = el.scrollWidth
          const clientWidth = el.clientWidth
          
          if (scrollWidth > clientWidth) {
            let selector = ''
            if (el.id) selector = `#${el.id}`
            else if (el.className) selector = `.${el.className.split(' ')[0]}`
            else selector = el.tagName.toLowerCase()
            
            issues.push({
              selector,
              element: el.tagName.toLowerCase(),
            })
          }
        }
      })
      
      return issues
    })

    textOverflow.forEach((item) => {
      issues.push({
        type: 'text-overflow',
        element: item.element,
        selector: item.selector,
        description: `Text overflow detected - content may be cut off`,
        severity: 'medium',
      })
    })

    this.visualIssues = issues
    return issues
  }

  /**
   * Get all comprehensive test results
   */
  getResults(): ComprehensiveTestResults {
    return {
      consoleErrors: this.consoleErrors,
      networkErrors: this.networkErrors,
      performance: this.performanceMetrics || {
        pageLoadTime: 0,
      },
      accessibility: this.accessibilityIssues,
      visualIssues: this.visualIssues,
      domHealth: this.domHealthData || {
        brokenLinks: [],
        missingAltText: [],
        missingLabels: [],
        orphanedElements: [],
        hiddenElements: [],
        jsErrors: [],
      },
      brokenLinks: this.domHealthData?.brokenLinks || [],
    }
  }

  /**
   * Reset all collected data
   */
  reset(): void {
    this.consoleErrors = []
    this.networkErrors = []
    this.performanceMetrics = null
    this.accessibilityIssues = []
    this.visualIssues = []
    this.domHealthData = null
  }
}

