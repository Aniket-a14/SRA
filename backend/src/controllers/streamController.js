import { getAnalysisById } from '../services/analysisService.js';
import { getRedisClient } from '../config/redis.js';
import { progressChannel } from '../services/progressService.js';
import { createSSEStream } from '../utils/sseWriter.js';
import logger from '../config/logger.js';

export const streamAnalysisProgress = async (req, res, next) => {
    const { id } = req.params;

    let analysis;
    try {
        analysis = await getAnalysisById(req.user.userId, id); // 403 on ownership mismatch
    } catch (error) {
        return next(error);
    }

    if (!analysis) {
        const error = new Error('Analysis not found');
        error.statusCode = 404;
        return next(error);
    }

    const sse = createSSEStream(res, req);

    // Late-joining client (e.g. page refresh after the job already finished) — nothing
    // will ever publish to this channel again, so answer from the DB and close.
    if (analysis.status === 'COMPLETED' || analysis.status === 'FAILED') {
        await sse.writeEvent({
            stage: 'completed',
            terminal: true,
            status: analysis.status,
            resultQuality: analysis.resultQuality,
            message: 'Already finished.'
        });
        return sse.close();
    }

    const redis = getRedisClient();
    if (!redis) {
        await sse.writeEvent({ stage: 'unavailable', terminal: true, message: 'Live progress is unavailable; the page will fall back to polling.' });
        return sse.close();
    }

    // A subscriber connection can't issue any other Redis command, so this must be a
    // dedicated duplicate — never the shared client also used for caching/rate limiting.
    const subscriber = redis.duplicate();
    let closed = false;

    const cleanup = () => {
        if (closed) return;
        closed = true;
        subscriber.unsubscribe().catch(() => {});
        subscriber.quit().catch(() => {});
        sse.close();
    };

    subscriber.on('message', async (_channel, message) => {
        await sse.writeEvent(message);
        try {
            if (JSON.parse(message).terminal) cleanup();
        } catch {
            // malformed payload — ignore, connection stays open for the next event
        }
    });

    subscriber.on('error', (err) => {
        logger.warn({ msg: 'Progress subscriber error', analysisId: id, error: err.message });
    });

    try {
        await subscriber.subscribe(progressChannel(id));
    } catch (err) {
        logger.warn({ msg: 'Failed to subscribe to progress channel', analysisId: id, error: err.message });
        await sse.writeEvent({ stage: 'unavailable', terminal: true, message: 'Live progress unavailable; falling back to polling.' });
        return sse.close();
    }

    req.on('close', cleanup);
};
