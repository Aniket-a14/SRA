import { getRedisClient } from '../config/redis.js';
import logger from '../config/logger.js';

export const progressChannel = (analysisId) => `analysis:progress:${analysisId}`;

/**
 * Best-effort pipeline progress broadcast for the SSE stream endpoint
 * (GET /api/analysis/:id/stream). Never throws — a missing/unreachable Redis
 * must not fail the actual analysis run, only degrade the live-progress UI to
 * whatever the existing SWR polling fallback shows.
 */
export const publishProgress = async (analysisId, event) => {
    if (!analysisId) return;
    const redis = getRedisClient();
    if (!redis) return;

    try {
        await redis.publish(progressChannel(analysisId), JSON.stringify({ ...event, timestamp: Date.now() }));
    } catch (err) {
        logger.warn({ msg: 'Failed to publish analysis progress (non-fatal)', analysisId, error: err.message });
    }
};
