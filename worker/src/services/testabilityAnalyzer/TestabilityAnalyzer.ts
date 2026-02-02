/**
 * Testability Analyzer Service
 * 
 * Main orchestrator for pre-test diagnosis.
 * Generates a TestabilityContract that answers:
 * - What will work reliably
 * - What might be flaky
 * - What will not work at all
 * - Why
 * - What the system will skip or adapt
 */

import { Page } from 'playwright'
import {
    TestabilityContract,
    TestabilityContractInput,
    TestTypeCapability,
    GlobalBlocker,
    SystemAction,
    RiskAcceptanceItem,
    LightweightAccessibilityMap,
    LightweightElement,
    ITestabilityAnalyzer,
    TestType,
} from './types'

// Detectors
import {
    detectCaptcha,
    detectMFA,
    detectCrossOriginIframes,
    detectNativeDialogs,
    checkPageReadiness,
} from './detectors'

// Analyzers
import {
    analyzeLoginCapability,
    analyzeFormCapability,
    analyzeNavigationCapability,
} from './analyzers'

export class TestabilityAnalyzerService implements ITestabilityAnalyzer {
    /**
     * Generate a TestabilityContract for the given page and test types.
     * This is the main entry point for diagnosis.
     */
    async generateContract(
        input: TestabilityContractInput,
        page: Page
    ): Promise<TestabilityContract> {
        const startTime = Date.now()
        const url = await page.url()
        const pageTitle = await page.title()

        // Run all detections in parallel
        const [
            captcha,
            mfa,
            iframes,
            dialogs,
            readiness,
            accessibilityMap,
        ] = await Promise.all([
            detectCaptcha(page),
            detectMFA(page),
            detectCrossOriginIframes(page),
            detectNativeDialogs(page),
            checkPageReadiness(page),
            this.createLightweightAccessibilityMap(page),
        ])

        // Build global blockers
        const globalBlockers: GlobalBlocker[] = []

        if (captcha.detected) {
            globalBlockers.push({
                type: 'captcha',
                detected: true,
                location: captcha.location,
                selector: captcha.selector,
                impact: `${captcha.type || 'CAPTCHA'} detected - automated testing will be blocked`,
                severity: 'blocking',
            })
        }

        if (mfa.detected) {
            globalBlockers.push({
                type: 'mfa',
                detected: true,
                impact: `MFA/OTP detected (${mfa.type || 'unknown type'}) - requires manual intervention`,
                severity: 'warning',
            })
        }

        for (const iframe of iframes) {
            if (iframe.purpose === 'payment') {
                globalBlockers.push({
                    type: 'payment_gateway',
                    detected: true,
                    location: iframe.url,
                    selector: iframe.selector,
                    impact: 'Payment gateway iframe cannot be automated',
                    severity: 'blocking',
                })
            } else if (iframe.purpose === 'auth') {
                globalBlockers.push({
                    type: 'cross_origin_iframe',
                    detected: true,
                    location: iframe.url,
                    selector: iframe.selector,
                    impact: 'Authentication iframe is cross-origin',
                    severity: 'warning',
                })
            }
        }

        if (dialogs.hasBeforeUnload) {
            globalBlockers.push({
                type: 'native_dialog',
                detected: true,
                impact: 'Page has beforeunload handler - may show "Leave site?" dialog',
                severity: 'warning',
            })
        }

        // Build system actions based on readiness
        const systemActions: SystemAction[] = []

        for (const overlaySelector of readiness.overlaySelectors) {
            systemActions.push({
                action: 'skip_selector',
                target: overlaySelector,
                reason: 'Overlay/modal detected - will attempt to dismiss',
            })
        }

        if (dialogs.hasAlertHandlers || dialogs.hasConfirmHandlers) {
            systemActions.push({
                action: 'use_fallback',
                target: 'dialog handlers',
                reason: 'Will auto-dismiss native dialogs',
            })
        }

        // Analyze each requested test type
        const testTypeAnalysis: TestTypeCapability[] = []

        for (const testType of input.selectedTestTypes) {
            const capability = await this.analyzeTestType(testType, page, accessibilityMap)
            if (capability) {
                testTypeAnalysis.push(capability)
            }
        }

        // If no test types specified, default to navigation
        if (testTypeAnalysis.length === 0) {
            const navCapability = await analyzeNavigationCapability(page, accessibilityMap)
            testTypeAnalysis.push(navCapability)
        }

        // Build risk acceptance items
        const riskAcceptance: RiskAcceptanceItem[] = []

        for (const blocker of globalBlockers) {
            if (blocker.severity === 'warning') {
                riskAcceptance.push({
                    risk: blocker.impact,
                    impact: `Tests involving ${blocker.type} may fail or require manual steps`,
                    userMustAccept: true,
                })
            }
        }

        // Add risks from conditionally testable items
        for (const analysis of testTypeAnalysis) {
            for (const condition of analysis.conditionallyTestable.conditions) {
                riskAcceptance.push({
                    risk: condition,
                    impact: 'May cause flaky tests',
                    userMustAccept: false,
                })
            }
        }

        // Determine overall confidence
        const hasBlockers = globalBlockers.some(b => b.severity === 'blocking')
        const hasWarnings = globalBlockers.some(b => b.severity === 'warning')
        const hasTestableElements = testTypeAnalysis.some(t => t.testable.elements.length > 0)

        let overallConfidence: 'high' | 'medium' | 'low'
        let confidenceReason: string

        if (hasBlockers) {
            overallConfidence = 'low'
            confidenceReason = 'Blocking issues detected (CAPTCHA, payment gateway)'
        } else if (hasWarnings || !hasTestableElements) {
            overallConfidence = 'medium'
            confidenceReason = hasWarnings
                ? 'Some elements may require manual intervention'
                : 'Limited testable elements found'
        } else {
            overallConfidence = 'high'
            confidenceReason = 'Core elements are testable with standard automation'
        }

        // Can we proceed?
        const canProceed = !hasBlockers || riskAcceptance.length > 0
        const proceedBlockedReason = hasBlockers && riskAcceptance.length === 0
            ? 'Critical blockers detected with no workaround'
            : undefined

        return {
            testTypeAnalysis,
            globalBlockers,
            systemActions,
            overallConfidence,
            confidenceReason,
            riskAcceptance,
            canProceed,
            proceedBlockedReason,
            analyzedAt: new Date().toISOString(),
            duration: Date.now() - startTime,
            url,
            pageTitle,
        }
    }

