import IORedis from "ioredis";
import { Queue } from "bullmq";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function check() {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    console.log("Connecting to Redis:", redisUrl.replace(/:[^:@]+@/, ":****@"));
    const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

    const testQueue = new Queue("test-runner", { connection });
    const guestQueue = new Queue("guest-runner", { connection });

    console.log("\n--- Main Test Runner Queue ---");
    console.log("Waiting:", await testQueue.getJobCountByTypes("waiting"));
    console.log("Active:", await testQueue.getJobCountByTypes("active"));
    console.log("Delayed:", await testQueue.getJobCountByTypes("delayed"));

    console.log("\n--- Guest Runner Queue ---");
    console.log("Waiting:", await guestQueue.getJobCountByTypes("waiting"));
    console.log("Active:", await guestQueue.getJobCountByTypes("active"));
    console.log("Delayed:", await guestQueue.getJobCountByTypes("delayed"));

    console.log("\n--- Search for Job b0fb5858 ---");
    const job = await testQueue.getJob("test-b0fb5858");
    if (job) {
        console.log("Found in test-runner! State:", await job.getState());
    } else {
        console.log("Not found with ID test-b0fb5858");
    }

    // Also try with full UUID pattern
    const allJobs = await testQueue.getJobs(
        ["waiting", "active", "completed", "failed", "delayed"],
        0,
        50
    );
    const matchingJobs = allJobs.filter(
        (j) =>
            j.id?.includes("b0fb5858") || j.data?.runId?.includes("b0fb5858")
    );
    console.log("Matching jobs by runId substring:", matchingJobs.length);
    matchingJobs.forEach((j) => console.log("  -", j.id, j.data?.runId));

    // Check guest queue too
    const guestJobs = await guestQueue.getJobs(
        ["waiting", "active", "completed", "failed", "delayed"],
        0,
        50
    );
    const matchingGuestJobs = guestJobs.filter(
        (j) =>
            j.id?.includes("b0fb5858") || j.data?.runId?.includes("b0fb5858")
    );
    console.log("Matching guest jobs:", matchingGuestJobs.length);
    matchingGuestJobs.forEach((j) => console.log("  -", j.id, j.data?.runId));

    // Get detailed info on the found job
    console.log("\n--- Detailed Job Info ---");
    for (const j of matchingJobs) {
        const state = await j.getState();
        console.log("Job ID:", j.id);
        console.log("State:", state);
        console.log("Processed On:", j.processedOn ? new Date(j.processedOn).toISOString() : "N/A");
        console.log("Finished On:", j.finishedOn ? new Date(j.finishedOn).toISOString() : "N/A");
        console.log("Failed Reason:", j.failedReason);
        console.log("Return Value:", JSON.stringify(j.returnvalue, null, 2));
        console.log("Attempts Made:", j.attemptsMade);
        console.log("Data:", JSON.stringify(j.data, null, 2));
    }

    await connection.quit();
}
check().catch(console.error);

