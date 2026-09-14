import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockAnalysisFindMany = jest.fn();
const mockProjectFindMany = jest.fn();
const mockKnowledgeChunkFindMany = jest.fn();

jest.unstable_mockModule('../../src/config/prisma.js', () => ({
    default: {
        analysis: { findMany: mockAnalysisFindMany },
        project: { findMany: mockProjectFindMany },
        knowledgeChunk: { findMany: mockKnowledgeChunkFindMany },
    },
}));

jest.unstable_mockModule('../../src/config/logger.js', () => ({
    default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    REDACTED_PATHS: [],
}));

const { globalSearch } = await import('../../src/controllers/searchController.js');

function makeReq(q, userId = 'user-1') {
    return { query: { q }, user: userId ? { userId } : undefined };
}

function makeRes() {
    return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

describe('globalSearch', () => {
    let next;

    beforeEach(() => {
        mockAnalysisFindMany.mockReset();
        mockProjectFindMany.mockReset();
        mockKnowledgeChunkFindMany.mockReset();
        next = jest.fn();
    });

    it('401s an unauthenticated request without touching the database', async () => {
        const res = makeRes();
        await globalSearch(makeReq('login', null), res, next);

        expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
        expect(mockAnalysisFindMany).not.toHaveBeenCalled();
    });

    it('short-circuits an empty query to an empty result set without querying the database', async () => {
        const res = makeRes();
        await globalSearch(makeReq(''), res, next);

        expect(mockAnalysisFindMany).not.toHaveBeenCalled();
        expect(mockProjectFindMany).not.toHaveBeenCalled();
        expect(mockKnowledgeChunkFindMany).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            data: { query: '', total: 0, results: { analyses: [], projects: [], knowledgeChunks: [] } },
        }));
    });

    it('scopes every query to the authenticated user', async () => {
        mockAnalysisFindMany.mockResolvedValue([]);
        mockProjectFindMany.mockResolvedValue([]);
        mockKnowledgeChunkFindMany.mockResolvedValue([]);
        const res = makeRes();

        await globalSearch(makeReq('login', 'user-42'), res, next);

        expect(mockAnalysisFindMany.mock.calls[0][0].where.userId).toBe('user-42');
        expect(mockProjectFindMany.mock.calls[0][0].where.userId).toBe('user-42');
        expect(mockKnowledgeChunkFindMany.mock.calls[0][0].where.userId).toBe('user-42');
    });

    it('formats results with a contextual snippet around the match', async () => {
        mockAnalysisFindMany.mockResolvedValue([{
            id: 'a1', title: 'Login System', version: 1, status: 'COMPLETED', resultQuality: 'FULL',
            createdAt: new Date('2026-01-01'), projectId: 'p1',
            inputText: 'A long requirements document describing a login flow with rate limiting for the platform.',
            project: { id: 'p1', name: 'Auth Platform' },
        }]);
        mockProjectFindMany.mockResolvedValue([{
            id: 'p1', name: 'Auth Platform', description: 'Login-related work', updatedAt: new Date('2026-01-02'),
            _count: { analyses: 3 },
        }]);
        mockKnowledgeChunkFindMany.mockResolvedValue([]);
        const res = makeRes();

        await globalSearch(makeReq('login flow'), res, next);

        const payload = res.json.mock.calls[0][0].data;
        expect(payload.total).toBe(2);
        expect(payload.results.analyses[0].snippet).toContain('login flow');
        expect(payload.results.analyses[0].projectName).toBe('Auth Platform');
        expect(payload.results.projects[0].analysisCount).toBe(3);
    });

    it('truncates an overlong query to 100 characters before querying', async () => {
        mockAnalysisFindMany.mockResolvedValue([]);
        mockProjectFindMany.mockResolvedValue([]);
        mockKnowledgeChunkFindMany.mockResolvedValue([]);
        const res = makeRes();

        await globalSearch(makeReq('x'.repeat(500)), res, next);

        const usedQuery = mockAnalysisFindMany.mock.calls[0][0].where.OR[0].title.contains;
        expect(usedQuery).toHaveLength(100);
    });

    it('forwards a database failure to next() instead of throwing unhandled', async () => {
        const dbError = new Error('connection reset');
        mockAnalysisFindMany.mockRejectedValue(dbError);
        mockProjectFindMany.mockResolvedValue([]);
        mockKnowledgeChunkFindMany.mockResolvedValue([]);
        const res = makeRes();

        await globalSearch(makeReq('login'), res, next);

        expect(next).toHaveBeenCalledWith(dbError);
    });
});
