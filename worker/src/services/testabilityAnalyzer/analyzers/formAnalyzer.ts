/**
 * Form Analyzer
 * 
 * Analyzes a page's form capability - what will work, what might be flaky,
 * and what won't work for form testing.
 */

import { Page } from 'playwright'
import { TestTypeCapability, LightweightAccessibilityMap, CapabilityItem } from '../types'

const FORM_ELEMENT_TYPES = {
    inputs: [
        'input[type="text"]',
        'input[type="email"]',
        'input[type="tel"]',
        'input[type="number"]',
        'input[type="url"]',
        'input[type="search"]',
        'input:not([type])',
    ],
    textareas: ['textarea'],
    selects: ['select'],
    checkboxes: ['input[type="checkbox"]'],
    radios: ['input[type="radio"]'],
    files: ['input[type="file"]'],
    dates: [
        'input[type="date"]',
        'input[type="datetime-local"]',
        'input[type="time"]',
    ],
    submit: [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Submit")',
        'button:has-text("Save")',
        'button:has-text("Send")',
    ],
}

const FLAKY_PATTERNS = {
    richTextEditors: [
        '.ql-editor',           // Quill
        '.tox-edit-area',       // TinyMCE
        '.ck-editor',           // CKEditor
        '[contenteditable="true"]',
        '.ProseMirror',         // ProseMirror
        '.CodeMirror',          // CodeMirror
    ],
    dateTimePickers: [
        '.react-datepicker',
        '.flatpickr-calendar',
        '.daterangepicker',
        '[data-datepicker]',
    ],
    autocomplete: [
        '[role="combobox"]',
        '[data-autocomplete]',
        '.autocomplete',
        '.typeahead',
    ],
    dragDrop: [
        '[draggable="true"]',
        '.dropzone',
        '[data-dnd]',
    ],
}

export async function analyzeFormCapability(
    page: Page,
    accessibilityMap: LightweightAccessibilityMap
): Promise<TestTypeCapability> {
    const testable: CapabilityItem[] = []
    const conditionallyTestable: CapabilityItem[] = []
    const notTestable: CapabilityItem[] = []
    const conditions: string[] = []
    const reasons: string[] = []

    try {
        // Analyze standard form elements
        for (const [category, selectors] of Object.entries(FORM_ELEMENT_TYPES)) {
            for (const selector of selectors) {
                const elements = await page.$$(selector)
                for (const element of elements) {
                    const isVisible = await element.isVisible().catch(() => false)
                    if (isVisible) {
                        const name = await element.getAttribute('name') ||
                            await element.getAttribute('id') ||
                            await element.getAttribute('placeholder') ||
                            category
                        testable.push({
                            name: `${category}: ${name}`.slice(0, 50),
                            selector,
                            reason: 'Standard form element',
                            elementType: category === 'submit' ? 'button' : 'input',
                        })
                    }
                }
            }
        }

        // Check for flaky elements
        for (const [category, selectors] of Object.entries(FLAKY_PATTERNS)) {
            for (const selector of selectors) {
                const element = await page.$(selector)
                if (element) {
                    const isVisible = await element.isVisible().catch(() => false)
                    if (isVisible) {
                        conditionallyTestable.push({
                            name: category.replace(/([A-Z])/g, ' $1').trim(),
                            selector,
                            reason: `${category} may have non-standard interaction patterns`,
                            elementType: 'other',
                        })

                        // Add specific conditions
                        if (category === 'richTextEditors') {
                            conditions.push('Rich text editors may require special handling')
                        } else if (category === 'dateTimePickers') {
                            conditions.push('Date pickers may have animation delays')
                        } else if (category === 'autocomplete') {
                            conditions.push('Autocomplete requires waiting for suggestions')
                        } else if (category === 'dragDrop') {
                            conditions.push('Drag and drop requires mouse simulation')
                        }
                    }
                }
            }
        }

        // Check for file uploads (conditionally testable)
        const fileInputs = await page.$$('input[type="file"]')
        for (const fileInput of fileInputs) {
            const isVisible = await fileInput.isVisible().catch(() => false)
            const name = await fileInput.getAttribute('name') || 'file'

            // File inputs are often hidden with a label overlay
            if (!isVisible) {
                conditionallyTestable.push({
                    name: `File upload: ${name}`,
                    selector: `input[type="file"][name="${name}"]`,
                    reason: 'Hidden file input - may require label click',
                    elementType: 'input',
                })
                conditions.push('File uploads may require clicking a label or button')
            }
        }

        // Check for forms without action (might use JS submission)
        const forms = await page.$$('form')
        for (const form of forms) {
            const action = await form.getAttribute('action')
            if (!action) {
                conditions.push('Form uses JavaScript submission (no action attribute)')
            }
        }

        // Determine confidence
        const hasBasicForm = testable.length >= 2 // At least one input and submit

        if (testable.length === 0 && conditionallyTestable.length === 0) {
            notTestable.push({
                name: 'Form elements',
                reason: 'No form elements detected on this page',
            })
            reasons.push('This page does not contain form elements')
        }

        return {
            testType: 'form_submission',
            testable: {
                elements: testable.slice(0, 20), // Limit to avoid huge output
                confidence: hasBasicForm ? 'high' : 'medium',
            },
            conditionallyTestable: {
                elements: conditionallyTestable,
                conditions: [...new Set(conditions)], // Dedupe
                confidence: conditionallyTestable.length > 0 ? 'medium' : 'low',
            },
            notTestable: {
                elements: notTestable,
                reasons,
            },
        }
    } catch (error) {
        console.error('Form analysis error:', error)
        return {
            testType: 'form_submission',
            testable: { elements: [], confidence: 'medium' },
            conditionallyTestable: { elements: [], conditions: [], confidence: 'low' },
            notTestable: { elements: [], reasons: ['Analysis failed: ' + (error as Error).message] },
        }
    }
}
