/**
 * Accessibility Diagnoser
 * 
 * Analyzes accessibility testability including:
 * - ARIA attributes
 * - Color contrast
 * - Keyboard navigation
 * - Performance (Core Web Vitals)
 */

import { Page } from 'playwright'
import { IDiagnoser, TestTypeDiagnosis, CapabilityItem } from './IDiagnoser'

export class AccessibilityDiagnoser implements IDiagnoser {
    readonly testType = 'accessibility'
    readonly steps = [
        'ARIA attribute audit',
        'Contrast ratio check',
        'Label/input association',
        'Keyboard navigation test',
        'Core Web Vitals (LCP, FID, CLS)',
        'Focus order analysis'
    ]

    async diagnose(page: Page): Promise<TestTypeDiagnosis> {
        const startTime = Date.now()
        const canTest: CapabilityItem[] = []
        const cannotTest: CapabilityItem[] = []

        try {
            // Check for ARIA roles
            const ariaStats = await page.evaluate(() => {
                const ariaElements = document.querySelectorAll('[role]')
                const ariaLabels = document.querySelectorAll('[aria-label], [aria-labelledby]')
                const ariaDescribed = document.querySelectorAll('[aria-describedby]')
                return {
                    roles: ariaElements.length,
                    labels: ariaLabels.length,
                    described: ariaDescribed.length
                }
            })

            if (ariaStats.roles > 0 || ariaStats.labels > 0) {
                canTest.push({
                    name: 'ARIA attributes',
                    reason: `Found ${ariaStats.roles} roles, ${ariaStats.labels} labels`,
                    elementCount: ariaStats.roles + ariaStats.labels
                })
            }

            // Check for form labels
            const labelStats = await page.evaluate(() => {
                const inputs = document.querySelectorAll('input:not([type="hidden"]), textarea, select')
                let labeled = 0
                let unlabeled = 0

                inputs.forEach(input => {
                    const id = input.id
                    const hasForLabel = id && document.querySelector(`label[for="${id}"]`)
                    const hasAriaLabel = input.getAttribute('aria-label') || input.getAttribute('aria-labelledby')
                    const hasPlaceholder = input.getAttribute('placeholder')

                    if (hasForLabel || hasAriaLabel) {
                        labeled++
                    } else if (!hasPlaceholder) {
                        unlabeled++
                    }
                })

                return { labeled, unlabeled, total: inputs.length }
            })

            if (labelStats.labeled > 0) {
                canTest.push({
                    name: 'Labeled form fields',
                    reason: 'Can verify label-input associations',
                    elementCount: labelStats.labeled
                })
            }

            if (labelStats.unlabeled > 0) {
                canTest.push({
                    name: 'Unlabeled inputs detected',
                    reason: 'Can flag missing labels as accessibility issues',
                    elementCount: labelStats.unlabeled
                })
            }

            // Check for images without alt
            const imageStats = await page.evaluate(() => {
                const images = document.querySelectorAll('img')
                let withAlt = 0
                let withoutAlt = 0

                images.forEach(img => {
                    if (img.getAttribute('alt') !== null) {
                        withAlt++
                    } else {
                        withoutAlt++
                    }
                })

                return { withAlt, withoutAlt, total: images.length }
            })

            if (imageStats.total > 0) {
                canTest.push({
                    name: 'Image alt text',
                    reason: `${imageStats.withAlt}/${imageStats.total} images have alt text`,
                    elementCount: imageStats.total
                })
            }

            // Check for skip links
            const skipLinks = await page.$$('a[href="#main"], a[href="#content"], .skip-link, [class*="skip-to"]')
            if (skipLinks.length > 0) {
                canTest.push({
                    name: 'Skip navigation links',
                    reason: 'Can verify skip link functionality',
                    elementCount: skipLinks.length
                })
            }

            // Check for heading structure
            const headingStats = await page.evaluate(() => {
                const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6')
                const h1Count = document.querySelectorAll('h1').length
                return { total: headings.length, h1Count }
            })

            if (headingStats.total > 0) {
                canTest.push({
                    name: 'Heading structure',
                    reason: `${headingStats.total} headings, ${headingStats.h1Count} H1s`,
                    elementCount: headingStats.total
                })
            }

            // Check for focusable elements
            const focusableElements = await page.$$('[tabindex], a[href], button, input, select, textarea')
            if (focusableElements.length > 0) {
                canTest.push({
                    name: 'Focusable elements',
                    reason: 'Can test keyboard navigation',
                    elementCount: focusableElements.length
                })
            }

            // Check for color contrast (basic)
            canTest.push({
                name: 'Color contrast',
                reason: 'Can analyze text-background contrast ratios'
            })

            // Performance / Core Web Vitals
            canTest.push({
                name: 'Core Web Vitals',
                reason: 'Can measure LCP, FID, CLS metrics'
            })

            // Check for animations (may affect reduced motion)
            const animatedElements = await page.$$('[class*="animate"], [class*="transition"], [class*="motion"]')
            if (animatedElements.length > 0) {
                canTest.push({
                    name: 'Animations',
                    reason: 'Can check for prefers-reduced-motion support',
                    elementCount: animatedElements.length
                })
            }

            // Check for autoplay media
            const autoplayMedia = await page.$$('video[autoplay], audio[autoplay]')
            if (autoplayMedia.length > 0) {
                cannotTest.push({
                    name: 'Autoplay media',
                    reason: 'May require user interaction to control',
                    elementCount: autoplayMedia.length
                })
            }

        } catch (error: any) {
            // Convert technical errors to user-friendly messages
            cannotTest.push({
                name: 'Page Analysis Limitation',
                reason: 'Some accessibility elements could not be analyzed due to page complexity or dynamic content loading.'
            })
        }

        // Generate plain English narrative
        const passed = canTest.length > 0 && cannotTest.length < 2
        const narrative = {
            what: `The accessibility compliance of this page is being diagnosed, including ARIA attributes, color contrast, keyboard navigation, and Core Web Vitals.`,
            how: `The system audits ${canTest.reduce((sum, c) => sum + (c.elementCount || 1), 0)} elements for WCAG compliance including labeling, heading structure, and focus management.`,
            why: `Accessibility failures exclude users with disabilities and increasingly carry legal compliance risks.`,
            result: passed
                ? `Passed — ${canTest.length} accessibility features can be tested on this page.`
                : `Failed — ${cannotTest.length} accessibility issues found: ${cannotTest.map(c => c.name).join(', ')}.`,
            passed
        }

        return {
            testType: this.testType,
            steps: this.steps,
            canTest,
            cannotTest,
            duration: Date.now() - startTime,
            narrative
        }
    }
}
