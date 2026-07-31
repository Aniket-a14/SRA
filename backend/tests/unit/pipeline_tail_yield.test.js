import { jest, describe, it, expect, beforeEach } from '@jest/globals';

/**
 * Where the pipeline is allowed to stop.
 *
 * Everything after the Developer draft — diagram repair, the reflection passes, the final
 * evaluation — used to run with no yield point between them. A checkpoint landing just inside
 * the deadline was followed by two minutes of unguarded work, and the invocation was killed
 * mid-audit: the analysis stayed IN_PROGRESS holding a stale checkpoint, the progress stream
 * went silent, and the page sat on the last stage it had been told about. That is the dead
 * state a production run hit on 2026-07-29 (draft checkpointed at 220s, killed at 300s
 * during the second reflection pass).
 */

const analysisRow = { metadata: {} };
const mockAnalysisUpdate = jest.fn(async ({ data }) => {
    if (data.metadata) analysisRow.metadata = data.metadata;
    return data;
});

jest.unstable_mockModule('../../src/config/prisma.js', () => ({
    default: {
        $transaction: jest.fn(async (cb) => cb({
            analysis: {
                findUnique: jest.fn(async () => ({ id: 'a1', title: null, metadata: analysisRow.metadata })),
                findFirst: jest.fn(),
                update: jest.fn(async () => ({})),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
                delete: jest.fn(),
                deleteMany: jest.fn().mockResolvedValue({ count: 0 })
            },
            project: { create: jest.fn(async () => ({ id: 'p1' })), findFirst: jest.fn() },
            knowledgeChunk: { createMany: jest.fn(), deleteMany: jest.fn() }
        })),
        $queryRaw: jest.fn().mockResolvedValue([]),
        analysis: {
            findUnique: jest.fn(async () => analysisRow),
            update: mockAnalysisUpdate,
            updateMany: jest.fn().mockResolvedValue({ count: 1 })
        },
        user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', name: 'Tester' }) }
    }
}));

const mockGenerateSrsSections = jest.fn(async () => ({
    srsShell: { introduction: { purpose: 'p' } },
    allFeatures: [{ name: 'F1' }],
    srsRequirements: { nonFunctionalRequirements: {} },
    srsAppendices: { appendices: {} },
    srsDraft: { projectTitle: 'Draft', introduction: { purpose: 'p' } }
}));
jest.unstable_mockModule('../../src/services/pipeline/developerStage.js', () => ({
    generateSrsSections: mockGenerateSrsSections
}));

const mockRepairDiagrams = jest.fn().mockResolvedValue(undefined);
jest.unstable_mockModule('../../src/services/pipeline/diagramRepair.js', () => ({
    validateAndAutoRepairDiagrams: mockRepairDiagrams
}));

const mockReflectionLoop = jest.fn(async ({ srsDraft, sections }) => ({
    srsDraft: srsDraft ?? sections.srsDraft, loopCount: 0, finalIndustryAudit: { overallScore: 91 }
}));
jest.unstable_mockModule('../../src/services/pipeline/reflectionStage.js', () => ({
    runReflectionLoop: mockReflectionLoop,
    normalizeScore: (n) => n,
    isApprovedStatus: () => true
}));

const mockSelectNextFallbackModel = jest.fn();
const mockEnqueueContinuation = jest.fn();
jest.unstable_mockModule('../../src/services/providers/modelFallbackService.js', () => ({
    selectNextFallbackModel: mockSelectNextFallbackModel
}));
jest.unstable_mockModule('../../src/services/queueService.js', () => ({
    enqueueContinuation: mockEnqueueContinuation
}));
jest.unstable_mockModule('../../src/config/redis.js', () => ({
    getRedisClient: jest.fn(() => null)
}));
jest.unstable_mockModule('../../src/services/progressService.js', () => ({
    publishProgress: jest.fn().mockResolvedValue(undefined)
}));

jest.unstable_mockModule('../../src/services/knowledge/ragService.js', () => ({
    retrieveContext: jest.fn().mockResolvedValue([]),
    formatRagContext: jest.fn().mockResolvedValue('')
}));

jest.unstable_mockModule('../../src/services/knowledge/evalService.js', () => ({
    EvalService: class { evaluateRAG() { return Promise.resolve({ faithfulness: 1 }); } }
}));

