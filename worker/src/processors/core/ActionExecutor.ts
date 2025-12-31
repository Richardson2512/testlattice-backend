/**
 * Action Executor Mixin
 * Issue #1, #4: Shared action execution logic
 * 
 * Extracted from testProcessor and GuestTestProcessor.
 * Handles element interaction with retry logic.
 */

import { Page, Locator } from 'playwright'
import { logger } from '../../observability'
import { TIMEOUTS } from '../../config/constants'
import { LLMAction, VisionContext } from '../../types' // Import LLMAction

export interface ActionResult {
    success: boolean
    duration: number
    error?: string
    screenshot?: string
}

export interface ActionOptions {
    timeout?: number
    retries?: number
    screenshot?: boolean
}

/**
 * Execute a click action
 */
export async function executeClick(
    page: Page,
    selector: string,
    options: ActionOptions = {}
): Promise<ActionResult> {
    const start = Date.now()
    const timeout = options.timeout || TIMEOUTS.ACTION_DEFAULT
    const retries = options.retries ?? 2

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const element = page.locator(selector).first()

            // Wait for element to be visible
            await element.waitFor({ state: 'visible', timeout })

            // Scroll into view
            await element.scrollIntoViewIfNeeded()

            // Click
            await element.click({ timeout })

            return {
                success: true,
                duration: Date.now() - start,
            }
        } catch (error: any) {
            if (attempt === retries) {
                return {
                    success: false,
                    duration: Date.now() - start,
                    error: error.message,
                }
            }
            // Wait before retry
            await page.waitForTimeout(500)
        }
    }

    return {
        success: false,
        duration: Date.now() - start,
        error: 'Max retries exceeded',
    }
}

/**
 * Execute a type action
 */
export async function executeType(
    page: Page,
    selector: string,
    value: string,
    options: ActionOptions = {}
): Promise<ActionResult> {
    const start = Date.now()
    const timeout = options.timeout || TIMEOUTS.ACTION_INPUT

    try {
        const element = page.locator(selector).first()

        // Wait for element
        await element.waitFor({ state: 'visible', timeout })

        // Clear existing value
        await element.clear()

        // Type with human-like delay
        await element.type(value, { delay: 50 })

        return {
            success: true,
            duration: Date.now() - start,
        }
    } catch (error: any) {
        return {
            success: false,
            duration: Date.now() - start,
            error: error.message,
        }
    }
}

/**
 * Execute a navigation action
 */
export async function executeNavigation(
    page: Page,
    url: string,
    options: ActionOptions = {}
): Promise<ActionResult> {
    const start = Date.now()
    const timeout = options.timeout || TIMEOUTS.ACTION_NAVIGATION

    try {
        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout,
        })

        return {
            success: true,
            duration: Date.now() - start,
        }
    } catch (error: any) {
        return {
            success: false,
            duration: Date.now() - start,
            error: error.message,
        }
    }
}

/**
 * Execute a scroll action
 */
export async function executeScroll(
    page: Page,
    direction: 'up' | 'down' = 'down',
    distance: number = 300
): Promise<ActionResult> {
    const start = Date.now()

    try {
        const deltaY = direction === 'down' ? distance : -distance
        await page.mouse.wheel(0, deltaY)
        await page.waitForTimeout(300)

        return {
            success: true,
            duration: Date.now() - start,
        }
    } catch (error: any) {
        return {
            success: false,
            duration: Date.now() - start,
            error: error.message,
        }
    }
}

/**
 * Execute a select action
 */
export async function executeSelect(
    page: Page,
    selector: string,
    value: string,
    options: ActionOptions = {}
): Promise<ActionResult> {
    const start = Date.now()
    const timeout = options.timeout || TIMEOUTS.ACTION_DEFAULT

    try {
        const element = page.locator(selector).first()
        await element.waitFor({ state: 'visible', timeout })
        await element.selectOption(value)

        return {
            success: true,
            duration: Date.now() - start,
        }
    } catch (error: any) {
        return {
            success: false,
            duration: Date.now() - start,
            error: error.message,
        }
    }
}

/**
 * Execute a hover action
 */
export async function executeHover(
    page: Page,
    selector: string,
    options: ActionOptions = {}
): Promise<ActionResult> {
    const start = Date.now()
    const timeout = options.timeout || TIMEOUTS.ACTION_DEFAULT

    try {
        const element = page.locator(selector).first()
        await element.waitFor({ state: 'visible', timeout })
        await element.hover()

        return {
            success: true,
            duration: Date.now() - start,
        }
    } catch (error: any) {
        return {
            success: false,
            duration: Date.now() - start,
            error: error.message,
        }
    }
}

/**
 * Execute a keyboard press action
 */
export async function executePress(
    page: Page,
    key: string
): Promise<ActionResult> {
    const start = Date.now()

    try {
        await page.keyboard.press(key)

        return {
            success: true,
            duration: Date.now() - start,
        }
    } catch (error: any) {
        return {
            success: false,
            duration: Date.now() - start,
            error: error.message,
        }
    }
}

/**
 * Wait for page to stabilize
 */
export async function waitForPageStable(
    page: Page,
    timeout: number = TIMEOUTS.PAGE_STABLE
): Promise<void> {
    try {
        await page.waitForLoadState('networkidle', { timeout })
    } catch {
        // Network idle timeout is okay
    }
}

/**
 * Legacy functional executor
 */
export async function executeAction(
    page: Page,
    action: string,
    selector?: string,
    value?: string,
    options: ActionOptions = {}
): Promise<ActionResult> {
    switch (action.toLowerCase()) {
        case 'click':
            if (!selector) return { success: false, duration: 0, error: 'Selector required' }
            return executeClick(page, selector, options)

        case 'type':
        case 'input':
            if (!selector || !value) return { success: false, duration: 0, error: 'Selector and value required' }
            return executeType(page, selector, value, options)

        case 'navigate':
        case 'goto':
            if (!value) return { success: false, duration: 0, error: 'URL required' }
            return executeNavigation(page, value, options)

        case 'scroll':
            return executeScroll(page, value as 'up' | 'down')

        case 'select':
            if (!selector || !value) return { success: false, duration: 0, error: 'Selector and value required' }
            return executeSelect(page, selector, value, options)

        case 'hover':
            if (!selector) return { success: false, duration: 0, error: 'Selector required' }
            return executeHover(page, selector, options)

        case 'press':
            if (!value) return { success: false, duration: 0, error: 'Key required' }
            return executePress(page, value)

        case 'wait':
            await page.waitForTimeout(parseInt(value || '1000', 10))
            return { success: true, duration: parseInt(value || '1000', 10) }

        default:
            return { success: false, duration: 0, error: `Unknown action: ${action}` }
    }
}

/**
 * Action Executor Class
 * Wraps execution logic and adapts LLMAction
 */
export class ActionExecutor {
    constructor(private page: Page) { }

    async execute(
        action: LLMAction,
        context: VisionContext
    ): Promise<ActionResult> {
        logger.info(`ActionExecutor: Executing ${action.action} on ${action.selector || action.target || 'page'}`)

        // Map LLMAction to executeAction arguments
        return executeAction(
            this.page,
            action.action,
            action.selector || action.target,
            action.value,
            { timeout: 30000 } // Default timeout from config
        )
    }
}
