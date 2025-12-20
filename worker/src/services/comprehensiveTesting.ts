/**
 * Comprehensive Testing Service
 * Implements all 9 feature categories for AI-powered frontend testing
 */

import { Page } from 'playwright'
import {
  ConsoleError,
  NetworkError,
  PerformanceMetrics,
  AccessibilityIssue,
  VisualIssue,
  DOMHealth,
  SecurityIssue,
  SEOIssue,
  ThirdPartyDependency,
  ComprehensiveTestResults,
  DesignSpec
} from '../types'
import type { VisionValidatorService } from './visionValidator'

export class ComprehensiveTestingService {
  private consoleErrors: ConsoleError[] = []
  private networkErrors: NetworkError[] = []
  private performanceMetrics: PerformanceMetrics | null = null
  private accessibilityIssues: AccessibilityIssue[] = []
  private visualIssues: VisualIssue[] = []
  private domHealthData: DOMHealth | null = null
  private designSpec: DesignSpec | null = null
  private visionValidator: VisionValidatorService | null = null
  private securityIssues: SecurityIssue[] = []
  private seoIssues: SEOIssue[] = []
  private thirdPartyDependencies: ThirdPartyDependency[] = []
  private wcagScore: { level: 'A' | 'AA' | 'AAA' | 'none'; score: number; passed: number; failed: number; warnings: number } | null = null

  /**
   * Initialize comprehensive testing on a page
   * @param designSpec - Optional design specification for visual consistency checks
   * @param visionValidator - Optional GPT-4V service for AI-powered visual checks
   */
  constructor(designSpec?: DesignSpec, visionValidator?: VisionValidatorService | null) {
    this.designSpec = designSpec || null
    this.visionValidator = visionValidator || null
  }

  /**
   * Update design specification (can be called after construction)
   */
  setDesignSpec(designSpec: DesignSpec | null): void {
    this.designSpec = designSpec
  }

