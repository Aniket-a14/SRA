import Queue from 'bull';


// Use REDIS_URL from env or default to local
const redisConfig = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

export const analysisQueue = new Queue('analysis-queue', redisConfig);

export const addAnalysisJob = async (userId, text) => {
    const job = await analysisQueue.add({
        userId,
        text
    }, {
        attempts: 2,
        backoff: 5000,
        removeOnComplete: true, // Keep memory clean
        removeOnFail: false // Keep for debugging
    });

    return job;
};

export const getJobStatus = async (jobId) => {
    const job = await analysisQueue.getJob(jobId);
    if (!job) return null;

    const state = await job.getState();
    const result = job.returnvalue;
    const error = job.failedReason;
    const progress = job.progress();

    return {
        id: job.id,
        state,
        progress,
        result,
        error
    };
};