jest.unstable_mockModule('../../src/services/knowledge/graphService.js', () => ({
    extractGraph: jest.fn().mockResolvedValue(undefined)
}));

jest.unstable_mockModule('../../src/services/qualityService.js', () => ({
    lintRequirements: jest.fn(() => ({ issues: [] })),
    checkAlignment: jest.fn().mockResolvedValue({ status: 'ALIGNED' })
}));

const { performAnalysis } = await import('../../src/services/analysisService.js');
const { createStageBudget, STAGE_COST_MS } = await import('../../src/services/pipelineBudget.js');

const run = (budget, settings = {}) => performAnalysis(
    'u1', 'build a leave tracker', 'p1', null, 'r1', settings, 'a1', { budget }
);

beforeEach(() => {
    analysisRow.metadata = {};
    mockAnalysisUpdate.mockClear();
    mockGenerateSrsSections.mockClear();
    mockRepairDiagrams.mockClear();
    mockReflectionLoop.mockClear();
    mockSelectNextFallbackModel.mockReset();
    mockEnqueueContinuation.mockReset();
    mockEnqueueContinuation.mockResolvedValue({ continued: true });
});

describe('performAnalysis — yielding in the tail', () => {
    it('hands the run on rather than starting a reflection pass it cannot finish', async () => {
        // The shape of the run that timed out: the draft lands with a little budget left —
        // enough to pass a past-the-deadline check, nowhere near enough for the reflection loop.
        const budget = createStageBudget(STAGE_COST_MS.diagram_repair + 5000);

        await expect(run(budget)).rejects.toMatchObject({ paused: true });

        expect(mockGenerateSrsSections).toHaveBeenCalledTimes(1);
        // The tail never starts. Previously it did, and was killed part-way through.
        expect(mockReflectionLoop).not.toHaveBeenCalled();
    });

    it('checkpoints the draft before yielding, so nothing paid for is lost', async () => {
        const budget = createStageBudget(STAGE_COST_MS.diagram_repair + 5000);

        await run(budget).catch(() => {});

        expect(analysisRow.metadata.checkpoint).toMatchObject({
            srsDraft: { projectTitle: 'Draft' }
        });
        expect(analysisRow.metadata.checkpoint.legacySections).toBeDefined();
    });

    it('does not mark a paused run FAILED or persist it as a partial result', async () => {
        const budget = createStageBudget(0);

        await run(budget).catch(() => {});

        // The failsafe writes status COMPLETED with a PARTIAL result; a pause must escape it.
        const statuses = mockAnalysisUpdate.mock.calls.map(([{ data }]) => data.status).filter(Boolean);
        expect(statuses).not.toContain('FAILED');
        expect(statuses).not.toContain('COMPLETED');
    });

    it('resumes into the tail without redrafting or re-repairing', async () => {
        // First invocation stops after the draft.
        await run(createStageBudget(STAGE_COST_MS.diagram_repair + 5000)).catch(() => {});
        expect(analysisRow.metadata.checkpoint.srsDraft).toBeDefined();
        mockGenerateSrsSections.mockClear();

        // Second invocation, full budget: picks up where the first stopped.
        await run(createStageBudget(240000));

        expect(mockGenerateSrsSections).not.toHaveBeenCalled();
        expect(mockReflectionLoop).toHaveBeenCalledTimes(1);
    });

    it('skips diagram repair that a previous invocation already paid for', async () => {
        // Stop with just enough budget to repair diagrams but not to audit.
        await run(createStageBudget(STAGE_COST_MS.diagram_repair + 5000)).catch(() => {});
        await run(createStageBudget(STAGE_COST_MS.reflection_pass + 5000)).catch(() => {});
        const repairsSoFar = mockRepairDiagrams.mock.calls.length;

        await run(createStageBudget(240000));

        // Repair rewrites the draft in place; running it again is an AI call fixing nothing.
        expect(mockRepairDiagrams.mock.calls.length).toBe(repairsSoFar);
    });

    it('stores the draft once per checkpoint, not once per place that reads it', async () => {
        mockReflectionLoop.mockImplementationOnce(async ({ sections, onPassComplete }) => {
            await onPassComplete({
                loopCount: 1, finalIndustryAudit: { overallScore: 70 },
                srsDraft: sections.srsDraft, allFeatures: sections.allFeatures, done: false
            });
            return { srsDraft: sections.srsDraft, loopCount: 1, finalIndustryAudit: { overallScore: 91 } };
        });

        await run(createStageBudget(240000));

        // A generated SRS runs to tens of kilobytes; keeping a copy inside `reflection` as
        // well would write it three times over on every pass.
        expect(analysisRow.metadata.checkpoint.reflection).toEqual({
            loopCount: 1, finalIndustryAudit: { overallScore: 70 }, done: false
        });
    });

    it('runs straight through when the budget is ample', async () => {
        await run(createStageBudget(240000));

        expect(mockGenerateSrsSections).toHaveBeenCalledTimes(1);
        expect(mockRepairDiagrams).toHaveBeenCalledTimes(1);
        expect(mockReflectionLoop).toHaveBeenCalledTimes(1);
    });

    it('queues an approved model fallback instead of finalizing a quota failure as partial', async () => {
        mockReflectionLoop.mockRejectedValueOnce(Object.assign(new Error('daily quota exhausted'), {
            quotaExhausted: true
        }));
        mockSelectNextFallbackModel.mockResolvedValueOnce({
            provider: 'OPENAI',
            modelName: 'gpt-backup'
        });

        await run(createStageBudget(240000), {
            modelProvider: 'GEMINI',
            modelName: 'gemini-primary',
            allowModelFallback: true,
            fallbackModels: [{ modelProvider: 'OPENAI', modelName: 'gpt-backup' }]
        });

        expect(mockSelectNextFallbackModel).toHaveBeenCalledWith(
            'u1',
            expect.objectContaining({ allowModelFallback: true }),
            [{ provider: 'GEMINI', modelName: 'gemini-primary' }]
        );
        expect(mockEnqueueContinuation).toHaveBeenCalledWith(
            expect.objectContaining({
                analysisId: 'a1',
                settings: expect.objectContaining({
                    modelProvider: 'OPENAI',
                    modelName: 'gpt-backup'
                })
            }),
            'quota_fallback'
        );

        const statuses = mockAnalysisUpdate.mock.calls
            .map(([{ data }]) => data.status)
            .filter(Boolean);
        expect(statuses).toContain('IN_PROGRESS');
        expect(statuses).not.toContain('COMPLETED');
    });

    it('does not leave the analysis IN_PROGRESS when the fallback handoff cannot be queued', async () => {
        mockReflectionLoop.mockRejectedValueOnce(Object.assign(new Error('daily quota exhausted'), {
            quotaExhausted: true
        }));
        mockSelectNextFallbackModel.mockResolvedValueOnce({
            provider: 'OPENAI',
            modelName: 'gpt-backup'
        });
        mockEnqueueContinuation.mockRejectedValueOnce(new Error('QStash unavailable'));

        await run(createStageBudget(240000), {
            modelProvider: 'GEMINI',
            modelName: 'gemini-primary',
            allowModelFallback: true,
            fallbackModels: [{ modelProvider: 'OPENAI', modelName: 'gpt-backup' }]
        });

        const lastCall = mockAnalysisUpdate.mock.calls.at(-1)[0];
        expect(lastCall.data.status).not.toBe('IN_PROGRESS');
        expect(lastCall.data.metadata.promptSettings?.modelName).not.toBe('gpt-backup');
    });

    it('keeps an exhausted fallback chain resumable with its checkpoint', async () => {
        mockReflectionLoop.mockRejectedValueOnce(Object.assign(new Error('daily quota exhausted'), {
            quotaExhausted: true
        }));
        mockSelectNextFallbackModel.mockResolvedValueOnce(null);

        await run(createStageBudget(240000), {
            modelProvider: 'GEMINI',
            modelName: 'gemini-primary',
            allowModelFallback: true,
            fallbackModels: [{ modelProvider: 'OPENAI', modelName: 'gpt-backup' }]
        });

        const lastCall = mockAnalysisUpdate.mock.calls.at(-1)[0];
        expect(lastCall.data.status).toBe('FAILED');
        expect(lastCall.data.resultQuality).toBe('PARTIAL');
        expect(lastCall.data.metadata.resumable).toBe(true);
        expect(lastCall.data.metadata.checkpoint.srsDraft).toBeDefined();
        expect(lastCall.data.metadata.userFriendlyError).toMatch(/add another approved model and resume/i);
    });
});
