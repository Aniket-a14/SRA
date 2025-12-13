
import 'dotenv/config';
process.env.MOCK_AI = 'true';
import { addAnalysisJob, getJobStatus, analysisQueue } from '../src/services/queueService.js';
import prisma from '../src/config/prisma.js';

async function run() {
    try {
        const user = await prisma.user.findFirst();
        if (!user) {
            console.error("No user found. Seed DB first.");
            process.exit(1);
        }

        console.log(`Using User: ${user.id}`);
        const job = await addAnalysisJob(user.id, "Queue Test Input Strictly Persist");
        console.log(`Job Added: ${job.id}`);

        // Poll
        let attempts = 0;
        const interval = setInterval(async () => {
            attempts++;
            const status = await getJobStatus(job.id);
            console.log(`Attempt ${attempts}: Status = ${status?.state || 'missing'}`);

            if (status?.state === 'completed') {
                console.log("Job Completed Successfully and Persisted in History!");
                clearInterval(interval);
                process.exit(0);
            } else if (status?.state === 'failed') {
                console.error("Job Failed:", status.error);
                clearInterval(interval);
                process.exit(1);
            } else if (!status) {
                console.error("❌ Job missing from queue! 'removeOnComplete' fix failed.");
                clearInterval(interval);
                process.exit(1);
            }

            if (attempts > 20) {
                console.error("Timeout waiting for job");
                clearInterval(interval);
                process.exit(1);
            }
        }, 1000);

    } catch (e) {
        console.error("Error:", e);
        process.exit(1);
    }
}

run();
