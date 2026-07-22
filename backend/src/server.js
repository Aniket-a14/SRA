import 'dotenv/config';
import app from './app.js';
import prisma from './config/prisma.js';
import { getRedisClient } from './config/redis.js';
import { runReconciliation } from './services/reconciliationService.js';


const PORT = process.env.PORT || 3000;

import { validateEnv } from './config/env.js';

// Startup Validation (Hardening)
validateEnv();

const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Internal Analysis Service available at http://localhost:${PORT}/internal/analyze`);
});

// In production, POST /api/worker/reconcile is meant to be hit by a scheduled QStash
// job (see docs/reconciliation.md) so the sweep survives across replicas/restarts.
// There's no local QStash schedule in dev, so run the same sweep in-process on an
// interval — mirrors the MOCK_QSTASH pattern already used for the analysis queue.
const RECONCILIATION_INTERVAL_MS = 15 * 60 * 1000;
let reconciliationInterval = null;
if (process.env.MOCK_QSTASH === 'true' || process.env.NODE_ENV === 'development') {
    reconciliationInterval = setInterval(() => {
        runReconciliation().catch(err => console.error('[Reconciliation] Sweep failed:', err.message));
    }, RECONCILIATION_INTERVAL_MS);
    reconciliationInterval.unref();
}

// Graceful Shutdown — cleanly close all connections
const gracefulShutdown = async (signal) => {
    console.log(`${signal} signal received: closing HTTP server`);
    server.close(async () => {
        console.log('HTTP server closed');
        try {
            await prisma.$disconnect();
            console.log('Prisma disconnected');
        } catch (e) {
            console.error('Prisma disconnect error:', e.message);
        }
        try {
            const redis = getRedisClient();
            if (redis) {
                await redis.quit();
                console.log('Redis disconnected');
            }
        } catch (e) {
            console.error('Redis disconnect error:', e.message);
        }
        process.exit(0);
    });

    // Force exit if graceful shutdown takes too long (10s)
    setTimeout(() => {
        console.error('Forced shutdown after 10s timeout');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
