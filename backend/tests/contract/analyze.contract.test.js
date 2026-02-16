import { jest } from '@jest/globals';
import request from 'supertest';

// Mock Prisma
const mockPrisma = {
    $transaction: jest.fn((callback) => callback(mockPrisma)),
    $queryRaw: jest.fn(),
    analysis: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findFirst: jest.fn(),
    },
    project: {
        findFirst: jest.fn(),
        create: jest.fn(),
    },
    user: {
        findUnique: jest.fn()
    }
};

// Use unstable_mockModule for ESM mocking
jest.unstable_mockModule('../../src/config/prisma.js', () => ({
    default: mockPrisma,
}));

// Mock Auth Middleware
jest.unstable_mockModule('../../src/middleware/authMiddleware.js', () => ({
    authenticate: (req, res, next) => {
        req.user = { userId: 'test-user-id', email: 'test@example.com' };
        next();
    },
}));

// Mock Queue Service
jest.unstable_mockModule('../../src/services/queueService.js', () => ({
    addAnalysisJob: jest.fn().mockResolvedValue({ id: 'job-id' }),
    getJobStatus: jest.fn(),
}));

// Mock AI Service/Embedding (prevent external calls)
jest.unstable_mockModule('../../src/services/embeddingService.js', () => ({
    embedText: jest.fn().mockResolvedValue([]),
}));


process.env.MOCK_AI = 'true';
// Dynamic import of app after mocks
const { default: app } = await import('../../src/app.js');

describe('Contract Test: POST /api/analyze', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should accept valid text input and return 202 status with jobId', async () => {
        // Setup mocks
        mockPrisma.project.findFirst.mockResolvedValue(null);
        mockPrisma.project.create.mockResolvedValue({ id: 'new-project-id' });

        const response = await request(app)
            .post('/api/analyze')
            .send({
                text: 'System must support user login.',
            });

        expect(response.status).toBe(202);
        expect(response.body).toEqual(expect.objectContaining({
            message: 'Analysis queued',
            data: expect.objectContaining({
                jobId: 'job-id',
                status: 'queued'
            })
        }));
    });

    it('should reject empty text input with 400', async () => {
        const response = await request(app)
            .post('/api/analyze')
            .send({
                text: '   ',
            });

        expect(response.status).toBe(400);
        // You might check the error message too
    });

    it('should NOT auto-create project synchronously (deferred)', async () => {
        mockPrisma.project.findFirst.mockResolvedValue(null);
        mockPrisma.project.create.mockResolvedValue({ id: 'auto-created-id' });

        await request(app)
            .post('/api/analyze')
            .send({ text: 'New Project Requirement' });

        // Project creation is now deferred to the worker
        expect(mockPrisma.project.create).not.toHaveBeenCalled();
    });
});
