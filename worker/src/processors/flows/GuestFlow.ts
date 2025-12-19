// Guest flow - quick start for unauthenticated users
// Uses dedicated GuestTestProcessor with no diagnosis phase
import { JobData } from '../../types'
import { GuestTestProcessor, GuestProcessResult } from '../GuestTestProcessor'

export class GuestFlow {
  constructor(private processor: GuestTestProcessor) { }

  /**
   * Execute guest test flow (skip diagnosis, auto-approve, 25-step limit)
   */
  async executeGuestTest(runId: string, jobData: JobData): Promise<GuestProcessResult> {
    console.log(`[${runId}] GuestFlow: Delegating to GuestTestProcessor (no diagnosis)`)

    // GuestTestProcessor handles everything - no diagnosis, direct execution
    return await this.processor.process(jobData)
  }
}
