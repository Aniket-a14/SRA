import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';

/**
 * healthRoutes.js had zero test coverage — these back the liveness/readiness probes an
 * orchestrator (Kubernetes, the serverless platform's own health checks) uses to decide
 * whether to route traffic to this instance or restart it. Follows the same
 * supertest-against-a-minimal-app pattern as format_routes.contract.test.js.
 */

const mockQueryRaw = jest.fn();
const mockPing = jest.fn();
const mockGetRedisClient = jest.fn();

jest.unstable_mockModule('../../src/config/prisma.js', () => ({
    default: { $queryRaw: mockQueryRaw },
}));

jest.unstable_mockModule('../../src/config/redis.js', () => ({
    getRedisClient: mockGetRedisClient,
}));

const { default: healthRoutes, markShuttingDown } = await import('../../src/routes/healthRoutes.js');

const app = express();
app.use('/api/health', healthRoutes);
// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));

describe('GET /api/health/live', () => {
    beforeEach(() => {
        mockQueryRaw.mockReset();
        mockPing.mockReset();
        mockGetRedisClient.mockReset();
    });

    test('reports UP without touching the database or Redis', async () => {
        const response = await request(app).get('/api/health/live');

        expect(response.status).toBe(200);
        expect((response.body.data || response.body).status).toBe('UP');
        expect(mockQueryRaw).not.toHaveBeenCalled();
        expect(mockGetRedisClient).not.toHaveBeenCalled();
    });
});

describe('GET /api/health/ready', () => {
    beforeEach(() => {
        mockQueryRaw.mockReset();
        mockPing.mockReset();
        mockGetRedisClient.mockReset();
    });

    test('reports ready when the database and Redis both respond', async () => {
        mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);
        mockGetRedisClient.mockReturnValue({ ping: mockPing.mockResolvedValue('PONG') });

        const response = await request(app).get('/api/health/ready');

        expect(response.status).toBe(200);
        const payload = response.body.data || response.body;
        expect(payload.ready).toBe(true);
        expect(payload.services.database).toBe('UP');
        expect(payload.services.redis).toBe('UP');
    });

    test('reports not-ready with a 503 when the database is unreachable', async () => {
        mockQueryRaw.mockRejectedValue(new Error('connection refused'));
        mockGetRedisClient.mockReturnValue(null);

        const response = await request(app).get('/api/health/ready');

        expect(response.status).toBe(503);
        const payload = response.body.data || response.body;
        expect(payload.ready).toBe(false);
        expect(payload.services.database).toBe('DOWN');
    });

    test('degrades (not fails) when Redis is configured but unreachable — Redis is optional', async () => {
        mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);
        mockGetRedisClient.mockReturnValue({ ping: mockPing.mockRejectedValue(new Error('ECONNREFUSED')) });

        const response = await request(app).get('/api/health/ready');

        expect(response.status).toBe(200); // Redis trouble alone does not fail readiness
        const payload = response.body.data || response.body;
        expect(payload.ready).toBe(true);
        expect(payload.services.redis).toBe('DEGRADED');
    });

    test('marks Redis DISABLED (not DOWN) when no client is configured at all', async () => {
        mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);
        mockGetRedisClient.mockReturnValue(null);

        const response = await request(app).get('/api/health/ready');

        const payload = response.body.data || response.body;
        expect(payload.services.redis).toBe('DISABLED');
        expect(payload.ready).toBe(true);
    });
});

describe('shutdown state', () => {
    afterEach(() => {
        // markShuttingDown has no reverse — restore a fresh app import isn't practical, so
        // this suite runs last and other describe blocks above don't depend on order.
    });

    test('markShuttingDown flips /live and /ready to 503 SHUTTING_DOWN', async () => {
        markShuttingDown();

        const live = await request(app).get('/api/health/live');
        expect(live.status).toBe(503);

        const ready = await request(app).get('/api/health/ready');
        expect(ready.status).toBe(503);

        const root = await request(app).get('/api/health/');
        expect(root.status).toBe(503);
    });
});
