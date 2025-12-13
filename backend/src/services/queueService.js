import Queue from 'bull';

let redisUrl = process.env.REDIS_URL;

let queueConfig = null;

if (redisUrl) {
    const url = redisUrl;
    const isUpstash = url.includes('upstash.io');

    if (isUpstash) {
        queueConfig = {
            redis: {
                port: 6379,
                tls: { rejectUnauthorized: false },  // Required for Upstash
            }
        };
    }
}

export const analysisQueue = new Queue('analysis-queue', redisUrl, queueConfig || {});

console.log(`✅ Using Redis Queue: ${redisUrl?.includes('upstash') ? 'Upstash Cloud' : 'Local/Other'}`);

export const addAnalysisJob = async (userId, text, projectId) => {
    const job = await analysisQueue.add({
        userId,
        text,
        projectId
    }, {
        attempts: 2,
        backoff: 5000,
        removeOnComplete: 100, // Keep last 100 jobs so polling succeeds
        removeOnFail: false // Keep for debugging
    });

    return job;
};

export const getJobStatus = async (jobId) => {
    const job = await analysisQueue.getJob(jobId);
    if (!job) return null;

    const state = await job.getState();
    const result = job.returnvalue; // Bull uses returnvalue
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
