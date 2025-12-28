// Tests Routes - Module Index
// Re-exports route types and utilities

export * from './types'
export { generateReportHtml, generateDetailedReportHtml } from './ReportGenerator'

// Re-export the main route registration from parent
export { testRoutes } from '../tests'
