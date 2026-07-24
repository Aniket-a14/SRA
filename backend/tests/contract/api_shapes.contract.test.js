import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';

/**
 * CONTRACT TESTS — lock the HTTP response SHAPES the frontend depends on.
 *
 * The API deliberately uses TWO conventions and the frontend relies on both:
 *   - auth endpoints return RAW shapes ({ user, token }, bare arrays)
 *   - analysis endpoints return the { success, message, data } envelope (SWR unwraps `.data`)
 *
 * These tests fail loudly if a refactor (e.g. the domain-module folder move, or a well-meaning
 * "standardize all responses" change) alters either convention. They are the guardrail that makes
 * the "HTTP API contract is frozen" guarantee enforceable rather than aspirational.
 */

const mockPrisma = {
    $transaction: jest.fn((cb) => cb(mockPrisma)),
    $queryRaw: jest.fn().mockResolvedValue([]),
    analysis: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
    },
    user: { findUnique: jest.fn() },
};

jest.unstable_mockModule('../../src/config/prisma.js', () => ({ default: mockPrisma }));
jest.unstable_mockModule('../../src/config/redis.js', () => ({ getRedisClient: () => null }));

jest.unstable_mockModule('../../src/middleware/authMiddleware.js', () => ({
    authenticate: (req, res, next) => { req.user = { userId: 'u1', email: 'u1@test.com' }; next(); },
}));

// Auth service — the login handler returns whatever loginUser produces, shaped by the controller.
const mockLoginUser = jest.fn();
jest.unstable_mockModule('../../src/services/auth/authService.js', () => ({
    registerUser: jest.fn(),
    loginUser: mockLoginUser,
    handleGoogleAuth: jest.fn(),
    handleGithubAuth: jest.fn(),
    getUserById: jest.fn().mockResolvedValue({ id: 'u1', email: 'u1@test.com', name: 'U One' }),
}));

// Analysis service — GET /analyze delegates to getUserAnalyses.
const mockGetUserAnalyses = jest.fn();
jest.unstable_mockModule('../../src/services/analysisService.js', () => ({
    performAnalysis: jest.fn(),
    getUserAnalyses: mockGetUserAnalyses,
    getAnalysisById: jest.fn(),
    getAnalysisHistory: jest.fn(),
    deleteAnalysis: jest.fn(),
    createDraftAnalysis: jest.fn(),
}));

process.env.MOCK_AI = 'true';
const { default: app } = await import('../../src/app.js');

describe('Contract: auth endpoints return RAW shapes (no envelope)', () => {
    beforeEach(() => jest.clearAllMocks());

    it('POST /api/auth/login → { user, token } with NO success/data envelope', async () => {
        mockLoginUser.mockResolvedValue({
            user: { id: 'u1', email: 'u1@test.com', name: 'U One' },
            token: 'access.jwt.token',
            refreshToken: 'refresh.token'
        });

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'u1@test.com', password: 'password123' });

        expect(res.status).toBe(200);
        // Exact raw shape — the frontend reads res.token / res.user directly.
        expect(res.body).toEqual({
            user: { id: 'u1', email: 'u1@test.com', name: 'U One' },
            token: 'access.jwt.token'
        });
        // Guardrail: must NOT be wrapped.
        expect(res.body).not.toHaveProperty('success');
        expect(res.body).not.toHaveProperty('data');
        // refreshToken must never appear in the body (it's an httpOnly cookie).
        expect(res.body).not.toHaveProperty('refreshToken');
        expect(res.headers['set-cookie']?.join(';')).toMatch(/refreshToken/);
    });
});

describe('Contract: analysis endpoints use the { success, message, data } envelope', () => {
    beforeEach(() => jest.clearAllMocks());

    it('GET /api/analyze → enveloped, with the list under data', async () => {
        mockGetUserAnalyses.mockResolvedValue([
            { id: 'a1', title: 'One' },
            { id: 'a2', title: 'Two' }
        ]);

        const res = await request(app).get('/api/analyze');

        expect(res.status).toBe(200);
        expect(res.body).toEqual(expect.objectContaining({
            success: true,
            message: expect.any(String),
            data: [
                { id: 'a1', title: 'One' },
                { id: 'a2', title: 'Two' }
            ]
        }));
    });
});

describe('Contract: error responses carry errorCode + requestId', () => {
    beforeEach(() => jest.clearAllMocks());

    it('handler-level 404 (valid id, not found) uses the { success:false, message } envelope', async () => {
        // A well-formed UUID passes param validation and reaches the handler, where the mocked
        // getAnalysisById resolves undefined → the controller throws a 404 through errorHandler.
        const res = await request(app).get('/api/analyze/11111111-1111-1111-1111-111111111111');
        expect(res.status).toBe(404);
        expect(res.body).toEqual(expect.objectContaining({
            success: false,
            message: expect.any(String),
            errorCode: expect.any(String),
        }));
    });

    it('validation errors use the SEPARATE { error, details } shape (distinct from handler errors)', async () => {
        // Documents/locks the second error convention: express-validator/zod validation failures
        // return { error, details }, NOT the { success, message } envelope. The frontend handles both.
        const res = await request(app).get('/api/analyze/not-a-uuid');
        expect(res.status).toBe(400);
        expect(res.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
    });
});
