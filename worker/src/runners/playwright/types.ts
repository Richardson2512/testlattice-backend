// Playwright Runner Types
// Shared interfaces for the Playwright runner modules

import { Browser, Page, BrowserContext } from 'playwright'
import { TestProfile, SelfHealingInfo } from '../../types'

export interface RunnerSession {
    id: string
    profile: TestProfile
    startedAt: string
    browser: Browser
    context: BrowserContext
    page: Page
    videoPath?: string
    tracingStarted?: boolean
}

export interface HealingCandidate {
    selector: string
    strategy: SelfHealingInfo['strategy']
    note: string
    confidence: number
}

export const VIEWPORT_PRESETS: Record<string, { width: number; height: number }> = {
    'mobile-portrait': { width: 390, height: 844 },
    'mobile-landscape': { width: 844, height: 390 },
    'tablet-portrait': { width: 768, height: 1024 },
    'tablet-landscape': { width: 1024, height: 768 },
    'desktop': { width: 1920, height: 1080 },
    'desktop-small': { width: 1280, height: 720 },
    'desktop-large': { width: 2560, height: 1440 },
    'ultrawide': { width: 3440, height: 1440 },
}

// Re-export types from parent
export type { Browser, Page, BrowserContext, TestProfile, SelfHealingInfo }
