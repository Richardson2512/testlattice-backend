/**
 * ActionContext - Strict execution context system
 * 
 * Enforces control-flow invariants to prevent cookie consent handling
 * from leaking into generic click logic, IRL, or fallback mechanisms.
 * 
 * NON-NEGOTIABLE RULE:
 * - COOKIE_CONSENT context forbids: IRL, self-healing, page-level element search, selector retries
 * - These rules are enforced in code, not by convention.
 */
export enum ActionContext {
  /**
   * Normal test execution - all features enabled
   */
  NORMAL = 'NORMAL',
  
  /**
   * Cookie consent handling - ISOLATED, AUTHORITATIVE FLOW
   * 
   * FORBIDDEN:
   * - IRL (Intelligent Retry Layer)
   * - Self-healing
   * - Page-level element search
   * - Selector retries
   * - Fallback clicks
   * 
   * ALLOWED:
   * - Direct cookie button clicks
   * - Post-click verification (DOM + Vision)
   * - Explicit exit (RESOLVED, RESOLVED_WITH_DELAY, BLOCKED, NOT_PRESENT)
   */
  COOKIE_CONSENT = 'COOKIE_CONSENT',
  
  /**
   * Navigation actions - limited retries allowed
   */
  NAVIGATION = 'NAVIGATION',
  
  /**
   * Form interactions - IRL enabled, no cookie handling
   */
  FORM_INTERACTION = 'FORM_INTERACTION',
  
  /**
   * Recovery mode - aggressive retries allowed
   */
  RECOVERY = 'RECOVERY',
}

/**
 * Check if IRL is allowed in the given context
 */
export function isIRLAllowed(context: ActionContext): boolean {
  return context !== ActionContext.COOKIE_CONSENT
}

/**
 * Check if self-healing is allowed in the given context
 */
export function isSelfHealingAllowed(context: ActionContext): boolean {
  return context !== ActionContext.COOKIE_CONSENT
}

/**
 * Check if page-level fallback is allowed in the given context
 */
export function isPageLevelFallbackAllowed(context: ActionContext): boolean {
  return context !== ActionContext.COOKIE_CONSENT
}

/**
 * Check if selector retries are allowed in the given context
 */
export function isSelectorRetryAllowed(context: ActionContext): boolean {
  return context !== ActionContext.COOKIE_CONSENT
}

