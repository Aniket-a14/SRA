import express from 'express';
import prisma from '../config/prisma.js';
import { successResponse, errorResponse } from '../utils/response.js';

const router = express.Router();

router.get('/', async (req, res) => {
    const health = {
        status: 'UP',
        timestamp: new Date().toISOString(),
        services: {
            database: 'UNKNOWN',
            ai_provider: 'UNKNOWN'
        }
    };

    try {
        // Check Database
        await prisma.$queryRaw`SELECT 1`;
        health.services.database = 'UP';
    } catch (e) {
        health.status = 'DEGRADED';
        health.services.database = 'DOWN';
    }

    // Check AI Provider (Basic availability check)
    // We could do a more thorough check if needed, but for now just check if env vars exist
    if (process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY) {
        health.services.ai_provider = 'CONFIGURED';
    } else {
        health.status = 'DEGRADED';
        health.services.ai_provider = 'MISSING_API_KEY';
    }

    if (health.status === 'UP') {
        return successResponse(res, health, 'System is healthy');
    } else {
        return errorResponse(res, 'System is degraded', 503, 'SYSTEM_DEGRADED');
    }
});

export default router;
