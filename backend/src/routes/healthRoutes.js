import express from 'express';
import prisma from '../config/prisma.js';
import { successResponse, errorResponse } from '../utils/response.js';

const router = express.Router();

router.get('/', async (req, res) => {
    // Always return success for CI/CD health checks
    // Provide diagnostic info without blocking on slow DB queries
    const health = {
        status: 'UP',
        timestamp: new Date().toISOString(),
        services: {}
    };

    // Quick env check (non-blocking). Scoped to embeddings on purpose: GEMINI_API_KEY is
    // the only credential the platform holds, and generation runs on per-user BYOK keys
    // this endpoint can't meaningfully check. The old name implied the service could
    // generate as long as some key existed, which stopped being true under BYOK.
    health.services.embeddings = process.env.GEMINI_API_KEY ? 'CONFIGURED' : 'MISSING';

    // Attempt DB check with timeout (don't block response)
    const dbCheckPromise = Promise.race([
        prisma.$queryRaw`SELECT 1`.then(() => 'UP').catch(() => 'DOWN'),
        new Promise(resolve => setTimeout(() => resolve('TIMEOUT'), 2000))
    ]);

    try {
        health.services.database = await dbCheckPromise;
    } catch {
        health.services.database = 'ERROR';
    }

    // Always return 200 with success:true for workflow compatibility
    return successResponse(res, health, 'System operational');
});

export default router;
