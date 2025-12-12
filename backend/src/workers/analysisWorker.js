import { analysisQueue } from '../services/queueService.js';
import { performAnalysis } from '../services/analysisService.js';

console.log("Starting Analysis Worker...");

analysisQueue.process(async (job) => {
    const { userId, text } = job.data;

    console.log(`Processing Job ${job.id} for User ${userId}`);
    job.progress(10); // 10%

    try {
        const result = await performAnalysis(userId, text);
        job.progress(100);
        return result;
    } catch (error) {
        console.error(`Job ${job.id} failed:`, error);
        throw error;
    }
});

analysisQueue.on('completed', (job, result) => {
    console.log(`Job ${job.id} completed!`);
});

analysisQueue.on('failed', (job, err) => {
    console.error(`Job ${job.id} failed with error ${err.message}`);
});
