/**
 * Step Description Generator
 * Generates human-readable explanations for test step actions
 * Shared across Guest and Registered test processors
 */

export interface StepDescriptionContext {
    url?: string
    device?: string
    resolution?: string
    selector?: string
    target?: string
    count?: number
    status?: number
    message?: string
    error?: string
    action?: string
    value?: string
    [key: string]: any
}

/**
 * Generate a human-readable description for a test step
 */
export function getStepDescription(action: string, details?: StepDescriptionContext, url?: string): string {
    const d = details || {}

    const descriptions: Record<string, string | ((d: StepDescriptionContext) => string)> = {
        // ============================================================================
        // PAGE LOAD & NAVIGATION
        // ============================================================================
        'validate_load': (d) => d?.status === 200
            ? `Website loaded successfully. Verifying all page resources are ready.`
            : `Page returned status ${d?.status}. Checking if there are any loading issues.`,

        'navigate': (d) => `Navigating to ${d?.url || 'the target page'} to continue testing.`,
        'navigate_subpage': (d) => `Visiting internal page "${d?.url?.split('/').pop() || 'subpage'}" to verify links work correctly.`,
        'return_home': (d) => d?.message?.includes('Skipped')
            ? 'No home link found on this page - common for single-page applications.'
            : 'Navigating back to the homepage to verify the home link works.',
        'goto': (d) => `Opening ${d?.url || 'the page'} in the browser.`,
        'goBack': () => 'Going back to the previous page.',
        'reload': () => 'Refreshing the page to verify consistent loading.',

        // ============================================================================
        // ERROR & VALIDATION CHECKS
        // ============================================================================
        'check_errors': (d) => d?.message?.includes('No critical')
            ? 'Scanned for JavaScript errors and failed network requests. No issues found!'
            : `Detected issues: ${d?.message}. These may affect user experience.`,

        'validate_links': (d) => `Found ${d?.count || 0} links on the page. Ensuring they are properly formatted and accessible.`,

        'check_media': (d) => d?.message?.includes('All images')
            ? 'All images and media files loaded successfully.'
            : `${d?.error || 'Checking if all images loaded correctly.'}`,

        // ============================================================================
        // POPUP & MODAL HANDLING
        // ============================================================================
        'check_popups': () => 'Checking for popups, cookie banners, or modals and closing any that block the view.',
        'close_popup': () => 'Closing a popup that appeared on the page.',
        'dismiss_modal': () => 'Dismissing a modal dialog to continue testing.',
        'cookie_banner': () => 'Handling cookie consent banner to proceed with the test.',

        // ============================================================================
        // RESPONSIVE TESTING
        // ============================================================================
        'responsive_check': (d) => `Testing layout on ${d?.device} (${d?.resolution}). Checking if content adapts properly.`,
        'viewport_change': (d) => `Changing screen size to ${d?.resolution} to test responsive design.`,

        // ============================================================================
        // SCROLL & INTERACTION
        // ============================================================================
        'scroll_behavior': () => 'Scrolling through the entire page to load lazy content and verify smooth scrolling.',
        'scroll': (d) => `Scrolling ${d?.direction || 'down'} to reveal more content.`,
        'scroll_to': (d) => `Scrolling to element "${d?.selector || d?.target || 'target'}" to bring it into view.`,

        // ============================================================================
        // CLICK ACTIONS
        // ============================================================================
        'click': (d) => `Clicking on "${d?.selector || d?.target || 'element'}" to interact with it.`,
        'double_click': (d) => `Double-clicking on "${d?.selector || d?.target || 'element'}".`,
        'right_click': (d) => `Right-clicking on "${d?.selector || d?.target || 'element'}" to access context menu.`,

        // ============================================================================
        // FORM INTERACTIONS
        // ============================================================================
        'type': (d) => `Typing "${d?.value?.substring(0, 20)}${(d?.value?.length || 0) > 20 ? '...' : ''}" into the input field.`,
        'fill': (d) => `Filling form field with "${d?.value?.substring(0, 20)}${(d?.value?.length || 0) > 20 ? '...' : ''}".`,
        'clear': () => 'Clearing the input field before entering new content.',
        'select': (d) => `Selecting "${d?.value}" from the dropdown menu.`,
        'check': () => 'Checking the checkbox.',
        'uncheck': () => 'Unchecking the checkbox.',
        'press': (d) => `Pressing the ${d?.key || 'Enter'} key.`,
        'submit': () => 'Submitting the form.',

        // ============================================================================
        // AUTH FLOW
        // ============================================================================
        'detect_auth_form': () => 'Looking for login or signup forms on the page.',
        'fill_credentials': () => 'Entering test credentials into the form fields.',
        'submit_form': () => 'Submitting the authentication form.',
        'verify_login': () => 'Checking if login was successful by looking for account indicators.',
        'logout': () => 'Logging out to verify the logout flow works.',
        'signup_flow': () => 'Testing the user registration process.',

        // ============================================================================
        // MFA & VERIFICATION
        // ============================================================================
        'mfa_detected': () => 'Multi-factor authentication detected. Waiting for verification input.',
        'otp_entry': () => 'Entering the one-time password for verification.',
        'email_verification': () => 'Waiting for email verification link to be provided.',
        'verification_complete': () => 'Verification completed successfully.',

        // ============================================================================
        // VISUAL TESTING
        // ============================================================================
        'visual_regression': () => 'Capturing screenshot for visual comparison. This helps detect unintended UI changes.',
        'screenshot': () => 'Taking a screenshot of the current page state.',
        'compare_baseline': () => 'Comparing current screenshot against the baseline for visual differences.',

        // ============================================================================
        // RAGE BAIT / STRESS TESTING
        // ============================================================================
        'rage_bait_click': (d) => `Rapidly clicking on "${d?.target || 'element'}" to test frustration handling.`,
        'rapid_interaction': () => 'Testing how the UI handles rapid repeated interactions.',

        // ============================================================================
        // DIAGNOSIS / CRAWL
        // ============================================================================
        'diagnosis_start': () => 'Starting comprehensive diagnosis of the page structure.',
        'diagnosis_crawl': () => 'Crawling through pages to gather diagnostic information.',
        'diagnosis_complete': () => 'Diagnosis complete. Analyzing results for potential issues.',
        'preflight': () => 'Running initial page checks before starting the main test.',

        // ============================================================================
        // WAIT / TIMING
        // ============================================================================
        'wait': (d) => `Waiting ${d?.duration || 'a moment'} for the page to stabilize.`,
        'wait_for_selector': (d) => `Waiting for "${d?.selector}" to appear on the page.`,
        'wait_for_navigation': () => 'Waiting for page navigation to complete.',
        'wait_for_network': () => 'Waiting for network requests to finish.',


        // ============================================================================
        // NAVIGATION CONTRACT (v1)
        // ============================================================================
        'extract_primary_nav': (d) => `Extracted ${d?.count || 0} primary navigation items to map user journeys.`,
        'count_total_nav_items': (d) => `Auditing navigation density: Found ${d?.total_anchors_on_page || 0} clickable elements.`,
        'detect_placeholders': (d) => d?.count && d.count > 0 ? `Warning: Found ${d.count} placeholder links (#) that don't lead anywhere.` : 'No broken placeholder links found.',
        'click_first_link': (d) => `Testing navigation by clicking "${d?.target || 'first link'}".`,
        'verify_nav_success_1': (d) => d?.success ? 'Navigation successful. URL changed correctly.' : 'Navigation failed or user stayed on same page.',
        'click_second_link': (d) => d?.note?.includes('Skipped') ? 'Skipped second link test (not enough menu items).' : `Testing secondary navigation path: "${d?.target || 'link'}".`,
        'verify_nav_success_2': (d) => d?.success ? 'Secondary navigation confirmed.' : 'Secondary navigation check failed.',
        'validate_logo_home': (d) => d?.found_logo ? (d?.returned_home ? 'Logo click successfully returned to homepage.' : 'Logo click did NOT return to homepage.') : 'Could not identify a functioning logo link.',
        'check_external_link_safety': (d) => d?.unsafe_count && d.unsafe_count > 0 ? `Security Alert: Found ${d.unsafe_count} external links missing rel="noopener".` : 'External link safety check passed.',
        'detect_broken_anchors': (d) => d?.count && d.count > 0 ? `Found ${d.count} malformed anchor tags (e.g. {{template}} leaks).` : 'No malformed anchor tags detected.',
        'record_navigation_consistency': (d) => `Navigation Consistency Score: ${d?.score || 0}/100. ${d?.summary || ''}`,

        // ============================================================================
        // FORM CONTRACT (v1)
        // ============================================================================
        'detect_primary_form': (d) => d?.selector ? `Identified primary form (${d.selector}) for testing.` : 'No interactive forms detected on this page.',
        'enumerate_input_fields': (d) => `Form audit: Found ${d?.count || 0} input fields. types: [${(d?.types || []).slice(0, 3).join(', ')}...]`,
        'check_input_type_correctness': (d) => d?.issues_found && d.issues_found > 0 ? `Semantic Issue: ${d.issues_found} inputs have mismatched types (e.g. 'email' name but 'text' type).` : 'All input types match their semantic purpose.',
        'attempt_empty_submit': () => 'Attempting to submit empty form to trigger validation errors.',
        'capture_validation_messages': (d) => d?.messages_found && d.messages_found > 0 ? `Captured ${d.messages_found} validation messages.` : 'No validation messages appeared (Form might be permissive or use custom JS).',
        'inject_safe_dummy_data': () => 'Injecting safe, context-aware dummy data (e.g. test@example.com).',
        'detect_outcome': (d) => `Submission Outcome: ${d?.outcome || 'Unknown'}. Found keywords: [${(d?.keywords_found || []).join(', ')}]`,
        'capture_confirmation_clarity': () => 'Analyzing post-submission state for clarity.',
        'refresh_page_post_submit': () => 'Refeshing page to check for data persistence (Security/Privacy check).',
        'detect_state_persistence': (d) => d?.filled_inputs_after_refresh > 0 ? `Privacy Warning: ${d.filled_inputs_after_refresh} fields retained data after refresh.` : 'Good: Form data cleared on refresh.',
        'final_form_state_capture': () => 'Recording final form state.',

        // ============================================================================
        // ACCESSIBILITY CONTRACT (v1)
        // ============================================================================
        'inject_accessibility_scanner': (d) => d?.success ? `Injected axe-core v${d?.version}` : 'Failed to inject accessibility engine.',
        'run_critical_rule_set': () => 'Running strict WCAG 2.1 AA critical compliance scan.',
        'count_critical_violations': (d) => (d?.count ?? 0) > 0 ? `found ${d?.count} CRITICAL violations.` : 'No CRITICAL violations found.',
        'count_serious_violations': (d) => (d?.count ?? 0) > 0 ? `found ${d?.count} SERIOUS violations.` : 'No SERIOUS violations found.',
        'detect_missing_alt_attributes': (d) => d?.failed_nodes > 0 ? `Missing Alt Text: ${d.failed_nodes} images.` : 'All images have alt descriptions.',
        'detect_unlabeled_inputs': (d) => d?.failed_nodes > 0 ? `Form Accessibility: ${d.failed_nodes} inputs missing labels.` : 'All inputs have associated labels.',
        'detect_icon_only_buttons': (d) => d?.failed_nodes > 0 ? `UX Issue: ${d.failed_nodes} buttons missing discernable text.` : 'Buttons have proper labels.',
        'perform_keyboard_tab_navigation': () => 'Simulating keyboard user (5x Tab Key) to test focus flow.',
        'check_focus_visibility': (d) => d?.visible_on_last_element ? 'Focus indicator is visible.' : 'Accessibility Failure: Focus indicator is hidden/suppressed.',
        'detect_aria_role_misuse': (d) => (d?.count ?? 0) > 0 ? `ARIA Misuse: ${d?.count} invalid role assignments.` : 'ARIA roles usage appears valid.',
        'summarize_top_risks': (d) => d?.message || 'Accessibility audit complete.',

        // ============================================================================
        // AUTH CONTRACT EXTENSIONS
        // ============================================================================
        'detect_login_form': (d) => d?.found ? 'Login form detected.' : 'No login entry point found.',
        'detect_signup_form': (d) => d?.found ? 'Signup form detected.' : 'No signup entry point found.',
        'count_total_fields': (d) => `Signup Form: Contains ${d?.count || 0} fields context.`,
        'count_required_fields': (d) => `Signup Form: ${d?.count || 0} fields are required.`,
        'test_weak_password_feedback': (d) => d?.feedback_detected ? 'Security UX: Application correctly warns about weak passwords.' : 'Security UX: Application accepted "123" without warning.',
        'verify_terms_link': (d) => d?.found ? 'Legal: Terms/Privacy links are present.' : 'Legal: Missing Terms of Service links.',
        'detect_email_field': (d) => d?.selector !== 'none' ? `Email field identified: ${d.selector}` : 'Could not identify email field.',
        'detect_password_field': (d) => d?.selector !== 'none' ? `Password field identified: ${d.selector}` : 'Could not identify password field.',
        'check_submit_disabled': (d) => d?.message || 'Checking submit button state.',
        'check_submit_enabled': (d) => d?.enabled_after_input ? 'Submit button enabled after input.' : 'Submit button remained disabled.',

        // ============================================================================
        // GOD MODE
        // ============================================================================
        'god_mode_action': (d) => `Performing learned action: ${d?.action || 'custom interaction'}.`,
        'learning_capture': () => 'Recording this interaction for future test automation.',

        // ============================================================================
        // DEFAULT
        // ============================================================================
        'default': (d) => d?.message || `Performing ${action.replace(/_/g, ' ')}...`
    }

    const description = descriptions[action] || descriptions['default']
    return typeof description === 'function' ? description(d) : description
}

/**
 * Enrich step details with a human-readable description
 */
export function enrichStepWithDescription(action: string, details?: any, url?: string): any {
    return {
        ...details,
        description: getStepDescription(action, details, url)
    }
}
