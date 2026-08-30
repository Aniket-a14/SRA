import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockAnalysisFindMany = jest.fn();
const mockProjectFindMany = jest.fn();
const mockKnowledgeChunkFindMany = jest.fn();

jest.unstable_mockModule('../../src/config/prisma.js', () => ({
    default: {
        analysis: { findMany: mockAnalysisFindMany },
        project: { findMany: mockProjectFindMany },
        knowledgeChunk: { findMany: mockKnowledgeChunkFindMany }
    }
}));

jest.unstable_mockModule('../../src/config/logger.js', () => ({
    default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    REDACTED_PATHS: []
}));

const USER_ID = 'test-user-123';

beforeEach(() => {
    jest.clearAllMocks();
});

describe('Global Search Service & Controller', () => {
    it('returns empty results on empty or missing query without hitting database', async () => {
        const { globalSearch } = await import('../../src/controllers/searchController.js');

        const req = { user: { userId: USER_ID }, query: { q: '   ' } };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        const next = jest.fn();

        await globalSearch(req, res, next);

        expect(mockAnalysisFindMany).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            data: expect.objectContaining({
                query: '',
                total: 0,
                results: { analyses: [], projects: [], knowledgeChunks: [] }
            })
        }));
    });

    it('enforces userId isolation across all search queries', async () => {
        const { globalSearch } = await import('../../src/controllers/searchController.js');

        mockAnalysisFindMany.mockResolvedValue([
            {
                id: 'analysis-1',
                title: 'Healthcare EHR System',
                version: 1,
                status: 'COMPLETED',
                resultQuality: 'FULL',
                createdAt: new Date('2026-01-01'),
                projectId: 'p1',
                inputText: 'Project: Healthcare EHR System with HIPAA compliance',
                project: { id: 'p1', name: 'HealthTech' }
            }
        ]);
        mockProjectFindMany.mockResolvedValue([
            {
                id: 'p1',
                name: 'HealthTech Portal',
                description: 'Enterprise healthcare portal',
                updatedAt: new Date('2026-01-01'),
                _count: { analyses: 2 }
            }
        ]);
        mockKnowledgeChunkFindMany.mockResolvedValue([]);

        const req = { user: { userId: USER_ID }, query: { q: 'health' } };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        const next = jest.fn();

        await globalSearch(req, res, next);

        expect(mockAnalysisFindMany).toHaveBeenCalledTimes(1);
        const analysisWhere = mockAnalysisFindMany.mock.calls[0][0].where;
        expect(analysisWhere.userId).toBe(USER_ID);

        expect(mockProjectFindMany).toHaveBeenCalledTimes(1);
        const projectWhere = mockProjectFindMany.mock.calls[0][0].where;
        expect(projectWhere.userId).toBe(USER_ID);

        expect(mockKnowledgeChunkFindMany).toHaveBeenCalledTimes(1);
        const chunkWhere = mockKnowledgeChunkFindMany.mock.calls[0][0].where;
        expect(chunkWhere.userId).toBe(USER_ID);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            data: expect.objectContaining({
                query: 'health',
                total: 2,
                results: expect.objectContaining({
                    analyses: expect.arrayContaining([
                        expect.objectContaining({
                            id: 'analysis-1',
                            title: 'Healthcare EHR System',
                            projectName: 'HealthTech'
                        })
                    ]),
                    projects: expect.arrayContaining([
                        expect.objectContaining({
                            id: 'p1',
                            name: 'HealthTech Portal',
                            analysisCount: 2
                        })
                    ])
                })
            })
        }));
    });
});
