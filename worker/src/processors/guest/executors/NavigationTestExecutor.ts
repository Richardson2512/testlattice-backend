import { Page } from 'playwright'
import { ExecutionLogEmitter } from '../../../services/executionLogEmitter'
import { logger } from '../../../observability'


interface ProcessResult {
    success: boolean
    findings: any[]
    error?: string
}

export class NavigationTestExecutor {
    constructor(
        private deps: {
            page: Page
            logEmitter: ExecutionLogEmitter
            recordStep: (stepName: string, success: boolean, durationMs: number, metadata?: any) => void
            captureScreenshot: (name: string) => Promise<void>
        },
        private config: {
            runId: string
            url: string
        }
    ) { }

    /**
     * Record a step with structured output format
     */
    private recordLocalStep(
        stepName: string,
        execution_status: 'EXECUTED' | 'BLOCKED' | 'EXECUTION_FAILED' | 'SKIPPED',
        severity: 'GREEN' | 'YELLOW' | 'RED',
        observed_state: Record<string, any>,
        note: string
    ) {
        const success = severity !== 'RED' && execution_status === 'EXECUTED'
        this.deps.recordStep(stepName, success, 100, {
            execution_status,
            observed_state,
            severity,
            note,
            ...observed_state
        })
    }

    private async captureAndRecord(
        stepName: string,
        execution_status: 'EXECUTED' | 'BLOCKED' | 'EXECUTION_FAILED' | 'SKIPPED',
        severity: 'GREEN' | 'YELLOW' | 'RED',
        observed_state: Record<string, any>,
        note: string
    ): Promise<void> {
        const screenshotUrl = await this.deps.captureScreenshot(stepName)
        const success = severity !== 'RED' && execution_status === 'EXECUTED'
        this.deps.recordStep(stepName, success, 100, {
            execution_status,
            observed_state,
            severity,
            note,
            screenshotUrl,
            ...observed_state
        })
    }

    private buildResult(success: boolean): ProcessResult {
        return {
            success: true, // Always true - findings tracked at step level
            findings: []
        }
    }

