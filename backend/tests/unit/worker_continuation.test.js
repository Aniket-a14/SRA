import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockPerformAnalysis = jest.fn();
jest.unstable_mockModule('../../src/services/analysisService.js', () => ({
    performAnalysis: mockPerformAnalysis
}));

const mockEnqueueContinuation = jest.fn().mockResolvedValue({ continued: true });
jest.unstable_mockModule('../../src/services/queueService.js', () => ({
    enqueueContinuation: mockEnqueueContinuation
}));

jest.unstable_mockModule('../../src/services/reconciliationService.js', () => ({
    runReconciliation: jest.fn()
}));

const mockUpdateMany = jest.fn();
const mockFindUnique = jest.fn();
jest.unstable_mockModule('../../src/config/prisma.js', () => ({
    default: { analysis: { updateMany: mockUpdateMany, findUnique: mockFindUnique } }
}));

const { processJob } = await import('../../src/controllers/workerController.js');
const { PipelinePausedError } = await import('../../src/services/pipelineBudget.js');

function mockRes() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; }
    };
}

const basePayload = {
    userId: 'u1', text: 'build a leave tracker', projectId: 'p1',
    settings: {}, parentId: null, rootId: 'r1', analysisId: 'a1'
};

describe('processJob — pipeline continuation', () => {
    beforeEach(() => {
        mockPerformAnalysis.mockReset();
        mockEnqueueContinuation.mockClear();
        mockUpdateMany.mockReset();
        mockFindUnique.mockReset();
    });

    it('queues a continuation instead of failing when the pipeline yields', async () => {
        mockUpdateMany.mockResolvedValue({ count: 1 });
        mockPerformAnalysis.mockRejectedValue(new PipelinePausedError('architect'));
        const res = mockRes();
        const next = jest.fn();

        await processJob({ body: basePayload }, res, next);

        expect(mockEnqueueContinuation).toHaveBeenCalledTimes(1);
        expect(mockEnqueueContinuation.mock.calls[0][1]).toBe('architect');
        // Must report success: a non-2xx would make QStash retry the whole payload on its
        // own schedule, racing the continuation this handler just queued.
        expect(res.statusCode).toBe(200);
        expect(res.body.continued).toBe(true);
        expect(next).not.toHaveBeenCalled();
    });

    it('still fails the job on a genuine error', async () => {
        mockUpdateMany.mockResolvedValue({ count: 1 });
        mockPerformAnalysis.mockRejectedValue(new Error('Gemini exploded'));
        const res = mockRes();
        const next = jest.fn();

        await processJob({ body: basePayload }, res, next);

        expect(mockEnqueueContinuation).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalled();
        expect(next.mock.calls[0][0].message).toMatch(/Gemini exploded/);
    });

    it('admits a continuation whose row is already IN_PROGRESS', async () => {
        // The PENDING-only guard exists to drop duplicate QStash deliveries. A continuation
        // is the run handing itself forward, so it must match on IN_PROGRESS instead —
        // otherwise the pipeline's own handoff is discarded as a duplicate and the analysis
        // silently stops halfway.
        mockUpdateMany.mockResolvedValue({ count: 1 });
        mockPerformAnalysis.mockResolvedValue({ ok: true });
        const res = mockRes();

        await processJob({ body: { ...basePayload, continuation: true } }, res, jest.fn());

        expect(mockUpdateMany.mock.calls[0][0].where.status).toBe('IN_PROGRESS');
        expect(res.body.success).toBe(true);
    });

    it('uses the PENDING guard for a first delivery', async () => {
        mockUpdateMany.mockResolvedValue({ count: 1 });
        mockPerformAnalysis.mockResolvedValue({ ok: true });

        await processJob({ body: basePayload }, mockRes(), jest.fn());

        expect(mockUpdateMany.mock.calls[0][0].where.status).toBe('PENDING');
    });

    it('passes a budget into the pipeline so it can yield at all', async () => {
        mockUpdateMany.mockResolvedValue({ count: 1 });
        mockPerformAnalysis.mockResolvedValue({ ok: true });

        await processJob({ body: basePayload }, mockRes(), jest.fn());

        const options = mockPerformAnalysis.mock.calls[0][7];
        expect(options?.budget).toBeDefined();
        expect(typeof options.budget.assertBudget).toBe('function');
    });
});
