import { Client } from "@upstash/qstash";
import { log } from "../middleware/logger.js";

const qstashClient = new Client({
    token: process.env.QSTASH_TOKEN,
});

const BACKEND_URL = process.env.BACKEND_URL;

export const addAnalysisJob = async (userId, text, projectId, settings, parentId = null, rootId = null) => {
    if (!BACKEND_URL) {
        throw new Error("BACKEND_URL is not defined");
    }

    const payload = {
        userId,
        text,
        projectId,
        settings,
        parentId,
        rootId
    };

    try {
        const result = await qstashClient.publishJSON({
            url: `${BACKEND_URL}/api/worker/process`,
            body: payload,
            retries: 3,
        });

        log.info({ msg: "Job sent to QStash", jobId: result.messageId, userId });
        return { id: result.messageId };
    } catch (error) {
        log.error({ msg: "Failed to send job to QStash", error: error.message });
        throw error;
    }
};

export const getJobStatus = async (jobId) => {
    // QStash doesn't store state like Bull. We'd need to query a DB table if we tracked jobs there.
    // For now, return a placeholder or implement Job tracking in Postgres.
    return { state: 'unknown', progress: 0 };
};
