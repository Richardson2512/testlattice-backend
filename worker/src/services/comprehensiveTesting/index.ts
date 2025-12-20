// Comprehensive Testing - Module Index
// Re-exports types and provides the main service class

export * from './types'
export { PerformanceCollector } from './PerformanceCollector'

// Re-export the main service from parent (for now)
// This allows gradual migration while maintaining backward compatibility
export { ComprehensiveTestingService } from '../comprehensiveTesting'
