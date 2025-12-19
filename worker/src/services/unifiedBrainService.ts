// Unified Brain Service - Re-export from modular structure
// Original monolithic file has been split into smaller modules in ./unifiedBrain/
// This file maintains backward compatibility with existing imports

export { UnifiedBrainService } from './unifiedBrain'

// Re-export types for convenience
export type {
  ParsedInstructions,
  AlternativeSelector,
  FallbackConfig,
  DeterministicFallbackContext,
  ModelCallResult,
  UnifiedBrainMetrics,
  ActionGenerationOptions,
  TestabilityAnalysis,
  ErrorAnalysis,
  ContextSynthesis,
} from './unifiedBrain'
