// DOM Parser - Extracts interactive elements from HTML
// Uses cheerio for fast HTML parsing

import * as cheerio from 'cheerio'
import type { Element } from 'domhandler'
import { VisionElement, AccessibilityNode } from './types'

export class DOMParser {
    /**
     * Extract interactive elements from DOM HTML using cheerio parser
     */
    extractElements(html: string): { elements: VisionElement[]; hiddenCount: number } {
        const elements: VisionElement[] = []
        let hiddenCount = 0

        const sanitize = (value?: string | null): string | undefined => {
            if (!value) return undefined
            const trimmed = value.replace(/\s+/g, ' ').trim()
            return trimmed.length > 0 ? trimmed : undefined
        }

        const addElement = (element: VisionElement) => {
            if (element.isHidden) hiddenCount++
            elements.push(element)
        }

        const buildSelector = (el: cheerio.Cheerio<Element>, tagName: string, text?: string): string => {
            const id = el.attr('id')
            if (id) return `#${id}`

            const dataTestId = el.attr('data-testid')
            if (dataTestId) return `[data-testid="${dataTestId}"]`

            const dataId = el.attr('data-id')
            if (dataId) return `[data-id="${dataId}"]`

            if (tagName === 'a') {
                const href = el.attr('href')
                if (href) return `a[href="${href.replace(/"/g, '\\"')}"]`
            }

            if (tagName === 'input') {
                const name = el.attr('name')
                if (name) return `[name="${name}"]`

                const placeholder = el.attr('placeholder')
                if (placeholder) return `input[placeholder="${placeholder.replace(/"/g, '\\"')}"]`

                const type = el.attr('type') || 'text'
                return `input[type="${type}"]`
            }

            if (tagName === 'select') {
                const name = el.attr('name')
                if (name) return `select[name="${name}"]`
            }

            if (tagName === 'button') {
                const ariaLabel = el.attr('aria-label')
                if (ariaLabel) return `button[aria-label="${ariaLabel.replace(/"/g, '\\"')}"]`

                const type = el.attr('type')
                if (type) return `button[type="${type}"]`
            }

            if (text) {
                return `${tagName}:has-text("${text.replace(/"/g, '\\"')}")`
            }

            const index = elements.filter((e) => e.type === tagName).length + 1
            return `${tagName}:nth-of-type(${index})`
        }

        const isElementHidden = (el: cheerio.Cheerio<Element>): boolean => {
            const type = el.attr('type')
            if (type === 'hidden') return true

            const ariaHidden = el.attr('aria-hidden')
            if (ariaHidden === 'true') return true

            const hidden = el.attr('hidden')
            if (hidden !== undefined) return true

            const style = el.attr('style')
            if (style && (style.includes('display:none') || style.includes('visibility:hidden'))) {
                return true
            }

            return false
        }

        try {
            // Prune DOM before parsing: remove script/style tags and comments
            let prunedHtml = html
            prunedHtml = prunedHtml.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            prunedHtml = prunedHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            prunedHtml = prunedHtml.replace(/<!--[\s\S]*?-->/g, '')
            
            const $ = cheerio.load(prunedHtml, { xml: false })

            // Extract buttons
            $('button').each((_index: number, element: Element) => {
                const $el = $(element)
                const text = sanitize($el.text())
                const hidden = isElementHidden($el)
                const selector = buildSelector($el, 'button', text)

                addElement({
                    type: 'button',
                    role: 'button',
                    text,
                    name: text || sanitize($el.attr('aria-label')),
                    ariaLabel: sanitize($el.attr('aria-label')),
                    selector,
                    bounds: { x: 0, y: 0, width: 120, height: 40 },
                    isHidden: hidden,
                })
            })

            // Extract inputs
            $('input').each((_index: number, element: Element) => {
                const $el = $(element)
                const inputType = ($el.attr('type') || 'text').toLowerCase()
                const hidden = inputType === 'hidden' || isElementHidden($el)
                const isRequired = $el.attr('required') !== undefined || $el.attr('aria-required') === 'true'
                const minLengthAttr = $el.attr('minlength')
                const maxLengthAttr = $el.attr('maxlength')
                const minLength = minLengthAttr ? parseInt(minLengthAttr, 10) : undefined
                const maxLength = maxLengthAttr ? parseInt(maxLengthAttr, 10) : undefined
                const pattern = $el.attr('pattern') || undefined
                const selector = buildSelector($el, 'input')
                const role =
                    inputType === 'checkbox'
                        ? 'checkbox'
                        : inputType === 'radio'
                            ? 'radio'
                            : inputType === 'submit'
                                ? 'button'
                                : 'textbox'

                addElement({
                    type: hidden ? 'hidden-input' : 'input',
                    inputType,
                    role,
                    text: sanitize($el.attr('placeholder')),
                    name: sanitize($el.attr('placeholder')) || sanitize($el.attr('name')),
                    ariaLabel: sanitize($el.attr('aria-label')),
                    selector,
                    bounds: { x: 0, y: 0, width: 300, height: 40 },
                    isHidden: hidden,
                    isRequired,
                    minLength,
                    maxLength,
                    pattern,
                })
            })

            // Extract links
            $('a').each((_index: number, element: Element) => {
                const $el = $(element)
                const text = sanitize($el.text())
                const href = $el.attr('href') || ''
                const hidden = isElementHidden($el)
                const selector = buildSelector($el, 'a', text)

                if (!selector) return

                addElement({
                    type: 'link',
                    role: 'link',
                    text,
                    name: text || sanitize($el.attr('aria-label')),
                    ariaLabel: sanitize($el.attr('aria-label')),
                    selector,
                    bounds: { x: 0, y: 0, width: 100, height: 20 },
                    isHidden: hidden,
                    href: href || undefined,
                })
            })

            // Extract select dropdowns
            $('select').each((_index: number, element: Element) => {
                const $el = $(element)
                if (isElementHidden($el)) return

                const selector = buildSelector($el, 'select')

                addElement({
                    type: 'select',
                    role: 'combobox',
                    selector,
                    bounds: { x: 0, y: 0, width: 200, height: 40 },
                })
            })
        } catch (error: any) {
            console.warn('DOMParser: Error extracting elements:', error.message)
        }

        return { elements, hiddenCount }
    }

    /**
     * Build accessibility summary from elements
     */
    buildAccessibilitySummary(elements: VisionElement[], limit?: number): AccessibilityNode[] {
        const nodes: AccessibilityNode[] = []
        const accessibilityLimit = limit || Math.max(parseInt(process.env.ACCESSIBILITY_SUMMARY_LIMIT || '40', 10), 5)

        const isInteractive = (element: VisionElement): boolean => {
            return ['button', 'link', 'input', 'select'].includes(element.type)
        }

        for (const element of elements) {
            const issues: string[] = []
            const hasLabel = Boolean(element.text || element.ariaLabel || element.name)

            if (isInteractive(element) && !hasLabel && !element.isHidden) {
                issues.push('missing_label')
            }

            if (element.isHidden) {
                issues.push('hidden')
            }

            if (issues.length > 0) {
                nodes.push({
                    role: element.role || element.type,
                    name: element.text || element.ariaLabel || element.name,
                    selector: element.selector,
                    issues,
                })
            }

            if (nodes.length >= accessibilityLimit) {
                break
            }
        }

        return nodes
    }
}