  /**
   * Update vision validator (can be called after construction)
   */
  setVisionValidator(visionValidator: VisionValidatorService | null): void {
    this.visionValidator = visionValidator
  }

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
   * Collect performance metrics including Core Web Vitals
   */
  async collectPerformanceMetrics(page: Page): Promise<PerformanceMetrics> {
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      const paint = performance.getEntriesByType('paint')
      const fcp = paint.find((entry) => entry.name === 'first-contentful-paint')

      // Calculate resource sizes and identify slow resources
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
      let totalSize = 0
      let jsSize = 0
      let cssSize = 0
      let imageSize = 0
      const slowResources: Array<{ url: string; loadTime: number; size: number; type: string }> = []
      const scriptUrls = new Set<string>()

      resources.forEach((resource) => {
        const size = resource.transferSize || 0
        const loadTime = resource.responseEnd - resource.requestStart
        totalSize += size

        if (resource.name.includes('.js')) {
          jsSize += size
          scriptUrls.add(resource.name)
        } else if (resource.name.includes('.css')) {
          cssSize += size
        } else if (resource.name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
          imageSize += size
        }

        // Flag slow resources (>1s load time or >500KB)
        if (loadTime > 1000 || size > 500000) {
          slowResources.push({
            url: resource.name,
            loadTime: Math.round(loadTime),
            size: size,
            type: resource.initiatorType || 'unknown'
          })
        }
      })

      // Detect duplicate scripts (same filename, different paths)
      const scriptNames = Array.from(scriptUrls).map(url => {
        const match = url.match(/\/([^\/]+\.js)/)
        return match ? match[1] : null
      }).filter(Boolean) as string[]
      const duplicateScripts = scriptNames.filter((name, index) => scriptNames.indexOf(name) !== index)

      // Core Web Vitals
      let lcp: number | undefined
      let fid: number | undefined
      let cls: number | undefined
      let tti: number | undefined
      let tbt: number | undefined

      // Largest Contentful Paint
      const lcpEntries = performance.getEntriesByType('largest-contentful-paint')
      if (lcpEntries.length > 0) {
        lcp = (lcpEntries[lcpEntries.length - 1] as any).renderTime || (lcpEntries[lcpEntries.length - 1] as any).loadTime
      }

      // First Input Delay (simplified - would need user interaction)
      const fidEntries = performance.getEntriesByType('first-input')
      if (fidEntries.length > 0) {
        fid = (fidEntries[0] as any).processingStart - (fidEntries[0] as any).startTime
      }

      // Cumulative Layout Shift
      let clsValue = 0
      const clsEntries = performance.getEntriesByType('layout-shift')
      clsEntries.forEach((entry: any) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value
        }
      })
      cls = clsValue

      // Time to Interactive (simplified calculation)
      tti = navigation.domInteractive - navigation.fetchStart

      // Total Blocking Time (simplified - sum of long tasks)
      const longTasks = performance.getEntriesByType('longtask')
      tbt = longTasks.reduce((sum, task: any) => {
        return sum + (task.duration > 50 ? task.duration - 50 : 0)
      }, 0)

      return {
        pageLoadTime: navigation.loadEventEnd - navigation.fetchStart,
        firstContentfulPaint: fcp ? fcp.startTime : undefined,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
        totalPageSize: totalSize,
        jsBundleSize: jsSize,
        cssSize: cssSize,
        imageSize: imageSize,
        largestContentfulPaint: lcp,
        firstInputDelay: fid,
        cumulativeLayoutShift: cls,
        timeToInteractive: tti,
        totalBlockingTime: tbt,
        slowResources: slowResources.slice(0, 10), // Top 10 slow resources
        duplicateScripts: Array.from(new Set(duplicateScripts))
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
          else if (el.className) {
            // Handle SVG elements (className can be SVGAnimatedString) and null cases
            const className = typeof el.className === 'string' ? el.className : ((el.className as any)?.baseVal || '')
            if (className && typeof className === 'string') {
              selector = `.${className.split(' ')[0]}`
            } else {
              selector = el.tagName.toLowerCase()
            }
          } else selector = el.tagName.toLowerCase()

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

    // Check for contrast issues with WCAG-compliant calculation
    const contrastIssues = await page.evaluate(() => {
      // Helper function to convert RGB to relative luminance
      const getLuminance = (r: number, g: number, b: number): number => {
        const [rs, gs, bs] = [r, g, b].map(val => {
          val = val / 255
          return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4)
        })
        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
      }

      // Helper function to parse color string to RGB
      const parseColor = (colorStr: string): [number, number, number] | null => {
        // Handle rgb/rgba
        const rgbMatch = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
        if (rgbMatch) {
          return [parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3])]
        }
        // Handle hex
        const hexMatch = colorStr.match(/#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i)
        if (hexMatch) {
          return [parseInt(hexMatch[1], 16), parseInt(hexMatch[2], 16), parseInt(hexMatch[3], 16)]
        }
        return null
      }

      // Calculate contrast ratio
      const getContrastRatio = (lum1: number, lum2: number): number => {
        const lighter = Math.max(lum1, lum2)
        const darker = Math.min(lum1, lum2)
        return (lighter + 0.05) / (darker + 0.05)
      }

      const issues: Array<{
        selector: string
        element: string
        text: string
        contrastRatio: number
        wcagLevel: 'AA' | 'AAA' | 'fail'
      }> = []
      const textElements = document.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6, a, button, label, input, textarea')

      textElements.forEach((el) => {
        const text = el.textContent?.trim()
        if (!text || text.length === 0) return

        const style = window.getComputedStyle(el)
        const colorStr = style.color
        let bgColorStr = style.backgroundColor

        // Get background color from parent if transparent
        if (bgColorStr === 'rgba(0, 0, 0, 0)' || bgColorStr === 'transparent') {
          let parent = el.parentElement
          while (parent && (bgColorStr === 'rgba(0, 0, 0, 0)' || bgColorStr === 'transparent')) {
            const parentStyle = window.getComputedStyle(parent)
            bgColorStr = parentStyle.backgroundColor
            parent = parent.parentElement
          }
        }

        const fgColor = parseColor(colorStr)
        const bgColor = parseColor(bgColorStr)

        if (fgColor && bgColor) {
          const fgLum = getLuminance(fgColor[0], fgColor[1], fgColor[2])
          const bgLum = getLuminance(bgColor[0], bgColor[1], bgColor[2])
          const contrastRatio = getContrastRatio(fgLum, bgLum)

          // WCAG AA: 4.5:1 for normal text, 3:1 for large text
          // WCAG AAA: 7:1 for normal text, 4.5:1 for large text
          const fontSize = parseFloat(style.fontSize)
          const isLargeText = fontSize >= 18 || (fontSize >= 14 && (style.fontWeight === 'bold' || parseInt(style.fontWeight) >= 700))
          const minRatio = isLargeText ? 3 : 4.5

          let wcagLevel: 'AA' | 'AAA' | 'fail' = 'fail'
          if (contrastRatio >= 7) wcagLevel = 'AAA'
          else if (contrastRatio >= minRatio) wcagLevel = 'AA'

          if (contrastRatio < minRatio) {
            let selector = ''
            if (el.id) selector = `#${el.id}`
            else if (el.className) {
              const className = typeof el.className === 'string' ? el.className : ((el.className as any)?.baseVal || '')
              if (className && typeof className === 'string') {
                selector = `.${className.split(' ')[0]}`
              } else {
                selector = el.tagName.toLowerCase()
              }
            } else selector = el.tagName.toLowerCase()

            issues.push({
              selector,
              element: el.tagName.toLowerCase(),
              text: text.substring(0, 50),
              contrastRatio: Math.round(contrastRatio * 100) / 100,
              wcagLevel
            })
          }
        }
      })

      return issues
    })

    contrastIssues.forEach((item) => {
      const isCritical = item.contrastRatio < 3
      issues.push({
        id: `contrast-${Date.now()}-${Math.random()}`,
        type: isCritical ? 'error' : 'warning',
        message: `WCAG ${item.wcagLevel === 'fail' ? 'FAIL' : item.wcagLevel} contrast violation: ratio ${item.contrastRatio}:1 (minimum required: ${item.wcagLevel === 'AAA' ? '7:1' : '4.5:1'})`,
        element: item.element,
        selector: item.selector,
        impact: isCritical ? 'serious' : 'moderate',
        fix: `Increase contrast ratio to at least 4.5:1 (AA) or 7:1 (AAA) for ${item.selector}. Current ratio: ${item.contrastRatio}:1`,
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
          else if (el.className) {
            // Handle SVG elements (className can be SVGAnimatedString) and null cases
            const className = typeof el.className === 'string' ? el.className : ((el.className as any)?.baseVal || '')
            if (className && typeof className === 'string') {
              selector = `.${className.split(' ')[0]}`
            } else {
              selector = el.tagName.toLowerCase()
            }
          } else selector = el.tagName.toLowerCase()

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

    // Calculate WCAG compliance score
    const totalChecks = issues.length + (missingAriaLabels.length > 0 ? 1 : 0) + (contrastIssues.length > 0 ? 1 : 0) + (keyboardIssues.length > 0 ? 1 : 0)
    const criticalIssues = issues.filter(i => i.impact === 'critical' || i.impact === 'serious').length
    const warnings = issues.filter(i => i.type === 'warning').length
    const passed = totalChecks - criticalIssues - warnings

    let wcagLevel: 'A' | 'AA' | 'AAA' | 'none' = 'none'
    if (criticalIssues === 0 && warnings < totalChecks * 0.1) {
      wcagLevel = 'AAA'
    } else if (criticalIssues === 0 && warnings < totalChecks * 0.2) {
      wcagLevel = 'AA'
    } else if (criticalIssues < totalChecks * 0.1) {
      wcagLevel = 'A'
    }

    const score = totalChecks > 0 ? Math.round((passed / totalChecks) * 100) : 100
    this.wcagScore = {
      level: wcagLevel,
      score,
      passed,
      failed: criticalIssues,
      warnings
    }


    this.accessibilityIssues = issues
    return issues
  }

  /**
   * Analyze DOM health
   */
  async analyzeDOMHealth(page: Page): Promise<DOMHealth> {
    const health = await page.evaluate(() => {
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
          else if (img.className) {
            // Handle SVG elements (className can be SVGAnimatedString) and null cases
            const className = typeof img.className === 'string' ? img.className : ((img.className as any)?.baseVal || '')
            if (className && typeof className === 'string') {
              selector = `.${className.split(' ')[0]}`
            } else {
              selector = 'img'
            }
          } else selector = 'img'

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
          else if (el.className) {
            // Handle SVG elements (className can be SVGAnimatedString) and null cases
            const className = typeof el.className === 'string' ? el.className : ((el.className as any)?.baseVal || '')
            if (className && typeof className === 'string') {
              selector = `.${className.split(' ')[0]}`
            } else {
              selector = el.tagName.toLowerCase()
            }
          } else selector = el.tagName.toLowerCase()

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
   * Check layout and alignment issues
   * Programmatic checks - no AI needed
   */
  async checkLayoutAndAlignment(page: Page): Promise<VisualIssue[]> {
    const issues: VisualIssue[] = []

    // Helper function to get selector
    const getSelector = (el: Element): string => {
      if (el.id) return `#${el.id}`
      if (el.className) {
        const className = typeof el.className === 'string'
          ? el.className
          : ((el.className as any)?.baseVal || '')
        if (className && typeof className === 'string') {
          return `.${className.split(' ')[0]}`
        }
      }
      return el.tagName.toLowerCase()
    }

    // Check element alignment
    const alignmentIssues = await page.evaluate(() => {
      const issues: Array<{
        selector: string
        element: string
        issue: string
        expected: string
        actual: string
      }> = []

      // Check text alignment consistency in containers
      const containers = document.querySelectorAll('div, section, article, main, header, footer')
      containers.forEach((container) => {
        const textElements = container.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, a')
        if (textElements.length === 0) return

        const alignments = new Set<string>()
        textElements.forEach((el) => {
          const style = window.getComputedStyle(el)
          const textAlign = style.textAlign || 'left'
          alignments.add(textAlign)
        })

        // If multiple alignments in same container, flag inconsistency
        if (alignments.size > 1) {
          let selector = ''
          if (container.id) selector = `#${container.id}`
          else if (container.className) {
            const className = typeof container.className === 'string'
              ? container.className
              : ((container.className as any)?.baseVal || '')
            if (className && typeof className === 'string') {
              selector = `.${className.split(' ')[0]}`
            } else {
              selector = container.tagName.toLowerCase()
            }
          } else selector = container.tagName.toLowerCase()

          issues.push({
            selector,
            element: container.tagName.toLowerCase(),
            issue: 'mixed-alignment',
            expected: 'Consistent text alignment',
            actual: `Mixed alignments: ${Array.from(alignments).join(', ')}`
          })
        }
      })

      return issues
    })

    alignmentIssues.forEach((item) => {
      issues.push({
        type: 'alignment-issue',
        element: item.element,
        selector: item.selector,
        description: `Inconsistent text alignment in ${item.selector}: ${item.actual}`,
        severity: 'medium',
        expectedValue: item.expected,
        actualValue: item.actual,
        recommendation: `Ensure all text elements in ${item.selector} use consistent alignment`
      })
    })

    // Check for overlapping elements
    const overlapIssues = await page.evaluate(() => {
      const issues: Array<{
        selector1: string
        selector2: string
        element1: string
        element2: string
      }> = []

      const allElements = Array.from(document.querySelectorAll('*'))
        .filter(el => {
          const style = window.getComputedStyle(el)
          const rect = el.getBoundingClientRect()
          return style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            rect.width > 0 &&
            rect.height > 0
        })

      for (let i = 0; i < allElements.length; i++) {
        for (let j = i + 1; j < allElements.length; j++) {
          const el1 = allElements[i]
          const el2 = allElements[j]

          // Skip if one is a child of the other
          if (el1.contains(el2) || el2.contains(el1)) continue

          const rect1 = el1.getBoundingClientRect()
          const rect2 = el2.getBoundingClientRect()

          // Check for overlap
          const overlaps = !(
            rect1.right < rect2.left ||
            rect1.left > rect2.right ||
            rect1.bottom < rect2.top ||
            rect1.top > rect2.bottom
          )

          if (overlaps) {
            const getSelector = (el: Element): string => {
              if (el.id) return `#${el.id}`
              if (el.className) {
                const className = typeof el.className === 'string'
                  ? el.className
                  : ((el.className as any)?.baseVal || '')
                if (className && typeof className === 'string') {
                  return `.${className.split(' ')[0]}`
                }
              }
              return el.tagName.toLowerCase()
            }

            issues.push({
              selector1: getSelector(el1),
              selector2: getSelector(el2),
              element1: el1.tagName.toLowerCase(),
              element2: el2.tagName.toLowerCase()
            })
          }
        }
      }

      return issues
    })

    overlapIssues.forEach((item) => {
      issues.push({
        type: 'element-overlap',
        element: `${item.element1} and ${item.element2}`,
        selector: `${item.selector1} and ${item.selector2}`,
        description: `Elements overlap: ${item.selector1} overlaps with ${item.selector2}`,
        severity: 'high',
        recommendation: `Adjust positioning or z-index to prevent overlap between ${item.selector1} and ${item.selector2}`
      })
    })

    // Check spacing consistency
    if (this.designSpec?.minSpacing) {
      const spacingIssues = await page.evaluate((minSpacing) => {
        const issues: Array<{
          selector: string
          element: string
          spacing: number
        }> = []

        const containers = document.querySelectorAll('div, section, article, main')
        containers.forEach((container) => {
          const children = Array.from(container.children)
            .filter(child => {
              const style = window.getComputedStyle(child)
              return style.display !== 'none' && style.visibility !== 'hidden'
            })

          for (let i = 0; i < children.length - 1; i++) {
            const rect1 = children[i].getBoundingClientRect()
            const rect2 = children[i + 1].getBoundingClientRect()

            // Calculate vertical spacing
            const spacing = Math.abs(rect2.top - rect1.bottom)

            if (spacing > 0 && spacing < minSpacing) {
              const getSelector = (el: Element): string => {
                if (el.id) return `#${el.id}`
                if (el.className) {
                  const className = typeof el.className === 'string'
                    ? el.className
                    : ((el.className as any)?.baseVal || '')
                  if (className && typeof className === 'string') {
                    return `.${className.split(' ')[0]}`
                  }
                }
                return el.tagName.toLowerCase()
              }

              issues.push({
                selector: getSelector(children[i]),
                element: children[i].tagName.toLowerCase(),
                spacing
              })
            }
          }
        })

        return issues
      }, this.designSpec.minSpacing)

      spacingIssues.forEach((item) => {
        issues.push({
          type: 'spacing-inconsistent',
          element: item.element,
          selector: item.selector,
          description: `Spacing between elements (${item.spacing}px) is less than minimum required (${this.designSpec!.minSpacing}px)`,
          severity: 'medium',
          expectedValue: `Minimum ${this.designSpec!.minSpacing}px`,
          actualValue: `${item.spacing}px`,
          recommendation: `Increase spacing to meet minimum design requirement of ${this.designSpec!.minSpacing}px`
        })
      })
    }

    // Check for broken images
    const brokenImages = await page.evaluate(() => {
      const issues: Array<{
        selector: string
        src: string
      }> = []

      const images = document.querySelectorAll('img')
      images.forEach((img) => {
        // Check if image failed to load
        if (!img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) {
          let selector = ''
          if (img.id) selector = `#${img.id}`
          else if (img.className) {
            const className = typeof img.className === 'string'
              ? img.className
              : ((img.className as any)?.baseVal || '')
            if (className && typeof className === 'string') {
              selector = `.${className.split(' ')[0]}`
            } else {
              selector = 'img'
            }
          } else selector = 'img'

          issues.push({
            selector,
            src: img.src || img.getAttribute('src') || 'unknown'
          })
        }
      })

      return issues
    })

    brokenImages.forEach((item) => {
      issues.push({
        type: 'broken-image',
        element: 'img',
        selector: item.selector,
        description: `Broken image detected: ${item.src}`,
        severity: 'high',
        recommendation: `Fix image source or add error handling for ${item.selector}`
      })
    })

    return issues
  }

  /**
   * Check visual consistency (colors, typography, hover/focus states)
   * Hybrid: Programmatic extraction + optional GPT-4V validation
   */
  async checkVisualConsistency(
    page: Page,
    screenshotBase64?: string
  ): Promise<VisualIssue[]> {
    const issues: VisualIssue[] = []

    // Helper function to convert RGB to hex
    const rgbToHex = (rgb: string): string => {
      if (rgb.startsWith('#')) return rgb.toUpperCase()
      const match = rgb.match(/\d+/g)
      if (match && match.length >= 3) {
        const r = parseInt(match[0])
        const g = parseInt(match[1])
        const b = parseInt(match[2])
        return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase()}`
      }
      return rgb
    }

    // Extract and validate colors
    if (this.designSpec) {
      const colorIssues = await page.evaluate((spec) => {
        const issues: Array<{
          selector: string
          element: string
          property: string
          expected: string
          actual: string
        }> = []

        // Helper to convert RGB to hex
        const rgbToHex = (rgb: string): string => {
          if (rgb.startsWith('#')) return rgb.toUpperCase()
          const match = rgb.match(/\d+/g)
          if (match && match.length >= 3) {
            const r = parseInt(match[0])
            const g = parseInt(match[1])
            const b = parseInt(match[2])
            return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase()}`
          }
          return rgb
        }

        // Check button colors
        const buttons = document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]')
        buttons.forEach((btn) => {
          const style = window.getComputedStyle(btn)
          const bgColor = style.backgroundColor
          const textColor = style.color

          const btnBgHex = rgbToHex(bgColor)
          const btnTextHex = rgbToHex(textColor)

          // Check against design spec
          if (spec.primaryColor && btnBgHex === rgbToHex(spec.primaryColor)) {
            // Primary button - check text color
            if (spec.textColor && btnTextHex !== rgbToHex(spec.textColor)) {
              const getSelector = (el: Element): string => {
                if (el.id) return `#${el.id}`
                if (el.className) {
                  const className = typeof el.className === 'string'
                    ? el.className
                    : ((el.className as any)?.baseVal || '')
                  if (className && typeof className === 'string') {
                    return `.${className.split(' ')[0]}`
                  }
                }
                return el.tagName.toLowerCase()
              }

              issues.push({
                selector: getSelector(btn),
                element: btn.tagName.toLowerCase(),
                property: 'color',
                expected: spec.textColor,
                actual: textColor
              })
            }
          }

          // Check component-specific specs
          if (spec.componentSpecs?.buttons?.primaryColor) {
            if (btnBgHex !== rgbToHex(spec.componentSpecs.buttons.primaryColor)) {
              const getSelector = (el: Element): string => {
                if (el.id) return `#${el.id}`
                if (el.className) {
                  const className = typeof el.className === 'string'
                    ? el.className
                    : ((el.className as any)?.baseVal || '')
                  if (className && typeof className === 'string') {
                    return `.${className.split(' ')[0]}`
                  }
                }
                return el.tagName.toLowerCase()
              }

              issues.push({
                selector: getSelector(btn),
                element: btn.tagName.toLowerCase(),
                property: 'background-color',
                expected: spec.componentSpecs.buttons.primaryColor,
                actual: bgColor
              })
            }
          }
        })

        return issues
      }, this.designSpec)

      colorIssues.forEach((item) => {
        issues.push({
          type: 'color-inconsistent',
          element: item.element,
          selector: item.selector,
          description: `${item.property} on ${item.selector} doesn't match design spec`,
          severity: 'high',
          expectedValue: item.expected,
          actualValue: item.actual,
          recommendation: `Update ${item.property} to match design specification: ${item.expected}`
        })
      })
    }

    // Check typography consistency
    if (this.designSpec) {
      const typographyIssues = await page.evaluate((spec) => {
        const issues: Array<{
          selector: string
          element: string
          property: string
          expected: string
          actual: string
        }> = []

        // Check headings
        const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6')
        headings.forEach((heading) => {
          const style = window.getComputedStyle(heading)
          const fontFamily = style.fontFamily
          const fontSize = style.fontSize

          if (spec.headingFontFamily && !fontFamily.includes(spec.headingFontFamily.split(',')[0].trim())) {
            const getSelector = (el: Element): string => {
              if (el.id) return `#${el.id}`
              if (el.className) {
                const className = typeof el.className === 'string'
                  ? el.className
                  : ((el.className as any)?.baseVal || '')
                if (className && typeof className === 'string') {
                  return `.${className.split(' ')[0]}`
                }
              }
              return el.tagName.toLowerCase()
            }

            issues.push({
              selector: getSelector(heading),
              element: heading.tagName.toLowerCase(),
              property: 'font-family',
              expected: spec.headingFontFamily,
              actual: fontFamily
            })
          }

          if (spec.headingFontSize && fontSize !== spec.headingFontSize) {
            const getSelector = (el: Element): string => {
              if (el.id) return `#${el.id}`
              if (el.className) {
                const className = typeof el.className === 'string'
                  ? el.className
                  : ((el.className as any)?.baseVal || '')
                if (className && typeof className === 'string') {
                  return `.${className.split(' ')[0]}`
                }
              }
              return el.tagName.toLowerCase()
            }

            issues.push({
              selector: getSelector(heading),
              element: heading.tagName.toLowerCase(),
              property: 'font-size',
              expected: spec.headingFontSize,
              actual: fontSize
            })
          }
        })

        // Check body text
        const bodyText = document.querySelectorAll('p, span, div, li')
        bodyText.forEach((el) => {
          const style = window.getComputedStyle(el)
          const fontFamily = style.fontFamily

          if (spec.primaryFontFamily && !fontFamily.includes(spec.primaryFontFamily.split(',')[0].trim())) {
            const getSelector = (el: Element): string => {
              if (el.id) return `#${el.id}`
              if (el.className) {
                const className = typeof el.className === 'string'
                  ? el.className
                  : ((el.className as any)?.baseVal || '')
                if (className && typeof className === 'string') {
                  return `.${className.split(' ')[0]}`
                }
              }
              return el.tagName.toLowerCase()
            }

            issues.push({
              selector: getSelector(el),
              element: el.tagName.toLowerCase(),
              property: 'font-family',
              expected: spec.primaryFontFamily,
              actual: fontFamily
            })
          }
        })

        return issues
      }, this.designSpec)

      typographyIssues.forEach((item) => {
        issues.push({
          type: 'typography-inconsistent',
          element: item.element,
          selector: item.selector,
          description: `${item.property} on ${item.selector} doesn't match design spec`,
          severity: 'medium',
          expectedValue: item.expected,
          actualValue: item.actual,
          recommendation: `Update ${item.property} to match design specification: ${item.expected}`
        })
      })
    }

    // Check hover states
    const hoverIssues = await page.evaluate(() => {
      const issues: Array<{
        selector: string
        element: string
      }> = []

      const interactiveElements = document.querySelectorAll('button, a, [role="button"], [role="link"]')
      interactiveElements.forEach((el) => {
        const style = window.getComputedStyle(el)
        const cursor = style.cursor

        // Check if element has hover styling (cursor change is a basic indicator)
        if (cursor === 'default' && el.tagName !== 'A') {
          const getSelector = (el: Element): string => {
            if (el.id) return `#${el.id}`
            if (el.className) {
              const className = typeof el.className === 'string'
                ? el.className
                : ((el.className as any)?.baseVal || '')
              if (className && typeof className === 'string') {
                return `.${className.split(' ')[0]}`
              }
            }
            return el.tagName.toLowerCase()
          }

          issues.push({
            selector: getSelector(el),
            element: el.tagName.toLowerCase()
          })
        }
      })

      return issues
    })

    // Simulate hover to check for visual changes
    for (const item of hoverIssues) {
      try {
        const beforeStyle = await page.evaluate((selector) => {
          const el = document.querySelector(selector)
          if (!el) return null
          const style = window.getComputedStyle(el)
          return {
            backgroundColor: style.backgroundColor,
            color: style.color,
            borderColor: style.borderColor,
            opacity: style.opacity
          }
        }, item.selector)

        await page.hover(item.selector).catch(() => { })
        await page.waitForTimeout(100) // Wait for hover transition

        const afterStyle = await page.evaluate((selector) => {
          const el = document.querySelector(selector)
          if (!el) return null
          const style = window.getComputedStyle(el)
          return {
            backgroundColor: style.backgroundColor,
            color: style.color,
            borderColor: style.borderColor,
            opacity: style.opacity
          }
        }, item.selector)

        if (beforeStyle && afterStyle) {
          const hasChange =
            beforeStyle.backgroundColor !== afterStyle.backgroundColor ||
            beforeStyle.color !== afterStyle.color ||
            beforeStyle.borderColor !== afterStyle.borderColor ||
            beforeStyle.opacity !== afterStyle.opacity

          if (!hasChange) {
            issues.push({
              type: 'missing-hover-state',
              element: item.element,
              selector: item.selector,
              description: `No visual feedback on hover for ${item.selector}`,
              severity: 'low',
              recommendation: `Add hover state styling (color, background, border, or opacity change) to ${item.selector}`
            })
          }
        }
      } catch (error) {
        // Element might not be hoverable, skip
      }
    }

    // Check focus states
    const focusIssues = await page.evaluate(() => {
      const issues: Array<{
        selector: string
        element: string
      }> = []

      const focusableElements = document.querySelectorAll(
        'button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )

      focusableElements.forEach((el) => {
        const getSelector = (el: Element): string => {
          if (el.id) return `#${el.id}`
          if (el.className) {
            const className = typeof el.className === 'string'
              ? el.className
              : ((el.className as any)?.baseVal || '')
            if (className && typeof className === 'string') {
              return `.${className.split(' ')[0]}`
            }
          }
          return el.tagName.toLowerCase()
        }

        issues.push({
          selector: getSelector(el),
          element: el.tagName.toLowerCase()
        })
      })

      return issues
    })

    // Simulate focus to check for visual changes
    for (const item of focusIssues) {
      try {
        const beforeStyle = await page.evaluate((selector) => {
          const el = document.querySelector(selector)
          if (!el) return null
          const style = window.getComputedStyle(el)
          return {
            outline: style.outline,
            borderColor: style.borderColor,
            boxShadow: style.boxShadow
          }
        }, item.selector)

        await page.focus(item.selector).catch(() => { })
        await page.waitForTimeout(100)

        const afterStyle = await page.evaluate((selector) => {
          const el = document.querySelector(selector)
          if (!el) return null
          const style = window.getComputedStyle(el)
          return {
            outline: style.outline,
            borderColor: style.borderColor,
            boxShadow: style.boxShadow
          }
        }, item.selector)

        if (beforeStyle && afterStyle) {
          const hasChange =
            beforeStyle.outline !== afterStyle.outline ||
            beforeStyle.borderColor !== afterStyle.borderColor ||
            beforeStyle.boxShadow !== afterStyle.boxShadow

          if (!hasChange) {
            issues.push({
              type: 'missing-focus-state',
              element: item.element,
              selector: item.selector,
              description: `No visual feedback on focus for ${item.selector}`,
              severity: 'medium',
              recommendation: `Add focus state styling (outline, border, or box-shadow) to ${item.selector} for accessibility`
            })
          }
        }
      } catch (error) {
        // Element might not be focusable, skip
      }
    }

    // Optional: GPT-4V for design consistency validation
    if (screenshotBase64 && this.visionValidator) {
      try {
        const aiIssues = await this.visionValidator.analyzeScreenshot(screenshotBase64, {
          url: page.url(),
          goal: `Validate visual consistency against design spec. Check: color palette (primary: ${this.designSpec?.primaryColor || 'N/A'}), typography (font: ${this.designSpec?.primaryFontFamily || 'N/A'}), overall design coherence`
        })

        aiIssues.forEach((aiIssue) => {
          issues.push({
            type: 'color-inconsistent', // Default type, AI can identify various issues
            description: aiIssue.description,
            severity: aiIssue.severity,
            recommendation: aiIssue.suggestion
          })
        })
      } catch (error: any) {
        console.warn('Vision validator error during visual consistency check:', error.message)
      }
    }

    return issues
  }

  /**
   * Check error messages (placement and clarity)
   * Hybrid: Programmatic detection + optional GPT-4V for clarity
   */
  async checkErrorMessages(
    page: Page,
    screenshotBase64?: string
  ): Promise<VisualIssue[]> {
    const issues: VisualIssue[] = []

    // Detect error messages programmatically
    const errorMessages = await page.evaluate(() => {
      const errors: Array<{
        selector: string
        text: string
        fieldSelector?: string
        placement: 'near-field' | 'distant' | 'unknown'
      }> = []

      // Find error messages via common patterns
      const errorSelectors = [
        '[aria-invalid="true"]',
        '.error',
        '.invalid',
        '[class*="error"]',
        '[class*="invalid"]',
        '[id*="error"]',
        '[role="alert"]',
        '[aria-live="polite"]',
        '[aria-live="assertive"]'
      ]

      errorSelectors.forEach((selector) => {
        const elements = document.querySelectorAll(selector)
        elements.forEach((el) => {
          const text = el.textContent?.trim() || ''
          if (text.length === 0) return

          // Try to find associated form field
          let fieldSelector: string | undefined
          let placement: 'near-field' | 'distant' | 'unknown' = 'unknown'

          // Check if error is inside a form field's parent
          const formField = el.closest('form')?.querySelector('input, select, textarea')
          if (formField) {
            const getSelector = (el: Element): string => {
              if (el.id) return `#${el.id}`
              if (el.className) {
                const className = typeof el.className === 'string'
                  ? el.className
                  : ((el.className as any)?.baseVal || '')
                if (className && typeof className === 'string') {
                  return `.${className.split(' ')[0]}`
                }
              }
              return el.tagName.toLowerCase()
            }
            fieldSelector = getSelector(formField)

            // Check proximity (error should be near field)
            const errorRect = el.getBoundingClientRect()
            const fieldRect = formField.getBoundingClientRect()
            const distance = Math.abs(errorRect.top - fieldRect.bottom)
            placement = distance < 50 ? 'near-field' : 'distant'
          }

          const getSelector = (el: Element): string => {
            if (el.id) return `#${el.id}`
            if (el.className) {
              const className = typeof el.className === 'string'
                ? el.className
                : ((el.className as any)?.baseVal || '')
              if (className && typeof className === 'string') {
                return `.${className.split(' ')[0]}`
              }
            }
            return el.tagName.toLowerCase()
          }

          errors.push({
            selector: getSelector(el),
            text,
            fieldSelector,
            placement
          })
        })
      })

      return errors
    })

    // Check error message placement
    errorMessages.forEach((error) => {
      if (error.placement === 'distant') {
        issues.push({
          type: 'error-message-placement',
          element: 'error-message',
          selector: error.selector,
          description: `Error message is too far from associated field (${error.fieldSelector || 'unknown'})`,
          severity: 'medium',
          expectedValue: 'Error message within 50px of field',
          actualValue: 'Error message placed far from field',
          recommendation: `Move error message closer to ${error.fieldSelector || 'the form field'} for better UX`
        })
      }
    })

    // Optional: GPT-4V for error message clarity/grammar
    if (screenshotBase64 && this.visionValidator && errorMessages.length > 0) {
      try {
        const errorTexts = errorMessages.map(e => e.text).join('\n')
        const aiIssues = await this.visionValidator.analyzeScreenshot(screenshotBase64, {
          url: page.url(),
          goal: `Analyze error messages for clarity and grammar. Error messages found: ${errorTexts}. Check if messages are user-friendly, grammatically correct, and provide actionable guidance.`
        })

        aiIssues.forEach((aiIssue) => {
          // Only add if it's related to error message clarity
          if (aiIssue.description.toLowerCase().includes('error') ||
            aiIssue.description.toLowerCase().includes('message') ||
            aiIssue.description.toLowerCase().includes('grammar') ||
            aiIssue.description.toLowerCase().includes('clarity')) {
            issues.push({
              type: 'error-message-clarity',
              description: aiIssue.description,
              severity: aiIssue.severity,
              recommendation: aiIssue.suggestion
            })
          }
        })
      } catch (error: any) {
        console.warn('Vision validator error during error message check:', error.message)
      }
    }

    return issues
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
            else if (el.className) {
              // Handle SVG elements (className can be SVGAnimatedString) and null cases
              const className = typeof el.className === 'string' ? el.className : ((el.className as any)?.baseVal || '')
              if (className && typeof className === 'string') {
                selector = `.${className.split(' ')[0]}`
              } else {
                selector = el.tagName.toLowerCase()
              }
            } else selector = el.tagName.toLowerCase()

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

    // NEW: Add layout and alignment checks
    const layoutIssues = await this.checkLayoutAndAlignment(page)
    issues.push(...layoutIssues)

    // NEW: Add visual consistency checks
    // Capture screenshot if not provided
    let screenshotBase64: string | undefined = previousScreenshot
    if (!screenshotBase64) {
      try {
        const buffer = await page.screenshot()
        screenshotBase64 = buffer.toString('base64')
      } catch (error) {
        console.warn('Failed to capture screenshot for visual consistency check:', error)
      }
    }
    const consistencyIssues = await this.checkVisualConsistency(page, screenshotBase64)
    issues.push(...consistencyIssues)

    // NEW: Add error message checks
    const errorIssues = await this.checkErrorMessages(page, screenshotBase64)
    issues.push(...errorIssues)

    this.visualIssues = issues
    return issues
  }

  /**
   * Check security issues
   */
  async checkSecurity(page: Page): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = []

    // Check for CSP (Content Security Policy)
    const cspHeader = await page.evaluate(() => {
      // Check meta tag CSP
      const metaCSP = document.querySelector('meta[http-equiv="Content-Security-Policy"]')
      return metaCSP ? (metaCSP as HTMLMetaElement).content : null
    })

    if (!cspHeader) {
      issues.push({
        type: 'csp',
        severity: 'medium',
        message: 'Missing Content Security Policy (CSP) header',
        fix: 'Add CSP header or meta tag to prevent XSS attacks'
      })
    }

    // Check for insecure resources (HTTP on HTTPS page)
    const insecureResources = await page.evaluate(() => {
      const issues: Array<{ url: string; type: string }> = []
      const currentProtocol = window.location.protocol

      if (currentProtocol === 'https:') {
        // Check all external resources
        const scripts = Array.from(document.querySelectorAll('script[src]'))
        const links = Array.from(document.querySelectorAll('link[href]'))
        const images = Array.from(document.querySelectorAll('img[src]'))
        const iframes = Array.from(document.querySelectorAll('iframe[src]'))

        const checkUrl = (url: string, type: string) => {
          if (url && url.startsWith('http://')) {
            issues.push({ url, type })
          }
        }

        scripts.forEach(s => checkUrl((s as HTMLScriptElement).src, 'script'))
        links.forEach(l => checkUrl((l as HTMLLinkElement).href, 'link'))
        images.forEach(i => checkUrl((i as HTMLImageElement).src, 'image'))
        iframes.forEach(i => checkUrl((i as HTMLIFrameElement).src, 'iframe'))
      }

      return issues
    })

    insecureResources.forEach(item => {
      issues.push({
        type: 'insecure-resource',
        severity: 'high',
        message: `Insecure HTTP resource loaded on HTTPS page: ${item.url}`,
        url: item.url,
        fix: `Change ${item.url} to use HTTPS protocol`
      })
    })

    // Check for potential XSS vectors (innerHTML usage with user input)
    const xssVectors = await page.evaluate(() => {
      const issues: Array<{ selector: string; element: string }> = []
      // This is a simplified check - real XSS detection would need runtime analysis
      const scripts = Array.from(document.querySelectorAll('script'))
      scripts.forEach(script => {
        const content = script.textContent || ''
        // Check for dangerous patterns (simplified)
        if (content.includes('innerHTML') && (content.includes('location') || content.includes('document.cookie'))) {
          let selector = ''
          if (script.id) selector = `#${script.id}`
          else if (script.className) {
            const className = typeof script.className === 'string' ? script.className : ''
            if (className) selector = `.${className.split(' ')[0]}`
          } else selector = 'script'
          issues.push({ selector, element: 'script' })
        }
      })
      return issues
    })

    xssVectors.forEach(item => {
      issues.push({
        type: 'xss',
        severity: 'high',
        message: `Potential XSS vulnerability detected in ${item.selector}`,
        element: item.element,
        selector: item.selector,
        fix: `Avoid using innerHTML with user input. Use textContent or proper sanitization.`
      })
    })

    // Check for CSRF tokens in forms
    const formsWithoutCSRF = await page.evaluate(() => {
      const issues: Array<{ selector: string }> = []
      const forms = Array.from(document.querySelectorAll('form[method="post"]'))
      forms.forEach(form => {
        const hasToken = form.querySelector('input[name*="csrf"], input[name*="token"], input[name*="_token"]')
        if (!hasToken) {
          let selector = ''
          if (form.id) selector = `#${form.id}`
          else if (form.className) {
            const className = typeof form.className === 'string' ? form.className : ''
            if (className) selector = `.${className.split(' ')[0]}`
          } else selector = 'form'
          issues.push({ selector })
        }
      })
      return issues
    })

    formsWithoutCSRF.forEach(item => {
      issues.push({
        type: 'csrf',
        severity: 'medium',
        message: `Form ${item.selector} may be vulnerable to CSRF attacks`,
        selector: item.selector,
        fix: `Add CSRF token to form ${item.selector}`
      })
    })

    this.securityIssues = issues
    return issues
  }

  /**
   * Check SEO issues
   */
  async checkSEO(page: Page): Promise<SEOIssue[]> {
    const issues: SEOIssue[] = []

    const seoData = await page.evaluate(() => {
      const data: {
        title?: string
        description?: string
        canonical?: string
        ogTitle?: string
        ogDescription?: string
        structuredData?: boolean
      } = {}

      // Check title
      data.title = document.title

      // Check meta description
      const metaDesc = document.querySelector('meta[name="description"]')
      data.description = metaDesc ? (metaDesc as HTMLMetaElement).content : undefined

      // Check canonical URL
      const canonical = document.querySelector('link[rel="canonical"]')
      data.canonical = canonical ? (canonical as HTMLLinkElement).href : undefined

      // Check Open Graph tags
      const ogTitle = document.querySelector('meta[property="og:title"]')
      data.ogTitle = ogTitle ? (ogTitle as HTMLMetaElement).content : undefined

      const ogDesc = document.querySelector('meta[property="og:description"]')
      data.ogDescription = ogDesc ? (ogDesc as HTMLMetaElement).content : undefined

      // Check for structured data
      const structuredData = document.querySelector('script[type="application/ld+json"]')
      data.structuredData = !!structuredData

      return data
    })

    // Check for missing title
    if (!seoData.title || seoData.title.trim().length === 0) {
      issues.push({
        type: 'missing-meta',
        severity: 'high',
        message: 'Missing page title',
        fix: 'Add a descriptive <title> tag'
      })
    } else if (seoData.title.length > 60) {
      issues.push({
        type: 'invalid-meta',
        severity: 'medium',
        message: `Title is too long (${seoData.title.length} characters, recommended: 50-60)`,
        fix: 'Shorten the title to 50-60 characters for better SEO'
      })
    }

    // Check for missing meta description
    if (!seoData.description || seoData.description.trim().length === 0) {
      issues.push({
        type: 'missing-meta',
        severity: 'high',
        message: 'Missing meta description',
        fix: 'Add a meta description tag: <meta name="description" content="...">'
      })
    } else if (seoData.description.length > 160) {
      issues.push({
        type: 'invalid-meta',
        severity: 'medium',
        message: `Meta description is too long (${seoData.description.length} characters, recommended: 150-160)`,
        fix: 'Shorten the meta description to 150-160 characters'
      })
    }

    // Check for missing canonical URL
    if (!seoData.canonical) {
      issues.push({
        type: 'missing-canonical',
        severity: 'medium',
        message: 'Missing canonical URL',
        fix: 'Add canonical link: <link rel="canonical" href="...">'
      })
    }

    // Check for missing structured data
    if (!seoData.structuredData) {
      issues.push({
        type: 'missing-structured-data',
        severity: 'low',
        message: 'No structured data (JSON-LD) found',
        fix: 'Add structured data using JSON-LD for better search engine understanding'
      })
    }

    this.seoIssues = issues
    return issues
  }

  /**
   * Analyze third-party dependencies
   */
  async analyzeThirdPartyDependencies(page: Page): Promise<ThirdPartyDependency[]> {
    const dependencies = await page.evaluate(() => {
      const deps = new Map<string, {
        scripts: string[]
        cookies: string[]
        type: 'analytics' | 'advertising' | 'cdn' | 'widget' | 'social' | 'payment' | 'unknown'
      }>()

      // Known third-party domains
      const domainTypes: Record<string, 'analytics' | 'advertising' | 'cdn' | 'widget' | 'social' | 'payment'> = {
        'google-analytics.com': 'analytics',
        'googletagmanager.com': 'analytics',
        'facebook.com': 'social',
        'twitter.com': 'social',
        'linkedin.com': 'social',
        'instagram.com': 'social',
        'youtube.com': 'social',
        'doubleclick.net': 'advertising',
        'amazon-adsystem.com': 'advertising',
        'cdnjs.cloudflare.com': 'cdn',
        'cdn.jsdelivr.net': 'cdn',
        'unpkg.com': 'cdn',
        'stripe.com': 'payment',
        'paypal.com': 'payment',
        'hotjar.com': 'analytics',
        'mixpanel.com': 'analytics',
        'segment.com': 'analytics',
        'amplitude.com': 'analytics',
      }

      // Extract domain from URL
      const getDomain = (url: string): string | null => {
        try {
          const urlObj = new URL(url.startsWith('//') ? `https:${url}` : url)
          return urlObj.hostname.replace('www.', '')
        } catch {
          return null
        }
      }

      // Check all scripts
      const scripts = Array.from(document.querySelectorAll('script[src]'))
      scripts.forEach(script => {
        const src = (script as HTMLScriptElement).src
        const domain = getDomain(src)
        if (domain && domain !== window.location.hostname.replace('www.', '')) {
          if (!deps.has(domain)) {
            deps.set(domain, {
              scripts: [],
              cookies: [],
              type: domainTypes[domain] || 'unknown'
            })
          }
          deps.get(domain)!.scripts.push(src)
        }
      })

      // Check all links (stylesheets, etc.)
      const links = Array.from(document.querySelectorAll('link[href]'))
      links.forEach(link => {
        const href = (link as HTMLLinkElement).href
        const domain = getDomain(href)
        if (domain && domain !== window.location.hostname.replace('www.', '')) {
          if (!deps.has(domain)) {
            deps.set(domain, {
              scripts: [],
              cookies: [],
              type: domainTypes[domain] || 'unknown'
            })
          }
        }
      })

      // Check iframes
      const iframes = Array.from(document.querySelectorAll('iframe[src]'))
      iframes.forEach(iframe => {
        const src = (iframe as HTMLIFrameElement).src
        const domain = getDomain(src)
        if (domain && domain !== window.location.hostname.replace('www.', '')) {
          if (!deps.has(domain)) {
            deps.set(domain, {
              scripts: [],
              cookies: [],
              type: domainTypes[domain] || 'unknown'
            })
          }
        }
      })

      return Array.from(deps.entries()).map(([domain, data]) => ({
        domain,
        ...data
      }))
    })

    const thirdPartyDeps: ThirdPartyDependency[] = dependencies.map(dep => {
      // Determine privacy risk
      let privacyRisk: 'high' | 'medium' | 'low' = 'low'
      if (dep.type === 'analytics' || dep.type === 'advertising') {
        privacyRisk = 'high'
      } else if (dep.type === 'social' || dep.type === 'payment') {
        privacyRisk = 'medium'
      }

      const descriptions: Record<string, string> = {
        analytics: 'Analytics and tracking service',
        advertising: 'Advertising and marketing service',
        cdn: 'Content delivery network',
        widget: 'Third-party widget or embed',
        social: 'Social media integration',
        payment: 'Payment processing service',
        unknown: 'Unknown third-party service'
      }

      return {
        domain: dep.domain,
        type: dep.type,
        scripts: dep.scripts,
        privacyRisk,
        description: descriptions[dep.type] || 'Third-party dependency'
      }
    })

    this.thirdPartyDependencies = thirdPartyDeps
    return thirdPartyDeps
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
        missingAltText: [],
        missingLabels: [],
        orphanedElements: [],
        hiddenElements: [],
        jsErrors: [],
      },
      security: this.securityIssues.length > 0 ? this.securityIssues : undefined,
      seo: this.seoIssues.length > 0 ? this.seoIssues : undefined,
      thirdPartyDependencies: this.thirdPartyDependencies.length > 0 ? this.thirdPartyDependencies : undefined,
      wcagScore: this.wcagScore || undefined,
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
    this.securityIssues = []
    this.seoIssues = []
    this.thirdPartyDependencies = []
    this.wcagScore = null
  }
}

