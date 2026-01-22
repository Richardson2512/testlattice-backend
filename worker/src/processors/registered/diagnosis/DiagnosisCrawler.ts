/**
 * DiagnosisCrawler
 * Handles multi-page diagnosis crawl for Registered tests
 * Extracts links and navigates to subpages for testability analysis
 */

import { Page } from 'playwright'
import { VisionContext, VisionElement, DiagnosisResult, DiagnosisPageSummary } from '../../../types'
import { logger } from '../../../observability'

export interface DiagnosisCrawlerConfig {
    runId: string
    baseUrl: string
    maxPages: number
    navigationDelayMs: number
}

export interface DiagnosisCrawlerDependencies {
    page: Page
    captureSnapshot: (pageIndex: number) => Promise<{
        context: VisionContext
        analysis: DiagnosisResult
        screenshotUrl?: string
    }>
    executeClick: (selector: string, label?: string) => Promise<void>
    navigateTo: (url: string) => Promise<void>
    getCurrentUrl: () => Promise<string>
    getPageTitle: () => Promise<string>
}

export class DiagnosisCrawler {
    private config: DiagnosisCrawlerConfig
    private deps: DiagnosisCrawlerDependencies
    private visitedUrls: Set<string> = new Set()

    constructor(config: DiagnosisCrawlerConfig, deps: DiagnosisCrawlerDependencies) {
        this.config = config
        this.deps = deps
    }

    /**
     * Crawl to linked pages from current context
     */
    async crawl(
        baseContext: VisionContext,
        startIndex: number,
        remainingSlots: number
    ): Promise<DiagnosisPageSummary[]> {
        if (remainingSlots <= 0) {
            return []
        }

        const results: DiagnosisPageSummary[] = []
        const candidates = this.extractLinks(baseContext, remainingSlots * 3)

        for (const candidate of candidates) {
            if (results.length >= remainingSlots) {
                break
            }

            try {
                await this.deps.executeClick(candidate.selector, candidate.label)
                await this.delay(this.config.navigationDelayMs)

                const currentUrl = await this.deps.getCurrentUrl()
                const snapshot = await this.deps.captureSnapshot(startIndex + results.length)
                const title = await this.deps.getPageTitle()

                const summary: DiagnosisPageSummary = {
                    id: `page-${startIndex + results.length}`,
                    label: candidate.label || `View ${startIndex + results.length + 1}`,
                    url: currentUrl || candidate.url,
                    action: `Clicked ${candidate.label || 'link'}`,
                    title,
                    screenshotUrl: snapshot.screenshotUrl,
                    summary: snapshot.analysis.summary || '',
                    testableComponents: snapshot.analysis.testableComponents || [],
                    nonTestableComponents: snapshot.analysis.nonTestableComponents || [],
                    recommendedTests: snapshot.analysis.recommendedTests || []
                }

                const normalized = this.normalizeUrl(currentUrl)
                if (normalized) {
                    this.visitedUrls.add(normalized)
                }

                results.push(summary)

                // Return to base
                await this.deps.navigateTo(this.config.baseUrl)
                await this.delay(this.config.navigationDelayMs)

            } catch (error: any) {
                logger.warn({
                    runId: this.config.runId,
                    url: candidate.url,
                    error: error.message
                }, 'Diagnosis navigation failed')

                results.push({
                    id: `page-error-${startIndex + results.length}`,
                    label: candidate.label || candidate.url,
                    url: candidate.url,
                    action: `Clicked ${candidate.label || 'link'}`,
                    summary: 'Navigation failed during diagnosis.',
                    testableComponents: [],
                    nonTestableComponents: [{
                        name: candidate.label || candidate.url || 'Unknown',
                        reason: `Navigation failed: ${error.message}`
                    }],
                    recommendedTests: [],
                    errors: [`Failed to open ${candidate.url}: ${error.message}`]
                })
            }

            if (results.length >= remainingSlots) {
                break
            }
        }

        return results
    }

    /**
     * Extract candidate links from context
     */
    private extractLinks(
        context: VisionContext,
        limit: number
    ): Array<{ selector: string; url: string; label?: string }> {
        const candidates: Array<{ selector: string; url: string; label?: string }> = []
        const origin = this.getOrigin(this.config.baseUrl)

        for (const element of context.elements) {
            if (!element?.selector || candidates.length >= limit) {
                break
            }

            // Only process links and buttons
            if (element.type !== 'link' && element.role !== 'link') {
                continue
            }

            if (!element.href) {
                continue
            }

            const absoluteUrl = this.resolveUrl(this.config.baseUrl, element.href)
            if (!absoluteUrl) {
                continue
            }

            // Safety checks
            if (!this.isSafeLink(absoluteUrl, origin, element.text)) {
                continue
            }

            const normalized = this.normalizeUrl(absoluteUrl)
            if (this.visitedUrls.has(normalized)) {
                continue
            }

            candidates.push({
                selector: element.selector,
                url: absoluteUrl,
                label: (element.text || element.ariaLabel || '').trim() || undefined
            })
        }

        return candidates
    }

    private isSafeLink(url: string, baseOrigin: string, label?: string): boolean {
        try {
            const parsed = new URL(url)

            // Must be same origin
            if (parsed.origin !== baseOrigin) {
                return false
            }

            // Skip auth-related pages
            const dangerousPatterns = [
                /logout/i, /signout/i, /sign-out/i,
                /delete/i, /remove/i, /cancel/i,
                /unsubscribe/i
            ]

            const path = parsed.pathname + (label || '')
            for (const pattern of dangerousPatterns) {
                if (pattern.test(path)) {
                    return false
                }
            }

            return true
        } catch {
            return false
        }
    }

    private normalizeUrl(url: string): string {
        try {
            const parsed = new URL(url)
            // Remove trailing slash, hash, and some query params
            return `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}`
        } catch {
            return url
        }
    }

    private resolveUrl(base: string, href: string): string | null {
        try {
            return new URL(href, base).toString()
        } catch {
            return null
        }
    }

    private getOrigin(url: string): string {
        try {
            return new URL(url).origin
        } catch {
            return ''
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms))
    }
}
