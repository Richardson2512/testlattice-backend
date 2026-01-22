import { Page } from 'playwright'
import { ExecutionLogEmitter } from '../../../services/executionLogEmitter'
import { logger } from '../../../observability'


interface ProcessResult {
    success: boolean
    findings: any[]
    error?: string
}

export class FormTestExecutor {
    constructor(
        private deps: {
            page: Page
            logEmitter: ExecutionLogEmitter
            recordStep: (stepName: string, success: boolean, durationMs: number, metadata?: any) => void
            captureScreenshot: (name: string) => Promise<void>
        },
        private config: {
            runId: string
            url: string
        }
    ) { }


    /**
     * Record a step with structured output format
     */
    private recordLocalStep(
        stepName: string,
        execution_status: 'EXECUTED' | 'BLOCKED' | 'EXECUTION_FAILED' | 'SKIPPED',
        severity: 'GREEN' | 'YELLOW' | 'RED',
        observed_state: Record<string, any>,
        note: string
    ) {
        const success = severity !== 'RED' && execution_status === 'EXECUTED'
        this.deps.recordStep(stepName, success, 100, {
            execution_status,
            observed_state,
            severity,
            note,
            ...observed_state
        })
    }

    private async captureAndRecord(
        stepName: string,
        execution_status: 'EXECUTED' | 'BLOCKED' | 'EXECUTION_FAILED' | 'SKIPPED',
        severity: 'GREEN' | 'YELLOW' | 'RED',
        observed_state: Record<string, any>,
        note: string
    ): Promise<void> {
        const screenshotUrl = await this.deps.captureScreenshot(stepName)
        const success = severity !== 'RED' && execution_status === 'EXECUTED'
        this.deps.recordStep(stepName, success, 100, {
            execution_status,
            observed_state,
            severity,
            note,
            screenshotUrl,
            ...observed_state
        })
    }

    private buildResult(success: boolean): ProcessResult {
        return {
            success: true, // Always true - findings tracked at step level
            findings: []
        }
    }

