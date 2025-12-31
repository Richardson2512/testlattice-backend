import { injectable, inject } from 'tsyringe'
import Redis from 'ioredis'
import { SupabaseClient } from '@supabase/supabase-js'
import { TOKENS } from '../di/container'
import { logger } from '../observability/logger'

@injectable()
export class StateManager {
    constructor(
        @inject(TOKENS.Redis) private redis: Redis,
        @inject(TOKENS.Supabase) private supabase: SupabaseClient
    ) { }

    /**
     * Update test run status atomically (Redis + Supabase sync)
     */
    async updateRunStatus(runId: string, status: string, error?: string): Promise<void> {
        const timestamp = new Date().toISOString()

        // 1. Hot path: Update Redis hash
        // Stores latest state for fast retrieval by other workers/API
        const state: Record<string, string> = {
            status,
            updatedAt: timestamp,
        }
        if (error) state.error = error

        // TTL 24 hours for active state
        await this.redis.hset(`run:${runId}:state`, state)
        await this.redis.expire(`run:${runId}:state`, 86400)

        // 2. Cold path: Sync to Supabase
        // We await this to ensure data durability, but catch errors to prevent job failure
        try {
            const updatePayload: any = {
                status,
                updated_at: timestamp
            }
            if (error) updatePayload.error = error

            const { error: dbError } = await this.supabase
                .from('test_runs')
                .update(updatePayload)
                .eq('id', runId)

            if (dbError) throw dbError
        } catch (e: any) {
            logger.error({ runId, error: e.message }, 'Failed to sync status to Supabase')
            // In a robust system, we would enqueue a sync retry job here
        }
    }

    /**
     * Get current run state from Redis (faster than DB)
     */
    async getRunState(runId: string): Promise<Record<string, string>> {
        return await this.redis.hgetall(`run:${runId}:state`)
    }

    /**
     * Persist a step to Redis for crash resilience
     */
    async addStep(runId: string, step: any): Promise<void> {
        const key = `run:${runId}:steps`
        // Push to list and set expiry (idempotent-ish for expiry)
        await this.redis.multi()
            .rpush(key, JSON.stringify(step))
            .expire(key, 86400)
            .exec()
    }
}
