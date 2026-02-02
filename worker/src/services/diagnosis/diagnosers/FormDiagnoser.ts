/**
 * Form Diagnoser
 * 
 * Analyzes form testability including:
 * - Form submission
 * - Data entry
 * - File upload
 * - Checkout flows
 * - Payment forms
 */

import { Page } from 'playwright'
import { IDiagnoser, TestTypeDiagnosis, CapabilityItem } from './IDiagnoser'

export class FormDiagnoser implements IDiagnoser {
    readonly testType = 'form'
    readonly steps = [
        'Enumerating all form elements',
        'Checking required field markers',
        'Detecting file upload zones',
        'Analyzing checkout/cart elements',
        'Mapping form submission buttons'
    ]

    async diagnose(page: Page): Promise<TestTypeDiagnosis> {
        const startTime = Date.now()
        const canTest: CapabilityItem[] = []
        const cannotTest: CapabilityItem[] = []

        try {
            // Count all forms
            const forms = await page.$$('form')
            if (forms.length > 0) {
                canTest.push({
                    name: 'Forms detected',
                    reason: 'Can test form submission flows',
                    elementCount: forms.length
                })
            }

            // Check input types
            const inputTypes = await page.evaluate(() => {
                const inputs = document.querySelectorAll('input, textarea, select')
                const types: Record<string, number> = {}
                inputs.forEach(input => {
                    const type = (input as HTMLInputElement).type || input.tagName.toLowerCase()
                    types[type] = (types[type] || 0) + 1
                })
                return types
            })

            const totalInputs = Object.values(inputTypes).reduce((a, b) => a + b, 0)
            if (totalInputs > 0) {
                canTest.push({
                    name: 'Input fields',
                    reason: `Found ${totalInputs} inputs: ${Object.entries(inputTypes).map(([k, v]) => `${v} ${k}`).join(', ')}`,
                    elementCount: totalInputs
                })
            }

            // Check for required fields
            const requiredFields = await page.$$('[required], [aria-required="true"]')
            if (requiredFields.length > 0) {
                canTest.push({
                    name: 'Required fields',
                    reason: 'Can test required field validation',
                    elementCount: requiredFields.length
                })
            }

            // Check for file upload
            const fileInputs = await page.$$('input[type="file"]')
            if (fileInputs.length > 0) {
                canTest.push({
                    name: 'File upload',
                    reason: 'Can test file upload functionality',
                    elementCount: fileInputs.length
                })
            }

            // Check for drag-drop zones
            const dropZones = await page.$$('[class*="dropzone"], [class*="drop-zone"], [class*="file-drop"]')
            if (dropZones.length > 0) {
                canTest.push({
                    name: 'Drag-drop zones',
                    reason: 'Can simulate file drag and drop',
                    elementCount: dropZones.length
                })
            }

            // Check for checkout/cart elements
            const cartElements = await page.$$('[class*="cart"], [class*="checkout"], [id*="cart"], [id*="checkout"]')
            if (cartElements.length > 0) {
                canTest.push({
                    name: 'Cart/Checkout elements',
                    reason: 'Can test checkout flow',
                    elementCount: cartElements.length
                })
            }

            // Check for payment iframes (blocker)
            const paymentIframes = await page.$$('iframe[src*="stripe"], iframe[src*="paypal"], iframe[src*="braintree"], iframe[src*="checkout"]')
            if (paymentIframes.length > 0) {
                cannotTest.push({
                    name: 'Payment gateway iframe',
                    reason: 'Cannot interact with cross-origin payment forms',
                    elementCount: paymentIframes.length
                })
            }

            // Check for payment card fields
            const creditCardFields = await page.$$('input[name*="card"], input[autocomplete*="cc-"], input[id*="card-number"]')
            if (creditCardFields.length > 0) {
                cannotTest.push({
                    name: 'Credit card fields',
                    reason: 'Payment testing requires sandbox credentials',
                    elementCount: creditCardFields.length
                })
            }

            // Check for date pickers
            const datePickers = await page.$$('input[type="date"], input[type="datetime-local"], [class*="datepicker"]')
            if (datePickers.length > 0) {
                canTest.push({
                    name: 'Date pickers',
                    reason: 'Can test date selection',
                    elementCount: datePickers.length
                })
            }

            // Check for rich text editors (limited)
            const richTextEditors = await page.$$('[contenteditable="true"], .ql-editor, .tox-edit-area, .cke_editable')
            if (richTextEditors.length > 0) {
                cannotTest.push({
                    name: 'Rich text editors',
                    reason: 'Limited testing for WYSIWYG editors',
                    elementCount: richTextEditors.length
                })
            }

            // Check for submit buttons
            const submitButtons = await page.$$('button[type="submit"], input[type="submit"], button:not([type])')
            if (submitButtons.length > 0) {
                canTest.push({
                    name: 'Submit buttons',
                    reason: 'Can trigger form submission',
                    elementCount: submitButtons.length
                })
            }

        } catch (error: any) {
            // Convert technical errors to user-friendly messages
            cannotTest.push({
                name: 'Form Analysis Limitation',
                reason: 'Some form elements could not be analyzed due to dynamic form generation or complex validation.'
            })
        }

        // Generate plain English narrative
        const hasPaymentBlocker = cannotTest.some(c => c.name.includes('Payment') || c.name.includes('Credit'))
        const hasForms = canTest.some(c => c.name.includes('Forms') || c.name.includes('Input'))
        const passed = hasForms && cannotTest.length < canTest.length

        const narrative = {
            what: `Form submission functionality is being diagnosed, including input fields, file uploads, and checkout flows on this page.`,
            how: `The system enumerates ${canTest.reduce((sum, c) => sum + (c.elementCount || 1), 0)} form elements including inputs, submit buttons, and validation markers.`,
            why: `Form submission failures prevent users from completing tasks and are a major cause of conversion drop-off.`,
            result: passed
                ? `Passed — ${canTest.length} form elements can be tested reliably.`
                : hasPaymentBlocker
                    ? `Failed — Payment gateway iframes block complete checkout testing.`
                    : `Failed — ${cannotTest.length} form elements have testing limitations.`,
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