    /**
     * Analyze a specific test type's capability
     */
    private async analyzeTestType(
        testType: TestType,
        page: Page,
        accessibilityMap: LightweightAccessibilityMap
    ): Promise<TestTypeCapability | null> {
        switch (testType) {
            case 'login':
                return analyzeLoginCapability(page, accessibilityMap)
            case 'form_submission':
            case 'data_entry':
            case 'signup':
                return analyzeFormCapability(page, accessibilityMap)
            case 'navigation':
            case 'search':
                return analyzeNavigationCapability(page, accessibilityMap)
            case 'checkout':
            case 'payment':
                // Use form analyzer for checkout flows
                const formCapability = await analyzeFormCapability(page, accessibilityMap)
                return { ...formCapability, testType: 'checkout' }
            default:
                // For custom or unimplemented types, use navigation as fallback
                const navCapability = await analyzeNavigationCapability(page, accessibilityMap)
                return { ...navCapability, testType }
        }
    }

    /**
     * Create a lightweight accessibility map focused on selector extraction only
     */
    private async createLightweightAccessibilityMap(
        page: Page
    ): Promise<LightweightAccessibilityMap> {
        try {
            const elements = await page.evaluate(() => {
                const interactiveSelectors = [
                    'button',
                    'a[href]',
                    'input',
                    'select',
                    'textarea',
                    '[role="button"]',
                    '[role="link"]',
                    '[role="checkbox"]',
                    '[role="radio"]',
                    '[tabindex]:not([tabindex="-1"])',
                ]

                const results: LightweightElement[] = []

                for (const selector of interactiveSelectors) {
                    const elements = Array.from(document.querySelectorAll(selector))
                    for (const el of elements) {
                        const htmlEl = el as HTMLElement
                        const rect = htmlEl.getBoundingClientRect()
                        const style = window.getComputedStyle(htmlEl)

                        const isVisible = (
                            rect.width > 0 &&
                            rect.height > 0 &&
                            style.display !== 'none' &&
                            style.visibility !== 'hidden' &&
                            style.opacity !== '0'
                        )

                        if (!isVisible) continue

                        // Generate best selector
                        let bestSelector = ''
                        if (htmlEl.id) {
                            bestSelector = `#${htmlEl.id}`
                        } else if (htmlEl.getAttribute('data-testid')) {
                            bestSelector = `[data-testid="${htmlEl.getAttribute('data-testid')}"]`
                        } else if (htmlEl.getAttribute('name')) {
                            bestSelector = `${htmlEl.tagName.toLowerCase()}[name="${htmlEl.getAttribute('name')}"]`
                        } else {
                            bestSelector = selector
                        }

                        // Determine type
                        const tagName = htmlEl.tagName.toLowerCase()
                        let type: LightweightElement['type'] = 'button'
                        if (tagName === 'input') type = 'input'
                        else if (tagName === 'a') type = 'link'
                        else if (tagName === 'select') type = 'select'
                        else if (tagName === 'textarea') type = 'textarea'
                        else if (tagName === 'form') type = 'form'

                        // Check for label
                        const hasLabel = !!(
                            htmlEl.getAttribute('aria-label') ||
                            htmlEl.getAttribute('aria-labelledby') ||
                            (htmlEl as HTMLInputElement).labels?.length
                        )

                        results.push({
                            selector: bestSelector,
                            type,
                            inputType: (htmlEl as HTMLInputElement).type,
                            isVisible: true,
                            hasLabel,
                            text: htmlEl.textContent?.trim().slice(0, 50),
                            name: htmlEl.getAttribute('name') || undefined,
                            id: htmlEl.id || undefined,
                            role: htmlEl.getAttribute('role') || undefined,
                        })
                    }
                }

                return results.slice(0, 100) // Limit to avoid huge payloads
            })

            return {
                elements,
                pageInfo: {
                    url: await page.url(),
                    title: await page.title(),
                },
            }
        } catch (error) {
            console.error('Accessibility map error:', error)
            return {
                elements: [],
                pageInfo: {
                    url: await page.url(),
                    title: await page.title(),
                },
            }
        }
    }
}

// Export singleton instance
export const testabilityAnalyzer = new TestabilityAnalyzerService()
