import { Browser, BrowserType, chromium, firefox, webkit } from 'playwright'

/**
 * Singleton service to manage browser instances efficiently.
 * Reuses browser processes to reuse startup overhead.
 */
export class BrowserManager {
    private static instance: BrowserManager
    private browsers: Map<string, Browser> = new Map()
    private closing: boolean = false

    private constructor() { }

    static getInstance(): BrowserManager {
        if (!BrowserManager.instance) {
            BrowserManager.instance = new BrowserManager()
        }
        return BrowserManager.instance
    }

    /**
     * Get a browser instance for the specified type.
     * Launches it if it complicates doesn't exist.
     */
    async getBrowser(type: 'chromium' | 'firefox' | 'webkit'): Promise<Browser> {
        if (this.closing) {
            throw new Error('BrowserManager is shutting down')
        }

        if (this.browsers.has(type)) {
            const browser = this.browsers.get(type)!
            if (browser.isConnected()) {
                return browser
            }
            // If disconnected, clear and relaunch
            this.browsers.delete(type)
        }

        console.log(`[BrowserManager] Launching new ${type} instance...`)
        const browserType = this.getBrowserType(type)

        // Launch options optimized for performance and headless execution
        const browser = await browserType.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote',
            ]
        })

        this.browsers.set(type, browser)
        return browser
    }

    private getBrowserType(type: 'chromium' | 'firefox' | 'webkit'): BrowserType {
        switch (type) {
            case 'firefox': return firefox
            case 'webkit': return webkit
            default: return chromium
        }
    }

    /**
     * Close all active browser instances.
     * Should be called on worker shutdown.
     */
    async closeAll(): Promise<void> {
        this.closing = true
        console.log('[BrowserManager] Closing all browsers...')

        const promises: Promise<void>[] = []

        for (const [type, browser] of this.browsers.entries()) {
            if (browser.isConnected()) {
                promises.push(
                    browser.close()
                        .catch(err => console.warn(`[BrowserManager] Failed to close ${type}:`, err))
                )
            }
        }

        await Promise.all(promises)
        this.browsers.clear()
        this.closing = false
        console.log('[BrowserManager] All browsers closed')
    }
}
