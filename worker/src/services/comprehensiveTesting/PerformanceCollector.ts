// Performance Collector - Collects Core Web Vitals and Page Performance Metrics

import { Page } from 'playwright'
import { PerformanceMetrics } from './types'

export class PerformanceCollector {
    /**
     * Collect performance metrics including Core Web Vitals
     */
    async collect(page: Page): Promise<PerformanceMetrics> {
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
                slowResources: slowResources.slice(0, 10),
                duplicateScripts: Array.from(new Set(duplicateScripts))
            }
        })

        return metrics
    }
}
