
import IORedis from 'ioredis';
import { Queue } from 'bullmq';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function cleanupStaleJobs() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

    const testQueue = new Queue('test-runner', { connection });

    console.log('\n--- Before Cleanup ---');
    console.log('Waiting:', await testQueue.getJobCountByTypes('waiting'));
    console.log('Active:', await testQueue.getJobCountByTypes('active'));
    console.log('Completed:', await testQueue.getJobCountByTypes('completed'));
    console.log('Failed:', await testQueue.getJobCountByTypes('failed'));

    // Get active jobs
    const activeJobs = await testQueue.getJobs(['active']);
    console.log(`\nFound ${activeJobs.length} active job(s)`);

    for (const job of activeJobs) {
        console.log(`\nActive job: ${job.id}`);
        console.log(`  RunId: ${job.data?.runId}`);
        console.log(`  Enqueued: ${new Date(job.timestamp).toISOString()}`);

        // Check if stale (older than 5 minutes)
        const ageMs = Date.now() - job.timestamp;
        const ageMinutes = Math.floor(ageMs / 60000);
        console.log(`  Age: ${ageMinutes} minutes`);

        if (ageMinutes > 5) {
            console.log('  → Stale job detected, removing...');
            try {
                await job.remove();
                console.log('  → Removed successfully');
            } catch (e: any) {
                console.log(`  → Failed to remove: ${e.message}`);
            }
        }
    }

    // Clean old completed/failed jobs (older than 1 hour)
    const cleaned = await testQueue.clean(3600000, 100, 'completed');
    console.log(`\nCleaned ${cleaned.length} old completed jobs`);

    console.log('\n--- After Cleanup ---');
    console.log('Waiting:', await testQueue.getJobCountByTypes('waiting'));
    console.log('Active:', await testQueue.getJobCountByTypes('active'));
    console.log('Completed:', await testQueue.getJobCountByTypes('completed'));
    console.log('Failed:', await testQueue.getJobCountByTypes('failed'));

    await testQueue.close();
    await connection.quit();
    console.log('\n✅ Cleanup complete');
}

cleanupStaleJobs().catch(console.error);
