// Registered user flow - full features with diagnosis and approval
import { JobData, TestRunStatus, ProcessResult } from '../../types'
import { TestProcessor } from '../testProcessor'

export class RegisteredFlow {
  constructor(private processor: TestProcessor) {}

  /**
   * Execute registered user test flow (full diagnosis, manual approval, unlimited steps)
   */
  async executeRegisteredTest(runId: string, jobData: JobData): Promise<ProcessResult> {
    console.log(`[${runId}] Starting registered user test flow (full features)`)
    
    // Registered users get full diagnosis and manual approval
    // Use the standard process method which handles diagnosis and execution
    return await (this.processor as any).process(jobData)
  }
}

