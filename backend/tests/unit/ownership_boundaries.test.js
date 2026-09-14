import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * Cross-tenant read boundaries.
 *
 * Two read paths returned another user's data to any authenticated caller who had an id:
 * `getJobStatus` (which carries `resultJson` — the whole generated SRS) and
 * `getFullProjectGraph` (the entity graph derived from it). Both took only the resource id.
 *
 * Ids are not the secret here. They appear in URLs, in the CLI's `sra.config.json`, and in
 * the traceability records `sra push` publishes — so "you would have to guess a UUID" was
 * never the control it looked like.
 *
 * These assert against the Prisma query rather than a returned value: the bug was the
 * absence of a filter, and a test that only checks the return value passes just as happily
 * against a query that never mentions the user.
 */

const mockAnalysisFindFirst = jest.fn();
const mockAnalysisFindUnique = jest.fn();
const mockProjectFindFirst = jest.fn();
const mockGraphNodeFindMany = jest.fn();
const mockGraphEdgeFindMany = jest.fn();

jest.unstable_mockModule('../../src/config/prisma.js', () => ({
    default: {
        analysis: { findFirst: mockAnalysisFindFirst, findUnique: mockAnalysisFindUnique },
        project: { findFirst: mockProjectFindFirst },
        graphNode: { findMany: mockGraphNodeFindMany },
        graphEdge: { findMany: mockGraphEdgeFindMany }
    }
}));

process.env.BACKEND_URL = process.env.BACKEND_URL || 'https://backend.test';

jest.unstable_mockModule('../../src/config/logger.js', () => ({
    default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    REDACTED_PATHS: []
}));

const OWNER = 'user-owner';
const INTRUDER = 'user-intruder';
const ANALYSIS_ID = 'a1111111-1111-1111-1111-111111111111';
const PROJECT_ID = 'p2222222-2222-2222-2222-222222222222';

beforeEach(() => {
    jest.clearAllMocks();
});

describe('getJobStatus is scoped to the caller', () => {
    it('filters on userId, not just the job id', async () => {
        const { getJobStatus } = await import('../../src/services/queueService.js');
        mockAnalysisFindFirst.mockResolvedValue({ id: ANALYSIS_ID, status: 'COMPLETED', resultJson: {} });

        await getJobStatus(ANALYSIS_ID, OWNER);

        const where = mockAnalysisFindFirst.mock.calls[0][0].where;
        expect(where).toEqual({ id: ANALYSIS_ID, userId: OWNER });
    });

    it("reports another user's job as unknown, disclosing nothing — not even that it exists", async () => {
        const { getJobStatus } = await import('../../src/services/queueService.js');
        // The row exists, but not for this caller, so the filtered query returns nothing.
        mockAnalysisFindFirst.mockResolvedValue(null);

        const status = await getJobStatus(ANALYSIS_ID, INTRUDER);

        expect(status).toEqual({ status: 'unknown' });
        expect(status).not.toHaveProperty('resultJson');
        expect(status).not.toHaveProperty('result');
    });

    it('refuses to run without a caller rather than defaulting to unscoped', async () => {
        const { getJobStatus } = await import('../../src/services/queueService.js');

        await expect(getJobStatus(ANALYSIS_ID)).rejects.toThrow(/userId/);
        expect(mockAnalysisFindFirst).not.toHaveBeenCalled();
    });
});

