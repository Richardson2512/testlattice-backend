/**
 * Navigation Diagnoser
 * 
 * Analyzes navigation testability including:
 * - Links and buttons
 * - Menus
 * - Search functionality
 * - Routing
 */

import { Page } from 'playwright'
import { IDiagnoser, TestTypeDiagnosis, CapabilityItem } from './IDiagnoser'

export class NavigationDiagnoser implements IDiagnoser {
    readonly testType = 'navigation'
    readonly steps = [
        'Extracting all links',
        'Detecting navigation menus',
        'Finding search functionality',
        'Mapping routing structure'
    ]

    async diagnose(page: Page): Promise<TestTypeDiagnosis> {
        const startTime = Date.now()
        const canTest: CapabilityItem[] = []
        const cannotTest: CapabilityItem[] = []

        try {
            const url = page.url()
            const origin = new URL(url).origin

            // Count internal vs external links
            const linkStats = await page.evaluate((origin) => {
                const links = Array.from(document.querySelectorAll('a[href]'))
                let internal = 0
                let external = 0
                let broken = 0

                links.forEach(link => {
                    const href = link.getAttribute('href') || ''
                    if (href.startsWith('#') || href.startsWith('javascript:')) {
                        return
                    }
                    try {
                        const linkUrl = new URL(href, window.location.href)
                        if (linkUrl.origin === origin) {
                            internal++
                        } else {
                            external++
                        }
                    } catch {
                        broken++
                    }
                })

                return { internal, external, broken, total: links.length }
            }, origin)

            if (linkStats.internal > 0) {
                canTest.push({
                    name: 'Internal links',
                    reason: 'Can navigate and verify internal pages',
                    elementCount: linkStats.internal
                })
            }

            if (linkStats.external > 0) {
                cannotTest.push({
                    name: 'External links',
                    reason: 'Cannot verify external page content',
                    elementCount: linkStats.external
                })
            }

            // Check for navigation menu
            const navElements = await page.$$('nav, [role="navigation"], header nav, .navbar, .nav-menu')
            if (navElements.length > 0) {
                canTest.push({
                    name: 'Navigation menus',
                    reason: 'Can test menu interaction and navigation',
                    elementCount: navElements.length
                })
            }

            // Check for hamburger/mobile menu
            const mobileMenuButtons = await page.$$('[class*="hamburger"], [class*="menu-toggle"], button[aria-label*="menu"]')
            if (mobileMenuButtons.length > 0) {
                canTest.push({
                    name: 'Mobile menu toggle',
                    reason: 'Can test responsive navigation',
                    elementCount: mobileMenuButtons.length
                })
            }

            // Check for search functionality
            const searchElements = await page.$$('input[type="search"], input[name*="search"], input[id*="search"], [role="search"]')
            if (searchElements.length > 0) {
                canTest.push({
                    name: 'Search functionality',
                    reason: 'Can test search input and results',
                    elementCount: searchElements.length
                })
            }

            // Check for breadcrumbs
            const breadcrumbs = await page.$$('[class*="breadcrumb"], nav[aria-label*="breadcrumb"], ol[class*="breadcrumb"]')
            if (breadcrumbs.length > 0) {
                canTest.push({
                    name: 'Breadcrumb navigation',
                    reason: 'Can verify navigation hierarchy',
                    elementCount: breadcrumbs.length
                })
            }

            // Check for pagination
            const pagination = await page.$$('[class*="pagination"], nav[aria-label*="pagination"], .pager')
            if (pagination.length > 0) {
                canTest.push({
                    name: 'Pagination',
                    reason: 'Can test page navigation',
                    elementCount: pagination.length
                })
            }

            // Check for tabs
            const tabs = await page.$$('[role="tablist"], [class*="tab-"], .tabs')
            if (tabs.length > 0) {
                canTest.push({
                    name: 'Tab navigation',
                    reason: 'Can test tab switching',
                    elementCount: tabs.length
                })
            }

            // Check for SPA routing (may cause issues)
            const hasSPAIndicators = await page.evaluate(() => {
                return !!(window as any).__NEXT_DATA__ ||
                    !!(window as any).__NUXT__ ||
                    document.querySelector('[data-reactroot]') !== null ||
                    document.querySelector('#__next') !== null ||
                    document.querySelector('#app') !== null
            })

            if (hasSPAIndicators) {
                canTest.push({
                    name: 'SPA detected',
                    reason: 'Can handle client-side routing'
                })
            }

            // Check for download links
            const downloadLinks = await page.$$('a[download], a[href$=".pdf"], a[href$=".zip"], a[href$=".doc"]')
            if (downloadLinks.length > 0) {
                cannotTest.push({
                    name: 'Download links',
                    reason: 'Cannot verify downloaded file contents',
                    elementCount: downloadLinks.length
                })
            }

        } catch (error: any) {
            // Convert technical errors to user-friendly messages
            cannotTest.push({
                name: 'Navigation Analysis Limitation',
                reason: 'Some navigation elements could not be analyzed due to dynamic routing or complex menu structures.'
            })
        }

        // Generate plain English narrative
        const passed = cannotTest.length === 0 || canTest.length > cannotTest.length
        const narrative = {
            what: `The navigation structure of this page is being diagnosed, including links, menus, search, and routing patterns.`,
            how: `The system maps ${canTest.reduce((sum, c) => sum + (c.elementCount || 1), 0)} navigation elements including internal links, menus, and interactive controls.`,
            why: `Broken navigation prevents users from accessing key pages and directly increases bounce rates and user frustration.`,
            result: passed
                ? `Passed — Navigation can be tested with ${canTest.length} testable elements.`
                : `Failed — ${cannotTest.length} navigation issues found: ${cannotTest.map(c => c.name).join(', ')}.`,
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
