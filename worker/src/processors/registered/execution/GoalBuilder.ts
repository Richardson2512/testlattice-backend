/**
 * GoalBuilder
 * Extracted from testProcessor.ts
 * Builds test goals from options and selected test types
 */

import { TestOptions } from '../../../types'

// ============================================================================
// Goal Building Logic
// ============================================================================

export interface GoalBuilderParams {
    options: TestOptions | undefined
    buildUrl: string | undefined
    userInstructions?: string
}

export interface GoalBuilderResult {
    goal: string
    isMonkeyMode: boolean
    isAllPagesMode: boolean
    selectedTestTypes: string[] | undefined
    testCredentials: { username?: string; email?: string; password?: string } | undefined
    hasUserInstructions: boolean
}

/**
 * Build test goal from options and test types
 */
export function buildTestGoal(params: GoalBuilderParams): GoalBuilderResult {
    const { options, buildUrl, userInstructions } = params

    const isMonkeyMode = options?.monkeyMode || options?.testMode === 'monkey'
    const isAllPagesMode = options?.allPages || options?.testMode === 'all'
    const selectedTestTypes = options?.selectedTestTypes as string[] | undefined
    const testCredentials = options?.guestCredentials as { username?: string; email?: string; password?: string } | undefined
    const hasUserInstructions = !!userInstructions

    let goal = ''

    // Priority 1: User instructions
    if (userInstructions) {
        if (options?.allPages || options?.testMode === 'all') {
            goal = `USER INSTRUCTIONS (PRIORITY): ${userInstructions}\n\nAdditionally, navigate through all specified pages and test functionality.`
        } else {
            goal = `USER INSTRUCTIONS (PRIORITY): ${userInstructions}`
        }
    }
    // Priority 2: Monkey mode
    else if (isMonkeyMode) {
        goal = 'MONKEY TEST MODE: Explore the application randomly to surface crashes, console errors, and unexpected behavior. Prioritize variety over precision.'
    }
    // Priority 3: Selected test types (registered user)
    else if (selectedTestTypes && selectedTestTypes.length > 0) {
        const testGoals = buildGoalsFromTestTypes(selectedTestTypes, testCredentials)
        if (testGoals.length > 0) {
            goal = `REGISTERED USER TESTS - Execute the following test types:\n\n${testGoals.map((g, i) => `${i + 1}. ${g}`).join('\n\n')}`
        }
    }
    // Priority 4: Mode-based defaults
    else if (isAllPagesMode) {
        goal = `Discover and test all pages on the website starting from ${buildUrl}. Navigate through all internal links, test each page, and ensure all pages are functional.`
    } else if (options?.testMode === 'multi') {
        goal = 'Navigate through all specified pages and test functionality.'
    } else {
        goal = 'Perform basic user flow test'
    }

    return {
        goal,
        isMonkeyMode,
        isAllPagesMode,
        selectedTestTypes,
        testCredentials,
        hasUserInstructions,
    }
}

/**
 * Build goal strings from selected test types
 */
function buildGoalsFromTestTypes(
    testTypes: string[],
    credentials?: { username?: string; email?: string; password?: string }
): string[] {
    const testGoals: string[] = []

    for (const testType of testTypes) {
        switch (testType) {
            case 'visual':
                testGoals.push('VISUAL: Explore UI elements, take screenshots, check for visual consistency and rendering issues.')
                break
            case 'login':
                const loginUsername = credentials?.username || credentials?.email || 'demo@example.com'
                const loginPassword = credentials?.password || 'DemoPass123!'
                testGoals.push(`LOGIN: Test authentication flow. 1) Check for 'Forgot Password' link. 2) Test validation (submit blank, invalid credentials). 3) Login with valid credentials (${loginUsername}/${loginPassword}).`)
                break
            case 'signup':
                const signupUsername = credentials?.username || credentials?.email || 'demo@example.com'
                const signupPassword = credentials?.password || 'DemoPass123!'
                testGoals.push(`SIGNUP: Test registration flow. 1) Test validation (submit blank, check password requirements). 2) Submit with test data (${signupUsername}/${signupPassword}).`)
                break
            case 'navigation':
                testGoals.push('NAVIGATION: Click navigation links, test menu items, verify page transitions, check for broken links or 404 errors.')
                break
            case 'form':
                testGoals.push('FORM: Find forms, fill with test data, test validation messages, submit and verify success/error states.')
                break
            case 'accessibility':
                testGoals.push('ACCESSIBILITY: Check for alt text, heading hierarchy, form labels, color contrast, ARIA attributes, keyboard navigation.')
                break
            case 'rage_bait':
                // Rage Bait executed separately, not part of goal
                break
        }
    }

    return testGoals
}

/**
 * Calculate step limits based on test mode
 */
export function getStepLimits(options: TestOptions | undefined): { min: number; max: number; default: number } {
    const STEP_LIMITS = {
        single: { min: 15, max: 50, default: 15 },
        multi: { min: 25, max: 100, default: 25 },
        all: { min: 50, max: 150, default: 50 },
        monkey: { min: 25, max: 75, default: 25 },
    }

    const mode = options?.testMode || 'single'
    return STEP_LIMITS[mode as keyof typeof STEP_LIMITS] || STEP_LIMITS.single
}
