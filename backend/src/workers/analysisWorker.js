import { analysisQueue } from '../services/queueService.js';
import { performAnalysis } from '../services/analysisService.js';

console.log("Starting Analysis Worker...");

analysisQueue.on('ready', () => {
    console.log("✅ Analysis Worker connected to Queue");
});
analysisQueue.on('error', (err) => {
    console.error("❌ Analysis Worker Queue Error:", err);
});

analysisQueue.process(async (job) => {
    const { userId, text, projectId, settings } = job.data;


    job.progress(10); // 10%

    try {
        const result = await performAnalysis(userId, text, projectId, null, null, settings);
        job.progress(100);
        return result;
    } catch (error) {
        console.error(`Job ${job.id} failed:`, error);
        throw error;
    }
});

analysisQueue.on('completed', (job, result) => {

});

analysisQueue.on('failed', (job, err) => {
    console.error(`Job ${job.id} failed with error ${err.message}`);
});
