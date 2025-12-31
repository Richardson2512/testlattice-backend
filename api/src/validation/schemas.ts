/**
 * API Input Validation Schemas
 * Issue #12: Input validation with Zod
 * 
 * All API request bodies validated before processing.
 * Provides clear error messages for invalid input.
 */

import { z } from 'zod'

// Test Mode enum
export const TestModeSchema = z.enum([
    'single',
    'multi',
    'all',
    'monkey',
    'guest',
    'behavior',
])
export type TestModeType = z.infer<typeof TestModeSchema>

// URL validation with security checks
export const SafeUrlSchema = z.string()
    .url('Must be a valid URL')
    .refine(
        url => {
            const parsed = new URL(url)
            // Block internal/localhost URLs in production
            if (process.env.NODE_ENV === 'production') {
                const blocked = ['localhost', '127.0.0.1', '0.0.0.0', '::1']
                return !blocked.some(host => parsed.hostname.includes(host))
            }
            return true
        },
        { message: 'Localhost URLs only allowed in development' }
    )
    .refine(
        url => {
            const parsed = new URL(url)
            // Only allow http/https
            return ['http:', 'https:'].includes(parsed.protocol)
        },
        { message: 'Only HTTP and HTTPS protocols are allowed' }
    )

// Test run options
export const TestOptionsSchema = z.object({
    maxSteps: z.number().int().min(1).max(100).optional(),
    timeout: z.number().int().min(1000).max(300000).optional(),
    enableVision: z.boolean().optional(),
    enableDiagnosis: z.boolean().optional(),
}).optional()

// Create test run request
export const CreateTestRunSchema = z.object({
    url: SafeUrlSchema,
    testMode: TestModeSchema.optional().default('single'),
    options: TestOptionsSchema,
    pages: z.array(z.object({
        url: SafeUrlSchema,
        label: z.string().max(100).optional(),
    })).max(20).optional(),
    credentials: z.object({
        username: z.string().max(200).optional(),
        email: z.string().email().max(200).optional(),
        password: z.string().max(200).optional(),
    }).optional(),
})
export type CreateTestRunInput = z.infer<typeof CreateTestRunSchema>

// Guest test run request
export const CreateGuestTestSchema = z.object({
    url: SafeUrlSchema,
    testType: z.enum([
        'landing_page',
        'checkout_flow',
        'login_flow',
        'signup_flow',
        'search_flow',
        'product_page',
    ]).optional().default('landing_page'),
    guestSessionId: z.string().uuid().optional(),
    credentials: z.object({
        username: z.string().max(200).optional(),
        email: z.string().email().max(200).optional(),
        password: z.string().max(200).optional(),
    }).optional(),
})
export type CreateGuestTestInput = z.infer<typeof CreateGuestTestSchema>

// Update test run status
export const UpdateTestRunSchema = z.object({
    status: z.enum([
        'pending',
        'running',
        'completed',
        'failed',
        'cancelled',
        'paused',
    ]),
    error: z.string().max(5000).optional(),
    steps: z.array(z.any()).optional(), // Steps have complex structure
})
export type UpdateTestRunInput = z.infer<typeof UpdateTestRunSchema>

// Token usage save request
export const SaveTokenUsageSchema = z.object({
    testRunId: z.string().uuid(),
    testMode: z.string().max(50).optional(),
    model: z.string().max(100),
    promptTokens: z.number().int().min(0),
    completionTokens: z.number().int().min(0),
    totalTokens: z.number().int().min(0),
    apiCalls: z.number().int().min(0),
    estimatedCostUsd: z.number().min(0).optional(),
})
export type SaveTokenUsageInput = z.infer<typeof SaveTokenUsageSchema>

// Pagination params
export const PaginationSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
})
export type PaginationInput = z.infer<typeof PaginationSchema>

// Date range params
export const DateRangeSchema = z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    days: z.coerce.number().int().min(1).max(365).optional().default(30),
})
export type DateRangeInput = z.infer<typeof DateRangeSchema>

/**
 * Validate input and return result
 */
export function validateInput<T>(
    schema: z.ZodType<T>,
    data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
    const result = schema.safeParse(data)

    if (result.success) {
        return { success: true, data: result.data }
    }

    return { success: false, errors: result.error }
}

/**
 * Format Zod errors for user-friendly messages
 */
export function formatValidationErrors(errors: z.ZodError): string[] {
    return errors.issues.map(issue => {
        const path = issue.path.join('.')
        return path ? `${path}: ${issue.message}` : issue.message
    })
}

/**
 * Validate and throw if invalid (for use in route handlers)
 */
export function validateOrThrow<T>(schema: z.ZodType<T>, data: unknown): T {
    const result = schema.safeParse(data)

    if (!result.success) {
        const messages = formatValidationErrors(result.error)
        const error = new Error(`Validation failed: ${messages.join(', ')}`)
            ; (error as any).statusCode = 400
            ; (error as any).code = 'VALIDATION_ERROR'
            ; (error as any).userMessage = `Invalid input: ${messages.join(', ')}`
            ; (error as any).fields = result.error.issues.map(i => i.path.join('.'))
        throw error
    }

    return result.data
}
