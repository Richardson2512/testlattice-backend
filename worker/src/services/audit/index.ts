/**
 * Audit Service
 * 
 * Site health auditing service.
 */


export { PerformanceCollector } from './PerformanceCollector'
export { AuditService } from './AuditService'

// Alias for backward compatibility
export { AuditService as ComprehensiveTestingService } from './AuditService'
export type AuditServiceType = import('./AuditService').AuditService