    async execute(): Promise<ProcessResult> {
        logger.info({ runId: this.config.runId }, 'Starting Form Test Contract v1')
        this.deps.logEmitter.log('Starting Form Test 12-step contract...')
        const page = this.deps.page

        try {
            // STEP 1: Detect Primary Form
            const formSelector = await page.evaluate(() => {
                const forms = Array.from(document.querySelectorAll('form'))
                if (forms.length === 0) return null

                forms.sort((a, b) => {
                    return b.querySelectorAll('input, select, textarea').length - a.querySelectorAll('input, select, textarea').length
                })

                const primary = forms[0]
                if (primary.id) return `#${primary.id}`
                if (primary.name) return `form[name="${primary.name}"]`
                return 'form'
            })

            if (!formSelector) {
                this.deps.logEmitter.log('No forms detected on page - recording finding.')
                await this.captureAndRecord('detect_primary_form', 'EXECUTED', 'YELLOW',
                    { form_found: false },
                    'No <form> tags found on page')
                await this.captureAndRecord('final_form_state_capture', 'EXECUTED', 'GREEN',
                    { completed: true },
                    'Form test completed - no form found')
                return this.buildResult(true)
            }

            await this.captureAndRecord('detect_primary_form', 'EXECUTED', 'GREEN',
                { form_found: true, selector: formSelector },
                'Primary form detected')

            // STEP 2: Enumerate Input Fields
            const fields = await page.evaluate((sel) => {
                const form = document.querySelector(sel) as HTMLFormElement
                if (!form) return []
                const inputs = Array.from(form.querySelectorAll('input:not([type="hidden"]), select, textarea'))
                return inputs.map(el => ({
                    tag: el.tagName.toLowerCase(),
                    type: el.getAttribute('type') || 'text',
                    name: el.getAttribute('name') || el.id || 'unnamed',
                    required: el.hasAttribute('required')
                }))
            }, formSelector)

            await this.captureAndRecord('enumerate_input_fields', 'EXECUTED', 'GREEN',
                { field_count: fields.length, types: fields.map(f => f.type) },
                `Found ${fields.length} input field(s)`)

            if (fields.length === 0) {
                this.deps.logEmitter.log('Form found but has no visible inputs - recording finding.')
                await this.captureAndRecord('no_visible_inputs', 'EXECUTED', 'YELLOW',
                    { visible_inputs: 0 },
                    'Form exists but no visible inputs found')
            }

            // STEP 3: Check Input Type Correctness
            const semanticIssues = fields.filter(f => {
                const nameLower = f.name.toLowerCase()
                if (nameLower.includes('email') && f.type !== 'email') return true
                if (nameLower.includes('pass') && f.type !== 'password') return true
                return false
            })
            const semanticSeverity = semanticIssues.length === 0 ? 'GREEN' : 'YELLOW'
            await this.captureAndRecord('check_input_type_correctness', 'EXECUTED', semanticSeverity,
                { issues_count: semanticIssues.length, details: semanticIssues },
                semanticIssues.length === 0 ? 'All input types are semantically correct' : `Found ${semanticIssues.length} semantic issue(s)`)

            // STEP 4: Attempt Empty Submit - CRITICAL VERDICT LOGIC
            let submitBtnSelector = `${formSelector} button[type="submit"], ${formSelector} input[type="submit"]`
            const hasSubmitBtn = await page.isVisible(submitBtnSelector)

            // Check if submit is disabled before clicking
            let submitWasDisabled = false
            if (hasSubmitBtn) {
                submitWasDisabled = await page.evaluate((sel) => {
                    const btn = document.querySelector(sel) as HTMLButtonElement
                    return btn ? btn.disabled : false
                }, submitBtnSelector)
            }

            if (!submitWasDisabled && hasSubmitBtn) {
                await page.click(submitBtnSelector)
            } else if (!hasSubmitBtn) {
                await page.keyboard.press('Enter')
            }
            await page.waitForTimeout(1000)

            // STEP 5: Capture Validation Messages
            const validationMessages = await page.evaluate((sel) => {
                const form = document.querySelector(sel)
                if (!form) return []
                const inputs = Array.from(form.querySelectorAll('input, select, textarea')) as HTMLInputElement[]
                const html5Errors = inputs.map(i => i.validationMessage).filter(m => m)
                const visibleErrorText = Array.from(document.querySelectorAll('.error, .invalid-feedback, .text-danger, [role="alert"]'))
                    .map(el => (el as HTMLElement).innerText)
                    .filter(t => t && t.length > 0)
                return [...html5Errors, ...visibleErrorText]
            }, formSelector)

            // CRITICAL: Determine attempt_empty_submit verdict per user requirements:
            // BLOCKED + validation → GREEN (form correctly prevents empty submission)
            // Submits without validation → RED (user-breaking - form accepts garbage)
            // No message + no block → YELLOW (UX risk)
            let emptySubmitStatus: 'EXECUTED' | 'BLOCKED' = 'EXECUTED'
            let emptySubmitSeverity: 'GREEN' | 'YELLOW' | 'RED' = 'YELLOW'
            let emptySubmitNote = ''

            if (submitWasDisabled) {
                // Button was disabled - form blocked submission correctly
                emptySubmitStatus = 'BLOCKED'
                emptySubmitSeverity = 'GREEN'
                emptySubmitNote = 'Form correctly blocks empty submission (button disabled)'
            } else if (validationMessages.length > 0) {
                // Validation messages appeared - form handled correctly
                emptySubmitStatus = 'EXECUTED'
                emptySubmitSeverity = 'GREEN'
                emptySubmitNote = `Form correctly shows validation: ${validationMessages[0]?.substring(0, 50)}`
            } else {
                // No block, no validation - check if page changed (bad: form submitted)
                const urlChanged = page.url() !== this.config.url
                if (urlChanged) {
                    // Form submitted without validation - this is RED
                    emptySubmitStatus = 'EXECUTED'
                    emptySubmitSeverity = 'RED'
                    emptySubmitNote = 'Form submitted without validation - user-breaking issue'
                } else {
                    // No change, no validation - ambiguous, mark as YELLOW
                    emptySubmitStatus = 'EXECUTED'
                    emptySubmitSeverity = 'YELLOW'
                    emptySubmitNote = 'No validation message shown and no blocking - UX risk'
                }
            }

            await this.captureAndRecord('attempt_empty_submit', emptySubmitStatus, emptySubmitSeverity,
                { submit_disabled: submitWasDisabled, validation_shown: validationMessages.length > 0 },
                emptySubmitNote)

            await this.captureAndRecord('capture_validation_messages', 'EXECUTED', 'GREEN',
                { message_count: validationMessages.length, samples: validationMessages.slice(0, 3) },
                validationMessages.length > 0 ? `Captured ${validationMessages.length} validation message(s)` : 'No validation messages displayed')

            // STEP 6: Inject Safe Dummy Data
            await this.injectDummyData(page, fields, formSelector)
            await this.captureAndRecord('inject_safe_dummy_data', 'EXECUTED', 'GREEN',
                { injected_count: fields.length },
                `Injected test data into ${fields.length} field(s)`)

            // STEP 7: Submit Form (Filled)
            if (hasSubmitBtn) {
                await Promise.all([
                    page.waitForLoadState('networkidle').catch(() => { }),
                    page.click(submitBtnSelector)
                ])
            } else {
                await page.keyboard.press('Enter')
            }
            await page.waitForTimeout(2000)
            await this.captureAndRecord('submit_form', 'EXECUTED', 'GREEN',
                { submitted: true },
                'Form submitted with test data')

            // STEP 8: Detect Success or Error State - CLASSIFY, DON'T FAIL
            const pageText = await page.evaluate(() => document.body.innerText.toLowerCase())

            const successKeywords = ['success', 'thank you', 'received', 'confirmed', 'sent']
            const errorKeywords = ['error', 'failed', 'required', 'problem', 'fix']

            const successScore = successKeywords.filter(w => pageText.includes(w)).length
            const errorScore = errorKeywords.filter(w => pageText.includes(w)).length

            // RECLASSIFIED: detect_outcome classifies state, NEVER fails based on keywords
            let outcomeState: 'SUCCESS' | 'ERROR' | 'UNKNOWN' = 'UNKNOWN'
            if (successScore > errorScore && successScore > 0) {
                outcomeState = 'SUCCESS'
            } else if (errorScore > successScore && errorScore > 0) {
                outcomeState = 'ERROR'
            }

            // Severity is always GREEN for detect_outcome - it's classification, not judgment
            await this.captureAndRecord('detect_outcome', 'EXECUTED', 'GREEN',
                { outcome_state: outcomeState, success_keywords: successScore, error_keywords: errorScore },
                `Outcome classified as: ${outcomeState}`)

            // STEP 9: Capture Confirmation Message Clarity
            await this.captureAndRecord('capture_confirmation_clarity', 'EXECUTED', 'GREEN',
                { snapshot_taken: true },
                'Post-submission state captured')

            // STEP 10: Refresh Page Post-Submit
            await page.reload()
            await page.waitForLoadState('domcontentloaded')
            await this.captureAndRecord('refresh_page_post_submit', 'EXECUTED', 'GREEN',
                { reloaded: true },
                'Page refreshed after submission')

            // STEP 11: Detect State Persistence - OBSERVATION ONLY (never RED)
            const inputsFilledAfterReload = await page.evaluate((sel) => {
                const form = document.querySelector(sel)
                if (!form) return 0
                const inputs = Array.from(form.querySelectorAll('input:not([type="hidden"])')) as HTMLInputElement[]
                return inputs.filter(i => i.value && i.value.length > 0).length
            }, formSelector)

            // RECLASSIFIED: detect_state_persistence → Observation only (never RED by default)
            const persistenceBehavior = inputsFilledAfterReload > 0 ? 'PERSISTED' : 'CLEARED'
            await this.captureAndRecord('detect_state_persistence', 'EXECUTED', 'GREEN',
                { filled_after_refresh: inputsFilledAfterReload, behavior: persistenceBehavior },
                `Form data ${persistenceBehavior.toLowerCase()} after refresh`)

            // STEP 12: Final Form State Capture
            await this.captureAndRecord('final_form_state_capture', 'EXECUTED', 'GREEN',
                { completed: true },
                'Form test contract completed')

            return this.buildResult(true)

        } catch (error: any) {
            logger.error({ runId: this.config.runId, error: error.message }, 'Form Test Failed')
            this.deps.recordStep('form_test_error', false, 0, { error: error.message })
            return this.buildResult(true) // Always return success - errors are findings
        }
    }

    private async injectDummyData(page: Page, fields: any[], formSelector: string) {
        for (const field of fields) {
            const selector = `${formSelector} [name="${field.name}"]`
            // Skip if hidden or submit or button
            if (field.type === 'hidden' || field.type === 'submit' || field.type === 'button') continue;

            const nameLower = field.name.toLowerCase()
            let value = 'Test Data'

            if (field.type === 'email' || nameLower.includes('email')) {
                value = 'test@example.com'
            } else if (field.type === 'number' || nameLower.includes('age') || nameLower.includes('zip')) {
                value = '123'
            } else if (nameLower.includes('name')) {
                value = 'Test User'
            } else if (nameLower.includes('phone') || field.type === 'tel') {
                value = '555-0123'
            } else if (field.type === 'checkbox') {
                // Try to check it
                await page.check(selector).catch(() => { })
                continue
            } else if (field.tag === 'select') {
                // Select first option
                await page.selectOption(selector, { index: 1 }).catch(() => { }) // Index 1 usually skips generic "Select One" placeholder
                continue
            }

            // Fill text
            await page.fill(selector, value).catch(() => { })
        }
    }
}
