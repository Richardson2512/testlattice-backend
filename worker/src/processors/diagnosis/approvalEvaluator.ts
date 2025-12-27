// Approval evaluation helpers extracted from testProcessor.ts
import { JobData, DiagnosisResult, TestEnvironment } from '../../types'

export function resolveTestEnvironment(options?: JobData['options']): TestEnvironment {
  if (options?.environment) {
    return options.environment
  }
  const envFromProcess = (process.env.TEST_ENVIRONMENT || process.env.Rihario_ENVIRONMENT || '').toLowerCase()
  if (envFromProcess === 'development' || envFromProcess === 'staging' || envFromProcess === 'production') {
    return envFromProcess as TestEnvironment
  }
  return process.env.NODE_ENV === 'production' ? 'production' : 'development'
}

export function evaluateApprovalDecision(jobData: JobData, diagnosis: DiagnosisResult): 'auto' | 'wait' {
  const options = jobData.options
  const policy = options?.approvalPolicy
  const environment = resolveTestEnvironment(options)

  if (policy?.mode === 'auto') {
    return 'auto'
  }

  if (policy?.mode === 'manual') {
    return 'wait'
  }

  const blockers = diagnosis.nonTestableComponents?.length || 0
  const threshold =
    policy?.maxBlockers ?? (environment === 'production' ? 0 : 2)

  if (policy?.mode === 'auto_on_clean') {
    return blockers <= threshold ? 'auto' : 'wait'
  }

  if (!policy || !policy.mode) {
    return 'wait'
  }

  return blockers <= threshold ? 'auto' : 'wait'
}

