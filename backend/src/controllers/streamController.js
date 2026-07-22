import { getAnalysisById } from '../services/analysisService.js';
import { getRedisClient } from '../config/redis.js';
import { progressChannel } from '../services/progressService.js';
import logger from '../config/logger.js';

const HEARTBEAT_MS = 15000;

// Not consumed via native EventSource — EventSource can't set an Authorization
// header, and putting the JWT in the URL would leak it into server/proxy access
// logs. The frontend instead uses fetch() (same Bearer-header pattern as every
// other API call) and reads this as a streamed response body.
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

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no' // disable nginx response buffering for this long-lived connection
    });

    // Late-joining client (e.g. page refresh after the job already finished) — nothing
    // will ever publish to this channel again, so answer from the DB and close.
    if (analysis.status === 'COMPLETED' || analysis.status === 'FAILED') {
        res.write(`data: ${JSON.stringify({
            stage: 'completed',
            terminal: true,
            status: analysis.status,
            resultQuality: analysis.resultQuality,
            message: 'Already finished.'
        })}\n\n`);
        return res.end();
    }

    const redis = getRedisClient();
    if (!redis) {
        res.write(`data: ${JSON.stringify({ stage: 'unavailable', terminal: true, message: 'Live progress is unavailable; the page will fall back to polling.' })}\n\n`);
        return res.end();
    }

    // A subscriber connection can't issue any other Redis command, so this must be a
    // dedicated duplicate — never the shared client also used for caching/rate limiting.
    const subscriber = redis.duplicate();
    let heartbeat = null;
    let closed = false;

    const cleanup = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        subscriber.unsubscribe().catch(() => {});
        subscriber.quit().catch(() => {});
        res.end();
    };

    subscriber.on('message', (_channel, message) => {
        res.write(`data: ${message}\n\n`);
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
        res.write(`data: ${JSON.stringify({ stage: 'unavailable', terminal: true, message: 'Live progress unavailable; falling back to polling.' })}\n\n`);
        return res.end();
    }

    heartbeat = setInterval(() => res.write(': keep-alive\n\n'), HEARTBEAT_MS);

    req.on('close', cleanup);
};
