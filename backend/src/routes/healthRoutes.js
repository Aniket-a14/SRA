import express from 'express';
import prisma from '../config/prisma.js';

const router = express.Router();

router.get('/', async (req, res) => {
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        services: {
            database: 'checking...',
        }
    };

    try {
        // Basic DB check
        await prisma.$queryRaw`SELECT 1`;
        health.services.database = 'healthy';
    } catch (error) {
        health.status = 'degraded';
        health.services.database = 'unhealthy';
        health.error = error.message;
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
});

export default router;
