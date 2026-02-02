/**
 * Navigation Analyzer
 * 
 * Analyzes a page's navigation capability - links, buttons, menus
 * and what might be flaky during navigation testing.
 */

import { Page } from 'playwright'
import { TestTypeCapability, LightweightAccessibilityMap, CapabilityItem } from '../types'

const NAVIGATION_ELEMENTS = {
    links: ['a[href]'],
    buttons: ['button', '[role="button"]'],
    menus: [
        'nav',
        '[role="navigation"]',
        '[role="menu"]',
        '[role="menubar"]',
    ],
    tabs: [
        '[role="tab"]',
        '[role="tablist"]',
        '.tabs',
        '[data-tab]',
    ],
}

const FLAKY_NAVIGATION = {
    lazyLoaded: [
        '[data-src]',
        '.lazy',
        '[loading="lazy"]',
    ],
    infiniteScroll: [
        '[data-infinite-scroll]',
        '.infinite-scroll',
        '[data-page]',
    ],
    clientSideRouting: [
        'a[href^="#"]',
        'a[href^="javascript:"]',
        '[data-link]',
    ],
    animations: [
        '.animated',
        '[data-aos]',
        '.transition',
        '.fade',
        '.slide',
    ],
}

export async function analyzeNavigationCapability(
    page: Page,
    accessibilityMap: LightweightAccessibilityMap
): Promise<TestTypeCapability> {
    const testable: CapabilityItem[] = []
    const conditionallyTestable: CapabilityItem[] = []
    const notTestable: CapabilityItem[] = []
    const conditions: string[] = []
    const reasons: string[] = []

    try {
        // Analyze standard navigation elements
        const links = await page.$$('a[href]')
        const internalLinks: CapabilityItem[] = []
        const externalLinks: CapabilityItem[] = []

        const currentUrl = new URL(await page.url())

        for (const link of links.slice(0, 30)) { // Limit to avoid huge analysis
            const isVisible = await link.isVisible().catch(() => false)
            if (!isVisible) continue

            const href = await link.getAttribute('href') || ''
            const text = await link.textContent() || ''

            // Skip anchor links
            if (href.startsWith('#') || href.startsWith('javascript:')) {
                conditionallyTestable.push({
                    name: text.trim().slice(0, 30) || 'Anchor link',
                    selector: `a[href="${href}"]`,
                    reason: 'Client-side navigation may require special handling',
                    elementType: 'link',
                })
                continue
            }

            // Check if external
            try {
                const linkUrl = new URL(href, currentUrl.origin)
                const isExternal = linkUrl.origin !== currentUrl.origin

                const item: CapabilityItem = {
                    name: text.trim().slice(0, 30) || 'Link',
                    selector: `a[href="${href}"]`,
                    reason: isExternal ? 'External link' : 'Internal navigation',
                    elementType: 'link',
                }

                if (isExternal) {
                    externalLinks.push(item)
                } else {
                    internalLinks.push(item)
                }
            } catch {
                // Invalid URL
                conditionallyTestable.push({
                    name: text.trim().slice(0, 30) || 'Link',
                    reason: 'Invalid or relative URL format',
                    elementType: 'link',
                })
            }
        }

        // Internal links are testable
        testable.push(...internalLinks.slice(0, 15))

        // External links are conditionally testable
        if (externalLinks.length > 0) {
            conditionallyTestable.push(...externalLinks.slice(0, 5))
            conditions.push('External links may redirect outside the test domain')
        }

        // Check for buttons
        const buttons = await page.$$('button:visible, [role="button"]:visible')
        for (const button of buttons.slice(0, 10)) {
            const text = await button.textContent() || ''
            const id = await button.getAttribute('id') || ''

            testable.push({
                name: text.trim().slice(0, 30) || id || 'Button',
                selector: id ? `#${id}` : `button:has-text("${text.trim().slice(0, 20)}")`,
                reason: 'Standard button element',
                elementType: 'button',
            })
        }

        // Check for navigation menus
        const navs = await page.$$('nav, [role="navigation"]')
        if (navs.length > 0) {
            testable.push({
                name: 'Navigation menu',
                selector: 'nav',
                reason: 'Standard navigation structure detected',
                elementType: 'other',
            })
        }

        // Check for flaky patterns
        for (const [category, selectors] of Object.entries(FLAKY_NAVIGATION)) {
            for (const selector of selectors) {
                const element = await page.$(selector)
                if (element) {
                    const isVisible = await element.isVisible().catch(() => false)
                    if (isVisible) {
                        if (category === 'lazyLoaded') {
                            conditions.push('Page has lazy-loaded content')
                        } else if (category === 'infiniteScroll') {
                            conditions.push('Page has infinite scroll')
                        } else if (category === 'animations') {
                            conditions.push('Page has entry animations')
                        }
                        break
                    }
                }
            }
        }

        // Check for SPA detection
        const isSPA = await page.evaluate(() => {
            return (
                !!(window as any).__NEXT_DATA__ ||
                !!(window as any).__NUXT__ ||
                !!(window as any).angular ||
                !!(window as any).React ||
                document.querySelector('[data-reactroot], [ng-app], [data-v-]') !== null
            )
        })

        if (isSPA) {
            conditions.push('Page uses client-side routing (SPA)')
        }

        return {
            testType: 'navigation',
            testable: {
                elements: testable,
                confidence: testable.length > 3 ? 'high' : 'medium',
            },
            conditionallyTestable: {
                elements: conditionallyTestable,
                conditions: [...new Set(conditions)],
                confidence: conditionallyTestable.length > 0 ? 'medium' : 'low',
            },
            notTestable: {
                elements: notTestable,
                reasons,
            },
        }
    } catch (error) {
        console.error('Navigation analysis error:', error)
        return {
            testType: 'navigation',
            testable: { elements: [], confidence: 'medium' },
            conditionallyTestable: { elements: [], conditions: [], confidence: 'low' },
            notTestable: { elements: [], reasons: ['Analysis failed: ' + (error as Error).message] },
        }
    }
}
