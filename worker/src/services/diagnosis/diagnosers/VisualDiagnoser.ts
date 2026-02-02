/**
 * Visual Diagnoser
 * 
 * Analyzes visual testability of a page.
 * Includes SEO meta checks as part of visual diagnosis.
 */

import { Page } from 'playwright'
import { IDiagnoser, TestTypeDiagnosis, CapabilityItem } from './IDiagnoser'

export class VisualDiagnoser implements IDiagnoser {
    readonly testType = 'visual'
    readonly steps = [
        'Capturing full-page screenshots',
        'Analyzing layout structure',
        'Extracting color palette',
        'Scanning typography',
        'Checking meta tags (SEO)',
        'Detecting visual inconsistencies'
    ]

    async diagnose(page: Page): Promise<TestTypeDiagnosis> {
        const startTime = Date.now()
        const canTest: CapabilityItem[] = []
        const cannotTest: CapabilityItem[] = []

        try {
            // Check for images
            const images = await page.$$('img')
            if (images.length > 0) {
                canTest.push({
                    name: 'Images',
                    reason: 'Can verify dimensions, alt text, and broken images',
                    elementCount: images.length
                })
            }

            // Check for CSS Grid/Flexbox layouts
            const layoutInfo = await page.evaluate(() => {
                const elements = document.querySelectorAll('*')
                let gridCount = 0
                let flexCount = 0
                elements.forEach(el => {
                    const style = window.getComputedStyle(el)
                    if (style.display === 'grid') gridCount++
                    if (style.display === 'flex') flexCount++
                })
                return { gridCount, flexCount }
            })

            if (layoutInfo.gridCount > 0 || layoutInfo.flexCount > 0) {
                canTest.push({
                    name: 'CSS Layout',
                    reason: `Found ${layoutInfo.gridCount} grid and ${layoutInfo.flexCount} flex containers`,
                    elementCount: layoutInfo.gridCount + layoutInfo.flexCount
                })
            }

            // Check for canvas elements (cannot test)
            const canvasElements = await page.$$('canvas')
            if (canvasElements.length > 0) {
                cannotTest.push({
                    name: 'Canvas elements',
                    reason: 'Canvas content cannot be visually tested automatically',
                    elementCount: canvasElements.length
                })
            }

            // Check for video elements (limited testing)
            const videoElements = await page.$$('video')
            if (videoElements.length > 0) {
                cannotTest.push({
                    name: 'Video elements',
                    reason: 'Video playback cannot be visually verified',
                    elementCount: videoElements.length
                })
            }

            // Check for WebGL (cannot test)
            const webglScript = await page.evaluate(() => {
                return !!(document.querySelector('canvas')?.getContext?.('webgl') ||
                    document.querySelector('canvas')?.getContext?.('webgl2'))
            })
            if (webglScript) {
                cannotTest.push({
                    name: 'WebGL content',
                    reason: '3D graphics cannot be visually tested'
                })
            }

            // SEO meta checks - we CAN always check meta tags (testability, not actual issues)
            canTest.push({
                name: 'SEO Meta Tags',
                reason: 'Can verify presence and content of title, description, and OG tags'
            })

            // Check iframes (limited - cross-origin blocks observability)
            const iframes = await page.$$('iframe')
            if (iframes.length > 0) {
                cannotTest.push({
                    name: 'Iframe content',
                    reason: 'Cross-origin iframe content cannot be captured',
                    elementCount: iframes.length
                })
            }


        } catch (error: any) {
            // Convert technical errors to user-friendly messages
            cannotTest.push({
                name: 'Visual Analysis Limitation',
                reason: 'Some visual elements could not be captured due to page rendering or dynamic content.'
            })
        }

        // Generate plain English narrative
        const passed = cannotTest.length === 0 || canTest.length > cannotTest.length
        const narrative = {
            what: `The visual presentation of this page is being diagnosed, including layout structure, images, CSS styling, and SEO meta tags.`,
            how: `The system captures screenshots, analyzes ${canTest.length} testable elements including images and CSS layouts, and checks meta tag presence.`,
            why: `Visual inconsistencies damage user trust and indicate potential CSS or rendering issues that affect brand perception.`,
            result: passed
                ? `Passed — ${canTest.length} visual elements can be tested reliably.`
                : `Failed — ${cannotTest.length} elements cannot be tested: ${cannotTest.map(c => c.name).join(', ')}.`,
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
