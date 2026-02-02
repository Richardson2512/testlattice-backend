/**
 * Testability Analyzer Module
 * 
 * Pre-test diagnosis that generates a TestabilityContract.
 * Answers: "Can this test run, and under what limits?"
 */

// Main service
export { TestabilityAnalyzerService, testabilityAnalyzer } from './TestabilityAnalyzer'

// Types
export * from './types'

// Detectors (for direct use if needed)
export * from './detectors'

// Analyzers (for direct use if needed)
export * from './analyzers'
