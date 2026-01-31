import { jest } from '@jest/globals';
import request from 'supertest';

// 1. Setup Mocks
const mockPrisma = {
    $transaction: jest.fn(async (cb) => cb(mockPrisma)),
    $queryRaw: jest.fn().mockResolvedValue([]),
    analysis: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn((args) => {
            if (!args || !args.data) return {};
            return args.data; // Return data as if updated
        }),
    },
    project: {
        findFirst: jest.fn(),
        create: jest.fn(),
    },
    knowledgeChunk: {
        createMany: jest.fn()
    }
};

jest.unstable_mockModule('../../src/config/prisma.js', () => ({
    default: mockPrisma,
}));

jest.unstable_mockModule('../../src/middleware/authMiddleware.js', () => ({
    authenticate: (req, res, next) => {
        console.log("Mock Auth Middleware Hit");
        req.user = { userId: 'e2e-user', email: 'e2e@test.com' };
        next();
    },
}));

jest.unstable_mockModule('../../src/services/embeddingService.js', () => ({
    embedText: jest.fn().mockResolvedValue([]),
}));

jest.unstable_mockModule('@upstash/qstash', () => ({
    Receiver: class {
        verify() { return Promise.resolve(true); }
    }
}));

jest.unstable_mockModule('../../src/services/aiService.js', () => ({
    analyzeText: jest.fn().mockResolvedValue({
        success: true,
        srs: { projectTitle: 'Directly Mocked AI' },
        meta: { promptVersion: 'mock-v1' }
    }),
    repairDiagram: jest.fn().mockResolvedValue("graph TD\n  A --> B")
}));

// Setup Queue Mock to bypass network and call worker directly
// import { processJob } from '../../src/controllers/workerController.js';

jest.unstable_mockModule('../../src/services/queueService.js', () => ({
    addAnalysisJob: jest.fn(async (userId, text, projectId, parentId, rootId, settings) => {
        const { processJob } = await import('../../src/controllers/workerController.js');
        const id = 'generated-id';
        await mockPrisma.analysis.create({
            data: { id, userId, inputText: text, projectId, status: 'PENDING' }
        });

        // Trigger Worker Async
        processJob({
            body: { userId, text, projectId, analysisId: id }
        }, {
            status: () => ({ json: () => { } })
        }, (err) => {
            if (err) console.error("Worker Error:", err);
        });

        return { id: 'mock-job', analysisId: id };
    }),
    getJobStatus: jest.fn()
}));

// process.env.MOCK_QSTASH = 'true'; // Not needed if we mock the service
process.env.MOCK_AI = 'true';
process.env.BACKEND_URL = 'http://localhost:3000'; // Still needed? Maybe not.

const { default: app } = await import('../../src/app.js');

// Helper to wait for mock calls (since queueService runs async)
// Helper to wait for specific status update
const waitForStatus = async (mockFn, status, timeout = 3000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const calls = mockFn.mock.calls;
        if (calls.some(call => call[0].data?.status === status)) return;
        await new Promise(r => setTimeout(r, 100));
    }
    throw new Error(`Timeout waiting for status ${status}`);
};

describe('E2E Golden Path: Request -> Queue(Mock) -> Worker(Local) -> DB', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should process a request from API input to DB completion', async () => {
        const testProjectId = '123e4567-e89b-12d3-a456-426614174000'; // Specific UUID for Zod validation

        // Setup initial DB state for Create
        mockPrisma.project.findFirst.mockResolvedValue({ id: testProjectId });

        // Mock transaction create return
        mockPrisma.analysis.create.mockImplementation((args) => {
            return { ...args.data }; // Return whatever was created
        });

        // Mock findUnique for the update phase
        mockPrisma.analysis.findUnique.mockResolvedValue({
            id: 'generated-id',
            version: 1,
            metadata: { draftData: {} },
            inputText: "Test Input"
        });

        // 1. Submit Request
        const res = await request(app)
            .post('/api/analyze')
            .send({
                text: 'Create a system for managing users.',
                projectId: testProjectId
            });

        expect(res.status).toBe(202);
        const jobId = res.body.data.jobId;
        expect(jobId).toBeDefined();

        // 2. Wait for Worker (async local execution)
        // logic in queueService.js: await performAnalysis(...) -> calls prisma.update
        // We now have intermediate IN_PROGRESS updates, so we must wait for COMPLETED.
        await waitForStatus(mockPrisma.analysis.update, 'COMPLETED', 14000);

        // 3. Verify Updates
        const updateCalls = mockPrisma.analysis.update.mock.calls;
        const completionCall = updateCalls.find(call => call[0]?.data?.status === 'COMPLETED');

        if (!completionCall) {
            console.error("DEBUG: No COMPLETED call found in updates:", JSON.stringify(updateCalls));
        }

        expect(completionCall).toBeDefined();
        // Check content implies it came from MOCK_AI (Project Title: Mocked Project)
        const resultJson = completionCall[0].data.resultJson;
        expect(resultJson).toBeDefined();

        console.log("DEBUG: Actual resultJson projectTitle:", resultJson?.projectTitle);
        console.log("DEBUG: Full resultJson:", JSON.stringify(resultJson, null, 2));

        // Now comes from mocked aiService.js
        expect(resultJson.projectTitle).toBe('Directly Mocked AI');
    }, 15000);
});