    async execute(): Promise<ProcessResult> {
        logger.info({ runId: this.config.runId }, 'Starting Navigation Contract v1')
        this.deps.logEmitter.log('Starting Navigation 12-step contract...')
        const page = this.deps.page
        const baseUrl = this.config.url.replace(/\/$/, '')

        try {
            // STEP 1: Extract Primary Navigation Links
            const navLinks = await page.evaluate(() => {
                const anchors = Array.from(document.querySelectorAll('nav a, header a, .navigation a, .menu a')) as HTMLAnchorElement[]
                return anchors.map(a => ({
                    href: a.getAttribute('href'),
                    text: (a.innerText || '').trim(),
                    boundingBox: a.getBoundingClientRect(),
                    isVisible: a.checkVisibility ? a.checkVisibility() : true
                })).filter(l => l.isVisible && l.boundingBox.height > 0)
            })

            await this.captureAndRecord('extract_primary_nav', 'EXECUTED', 'GREEN',
                { link_count: navLinks.length, preview: navLinks.slice(0, 5).map(l => l.text) },
                `Found ${navLinks.length} primary navigation links`)

            // STEP 2: Count Total Nav Items - INFORMATIONAL ONLY
            const allLinksCount = await page.evaluate(() => document.querySelectorAll('a').length)
            // RECLASSIFIED: count_total_nav_items → Informational only
            await this.captureAndRecord('count_total_nav_items', 'EXECUTED', 'GREEN',
                { primary_nav_count: navLinks.length, total_anchors_on_page: allLinksCount },
                `Total anchors on page: ${allLinksCount}`)

            // STEP 3: Detect Placeholder Links
            const badLinks = navLinks.filter(l =>
                !l.href ||
                l.href === '#' ||
                l.href.toLowerCase().includes('javascript:void') ||
                l.href === ''
            )
            const placeholderSeverity = badLinks.length === 0 ? 'GREEN' : (badLinks.length > 3 ? 'RED' : 'YELLOW')
            await this.captureAndRecord('detect_placeholders', 'EXECUTED', placeholderSeverity,
                { placeholder_count: badLinks.length, items: badLinks.map(l => l.text || 'Untitled') },
                badLinks.length === 0 ? 'No placeholder links detected' : `Found ${badLinks.length} placeholder link(s)`)

            if (navLinks.length === 0) {
                this.deps.logEmitter.log('No navigation links found - recording finding and completing test.')
                await this.captureAndRecord('no_nav_links_found', 'EXECUTED', 'YELLOW',
                    { links_found: false },
                    'No navigation links detected on page')
            }

            // FILTER: Valid internal links only for clicking
            // Use baseUrl (already extracted) instead of window.location.hostname (not available in Node.js)
            const hostname = new URL(baseUrl).hostname
            const validLinks = navLinks.filter(l =>
                l.href &&
                !l.href.startsWith('#') &&
                !l.href.startsWith('javascript') &&
                !l.href.startsWith('mailto') &&
                !l.href.startsWith('tel') &&
                (l.href.startsWith('/') || l.href.includes(hostname))
            )

            // STEP 4: Click First Link
            let firstLinkSuccess = false
            if (validLinks.length > 0) {
                const target = validLinks[0]
                this.deps.logEmitter.log(`Testing navigation to: ${target.text}`)

                const clicked = await this.clickLinkByTextOrHref(target)

                if (clicked) {
                    await page.waitForLoadState('domcontentloaded').catch(() => { })
                    await page.waitForTimeout(1000)
                    firstLinkSuccess = true
                }
            } else {
                this.deps.logEmitter.log('No valid internal links found to click.')
            }
            await this.captureAndRecord('click_first_link', 'EXECUTED', firstLinkSuccess ? 'GREEN' : 'YELLOW',
                { clicked: firstLinkSuccess, target: validLinks[0]?.text || 'N/A' },
                firstLinkSuccess ? `Successfully clicked: ${validLinks[0]?.text}` : 'No valid links to click')

            // STEP 5: Verify Navigation Success (First)
            const currentUrl = page.url()
            const landedOnNewPage = currentUrl !== this.config.url && !currentUrl.includes('404')
            await this.captureAndRecord('verify_nav_success_1', 'EXECUTED', landedOnNewPage ? 'GREEN' : 'YELLOW',
                { current_url: currentUrl, navigated: landedOnNewPage },
                landedOnNewPage ? 'Navigation to new page successful' : 'Did not navigate to new page')

            // STEP 6: Navigate Back to Home
            await page.goto(this.config.url)
            await page.waitForLoadState('networkidle').catch(() => { })
            await this.captureAndRecord('return_home', 'EXECUTED', 'GREEN',
                { returned: true },
                'Returned to home page')

            // STEP 7: Click Second Link
            let secondLinkSuccess = false
            if (validLinks.length > 1) {
                const target = validLinks[1]
                this.deps.logEmitter.log(`Testing navigation to: ${target.text}`)

                const clicked = await this.clickLinkByTextOrHref(target)
                if (clicked) {
                    await page.waitForLoadState('domcontentloaded').catch(() => { })
                    await page.waitForTimeout(1000)
                    secondLinkSuccess = true
                }

                await this.captureAndRecord('click_second_link', 'EXECUTED', secondLinkSuccess ? 'GREEN' : 'YELLOW',
                    { clicked: secondLinkSuccess, target: validLinks[1]?.text },
                    secondLinkSuccess ? `Successfully clicked: ${validLinks[1]?.text}` : 'Failed to click second link')

                // STEP 8: Verify Navigation Success (Second)
                const url2 = page.url()
                const success2 = url2 !== this.config.url && !url2.includes('404')
                await this.captureAndRecord('verify_nav_success_2', 'EXECUTED', success2 ? 'GREEN' : 'YELLOW',
                    { current_url: url2, navigated: success2 },
                    success2 ? 'Second navigation successful' : 'Did not navigate to new page')
            } else {
                await this.captureAndRecord('click_second_link', 'SKIPPED', 'GREEN',
                    { reason: 'Less than 2 links available' },
                    'Skipped - less than 2 links')
                await this.captureAndRecord('verify_nav_success_2', 'SKIPPED', 'GREEN',
                    { reason: 'No second link to verify' },
                    'Skipped')
            }

            // Return home for next steps
            await page.goto(this.config.url)

            // STEP 9: Validate Logo-Home Navigation
            const logoWorking = await page.evaluate((startUrl) => {
                const logoLink = Array.from(document.querySelectorAll('a')).find(a => {
                    const hasMedia = a.querySelector('img, svg')
                    const href = a.getAttribute('href')
                    const goesHome = href === '/' || href === startUrl || href === startUrl + '/'
                    return hasMedia && goesHome
                })

                if (logoLink) {
                    (logoLink as HTMLElement).click()
                    return true
                }
                return false
            }, baseUrl)

            if (logoWorking) {
                await page.waitForTimeout(1000)
                const afterLogoUrl = page.url().replace(/\/$/, '')
                const isHome = afterLogoUrl === baseUrl
                await this.captureAndRecord('validate_logo_home', 'EXECUTED', isHome ? 'GREEN' : 'YELLOW',
                    { logo_found: true, returned_home: isHome },
                    isHome ? 'Logo click returns to home' : 'Logo found but did not return home')
            } else {
                await this.captureAndRecord('validate_logo_home', 'EXECUTED', 'YELLOW',
                    { logo_found: false },
                    'Could not confidently identify a Logo link')
            }

            // STEP 10: Check External Link Safety (noopener)
            const unsafeLinks = await page.evaluate(() => {
                const external = Array.from(document.querySelectorAll('a[target="_blank"]')) as HTMLAnchorElement[]
                return external.filter(a => {
                    const rel = (a.getAttribute('rel') || '').toLowerCase()
                    return !rel.includes('noopener') && !rel.includes('noreferrer')
                }).map(a => a.href)
            })

            const safetySeverity = unsafeLinks.length === 0 ? 'GREEN' : (unsafeLinks.length > 5 ? 'RED' : 'YELLOW')
            await this.captureAndRecord('check_external_link_safety', 'EXECUTED', safetySeverity,
                { unsafe_count: unsafeLinks.length, unsafe_samples: unsafeLinks.slice(0, 3) },
                unsafeLinks.length === 0 ? 'All external links have proper rel attributes' : `Found ${unsafeLinks.length} unsafe external link(s)`)

            // STEP 11: Detect Broken Anchors
            const brokenAnchors = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('a')).filter(a => {
                    const h = a.getAttribute('href')
                    if (!h) return false
                    return h.includes('{{') || h.includes('undefined') || h.includes('null') || (h.startsWith('http') && !h.includes('://'))
                }).map(a => a.href)
            })
            const brokenSeverity = brokenAnchors.length === 0 ? 'GREEN' : 'YELLOW'
            await this.captureAndRecord('detect_broken_anchors', 'EXECUTED', brokenSeverity,
                { broken_count: brokenAnchors.length, samples: brokenAnchors.slice(0, 3) },
                brokenAnchors.length === 0 ? 'No broken anchors detected' : `Found ${brokenAnchors.length} potentially broken anchor(s)`)

            // STEP 12: Record Navigation Consistency - INFORMATIONAL ONLY
            const qualityScore = (
                (navLinks.length > 0 ? 1 : 0) +
                (badLinks.length === 0 ? 1 : 0) +
                (firstLinkSuccess ? 1 : 0) +
                (unsafeLinks.length === 0 ? 1 : 0)
            ) / 4 * 100

            // RECLASSIFIED: record_navigation_consistency → Informational only
            await this.captureAndRecord('record_navigation_consistency', 'EXECUTED', 'GREEN',
                { quality_score: qualityScore, nav_items: navLinks.length },
                `Navigation test complete. Quality score: ${qualityScore}%`)

            return this.buildResult(true)

        } catch (error: any) {
            logger.error({ runId: this.config.runId, error: error.message }, 'Navigation Test Failed')
            this.deps.recordStep('nav_test_error', false, 0, { error: error.message })
            return this.buildResult(true) // Always return success - errors are findings
        }
    }

    private async clickLinkByTextOrHref(linkObj: any): Promise<boolean> {
        const page = this.deps.page
        try {
            // Try strict selector first
            const selector = `a[href="${linkObj.href}"]`
            if (await page.isVisible(selector)) {
                await page.click(selector)
                return true
            }

            // Fallback to text
            if (linkObj.text) {
                await page.getByText(linkObj.text, { exact: true }).first().click()
                return true
            }

            return false
        } catch (e) {
            return false
        }
    }
}
