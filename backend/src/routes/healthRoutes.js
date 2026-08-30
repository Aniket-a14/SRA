import express from 'express';
import prisma from '../config/prisma.js';
import { getRedisClient } from '../config/redis.js';
import { successResponse, errorResponse } from '../utils/response.js';

const router = express.Router();

let isShuttingDown = false;
export const markShuttingDown = () => {
    isShuttingDown = true;
};

/**
 * 1. Liveness Probe: Verifies the Node.js event loop is responsive.
 */
router.get('/live', (req, res) => {
    if (isShuttingDown) {
        return errorResponse(res, 'SHUTTING_DOWN', 503, { uptime: process.uptime() });
    }
    return successResponse(res, {
        status: 'UP',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    }, 'Process is alive');
});

/**
 * 2. Readiness Probe: Verifies backing dependencies (PostgreSQL, Redis, Credentials).
 */
router.get('/ready', async (req, res) => {
    if (isShuttingDown) {
        return errorResponse(res, 'SHUTTING_DOWN', 503, { ready: false });
    }

    const services = {
        embeddings: process.env.GEMINI_API_KEY ? 'CONFIGURED' : 'MISSING',
        database: 'UNKNOWN',
        redis: 'UNKNOWN'
    };

    let isHealthy = true;

    // Database check with 2000ms timeout
    try {
        const dbResult = await Promise.race([
            prisma.$queryRaw`SELECT 1`.then(() => 'UP').catch(() => 'DOWN'),
            new Promise(resolve => setTimeout(() => resolve('TIMEOUT'), 2000))
        ]);
        services.database = dbResult;
        if (dbResult !== 'UP') {
            isHealthy = false;
        }
    } catch {
        services.database = 'ERROR';
        isHealthy = false;
    }

    // Optional Redis check
    try {
        const redis = getRedisClient();
        if (redis) {
            const pong = await redis.ping();
            services.redis = pong === 'PONG' ? 'UP' : 'DEGRADED';
        } else {
            services.redis = 'DISABLED';
        }
    } catch {
        services.redis = 'DEGRADED';
    }

    const payload = {
        status: isHealthy ? 'UP' : 'DOWN',
        ready: isHealthy,
        timestamp: new Date().toISOString(),
        services
    };

    if (!isHealthy) {
        return errorResponse(res, 'Service dependencies unavailable', 503, payload);
    }

    return successResponse(res, payload, 'System ready');
});

/**
 * 3. Root Health Check (Backward-compatible with readiness reflection).
 */
router.get('/', async (req, res) => {
    if (isShuttingDown) {
        return errorResponse(res, 'SHUTTING_DOWN', 503, { ready: false });
    }

    const health = {
        status: 'UP',
        timestamp: new Date().toISOString(),
        services: {
            embeddings: process.env.GEMINI_API_KEY ? 'CONFIGURED' : 'MISSING',
            database: 'UNKNOWN'
        }
    };

    let isHealthy = true;

    try {
        const dbResult = await Promise.race([
            prisma.$queryRaw`SELECT 1`.then(() => 'UP').catch(() => 'DOWN'),
            new Promise(resolve => setTimeout(() => resolve('TIMEOUT'), 2000))
        ]);
        health.services.database = dbResult;
        if (dbResult !== 'UP') {
            isHealthy = false;
        }
    } catch {
        health.services.database = 'ERROR';
        isHealthy = false;
    }

    health.status = isHealthy ? 'UP' : 'DOWN';

    if (!isHealthy) {
        return errorResponse(res, 'Database unavailable', 503, health);
    }

    return successResponse(res, health, 'System operational');
});

export default router;