describe('getFullProjectGraph is scoped to the caller', () => {
    it('returns the graph when the project belongs to the caller', async () => {
        const { getFullProjectGraph } = await import('../../src/services/knowledge/graphService.js');
        mockProjectFindFirst.mockResolvedValue({ id: PROJECT_ID });
        mockGraphNodeFindMany.mockResolvedValue([{ id: 'n1' }]);
        mockGraphEdgeFindMany.mockResolvedValue([]);

        const graph = await getFullProjectGraph(PROJECT_ID, OWNER);

        expect(mockProjectFindFirst.mock.calls[0][0].where).toEqual({ id: PROJECT_ID, userId: OWNER });
        expect(graph.nodes).toHaveLength(1);
    });

    it("404s another user's project without reading a single node", async () => {
        const { getFullProjectGraph } = await import('../../src/services/knowledge/graphService.js');
        mockProjectFindFirst.mockResolvedValue(null);

        await expect(getFullProjectGraph(PROJECT_ID, INTRUDER)).rejects.toMatchObject({ statusCode: 404 });

        // The point of failing before the node query: no graph data is fetched at all.
        expect(mockGraphNodeFindMany).not.toHaveBeenCalled();
        expect(mockGraphEdgeFindMany).not.toHaveBeenCalled();
    });

    it('refuses to run without a caller', async () => {
        const { getFullProjectGraph } = await import('../../src/services/knowledge/graphService.js');

        await expect(getFullProjectGraph(PROJECT_ID)).rejects.toThrow(/userId/);
        expect(mockProjectFindFirst).not.toHaveBeenCalled();
    });
});

describe('assertOwned', () => {
    it('returns the record when it belongs to the caller', async () => {
        const { assertOwned } = await import('../../src/utils/ownership.js');
        const record = { id: 'p1', userId: OWNER };

        expect(assertOwned(record, OWNER, 'Project')).toBe(record);
    });

    it('404s with a generic message when the record is missing', async () => {
        const { assertOwned } = await import('../../src/utils/ownership.js');

        expect(() => assertOwned(null, OWNER, 'Project')).toThrow(
            expect.objectContaining({ statusCode: 404, message: 'Project not found' })
        );
    });

    it('404s (never 403) when the record belongs to someone else', async () => {
        const { assertOwned } = await import('../../src/utils/ownership.js');
        const record = { id: 'p1', userId: OWNER };

        expect(() => assertOwned(record, INTRUDER, 'Project')).toThrow(
            expect.objectContaining({ statusCode: 404, message: 'Project not found' })
        );
    });
});

describe('getAnalysisById does not distinguish "not yours" from "doesn\'t exist"', () => {
    it('returns the analysis for its owner', async () => {
        const { getAnalysisById } = await import('../../src/services/analysisService.js');
        mockAnalysisFindUnique.mockResolvedValue({ id: ANALYSIS_ID, userId: OWNER, metadata: {} });

        const result = await getAnalysisById(OWNER, ANALYSIS_ID);
        expect(result.id).toBe(ANALYSIS_ID);
    });

    it('returns null (not a thrown 403) when the analysis belongs to someone else', async () => {
        const { getAnalysisById } = await import('../../src/services/analysisService.js');
        mockAnalysisFindUnique.mockResolvedValue({ id: ANALYSIS_ID, userId: OWNER, metadata: {} });

        const result = await getAnalysisById(INTRUDER, ANALYSIS_ID);
        expect(result).toBeNull();
    });

    it('returns null when the analysis does not exist at all', async () => {
        const { getAnalysisById } = await import('../../src/services/analysisService.js');
        mockAnalysisFindUnique.mockResolvedValue(null);

        const result = await getAnalysisById(OWNER, ANALYSIS_ID);
        expect(result).toBeNull();
    });
});

describe('resumeAnalysisJob is scoped to the caller', () => {
    it('404s a non-owner instead of leaking existence with a 403', async () => {
        const { resumeAnalysisJob } = await import('../../src/services/queueService.js');
        mockAnalysisFindUnique.mockResolvedValue({
            id: ANALYSIS_ID, userId: OWNER, status: 'FAILED', metadata: {}
        });

        const error = await resumeAnalysisJob(INTRUDER, ANALYSIS_ID).catch(e => e);

        expect(error.statusCode).toBe(404);
        expect(error.message).toBe('Analysis not found');
    });

    it('404s a missing analysis the same way', async () => {
        const { resumeAnalysisJob } = await import('../../src/services/queueService.js');
        mockAnalysisFindUnique.mockResolvedValue(null);

        const error = await resumeAnalysisJob(OWNER, ANALYSIS_ID).catch(e => e);

        expect(error.statusCode).toBe(404);
        expect(error.message).toBe('Analysis not found');
    });
});
