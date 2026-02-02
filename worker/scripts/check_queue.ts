
import IORedis from 'ioredis';
import { Queue } from 'bullmq';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function checkQueue() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

    const testQueue = new Queue('test-runner', { connection });

    console.log('\n--- Test Runner Queue ---');
    console.log('Waiting:', await testQueue.getJobCountByTypes('waiting'));
    console.log('Active:', await testQueue.getJobCountByTypes('active'));
    console.log('Completed:', await testQueue.getJobCountByTypes('completed')); // Added
    console.log('Failed:', await testQueue.getJobCountByTypes('failed'));

    const completed = await testQueue.getJobs(['completed'], 0, 10); // Get more
    const targetId = 'test-d66329f1-f6ee-489f-b9c8-b38dbe9552a3';

    console.log('\n--- Inspecting Target Job ---');
    const job = await testQueue.getJob(targetId);
    if (job) {
        console.log('ID:', job.id);
        console.log('State:', await job.getState());
        console.log('Processed On:', job.processedOn);
        console.log('Finished On:', job.finishedOn);
        console.log('Return Value:', JSON.stringify(job.returnvalue, null, 2));
        console.log('Failed Reason:', job.failedReason);
        console.log('Stacktrace:', job.stacktrace);
    } else {
        console.log('Job not found in queue');
    }

    console.log('\n--- Failed Jobs ---');
    const failed = await testQueue.getJobs(['failed'], 0, 3);
    failed.forEach(j => {
        console.log(`Failed Job ${j.id}: ${j.failedReason}`);
    });

    await connection.quit();
}

checkQueue().catch(console.error);
