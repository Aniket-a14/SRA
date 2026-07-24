import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const mockQueryRaw = jest.fn();
const mockEmbedText = jest.fn();
const mockTraverseGraph = jest.fn();

jest.unstable_mockModule('../../src/config/prisma.js', () => ({
    default: {
        $queryRaw: mockQueryRaw
    }
}));

jest.unstable_mockModule('../../src/services/knowledge/embeddingService.js', () => ({
    embedText: mockEmbedText
}));

jest.unstable_mockModule('../../src/services/knowledge/graphService.js', () => ({
    traverseGraph: mockTraverseGraph
}));

jest.unstable_mockModule('../../src/config/logger.js', () => ({
    default: {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn()
    }
}));

jest.unstable_mockModule('../../src/config/gemini.js', () => ({
    genAI: {}
}));

const { retrieveContext } = await import('../../src/services/knowledge/ragService.js');

describe('RAG Service retrieveContext', () => {
    const originalMockAi = process.env.MOCK_AI;

    beforeEach(() => {
        process.env.MOCK_AI = 'false';
        mockEmbedText.mockResolvedValue([0.1, 0.2, 0.3]);
        mockTraverseGraph.mockResolvedValue(null);
        mockQueryRaw.mockReset();
    });

    afterEach(() => {
        process.env.MOCK_AI = originalMockAi;
    });

    it('falls back to the default limit when limit is non-numeric', async () => {
        mockQueryRaw.mockResolvedValue([]);

        await retrieveContext('query', null, 'abc');

        expect(mockQueryRaw).toHaveBeenCalledTimes(1);
        const queryArgs = mockQueryRaw.mock.calls[0];
        expect(queryArgs[queryArgs.length - 1]).toBe(15); // safeLimit (5) * 3 over-fetch
    });

    it('floors positive decimals and clamps non-positive limits to 1', async () => {
        mockQueryRaw.mockResolvedValue([]);

        await retrieveContext('query', null, 3.9);
        let queryArgs = mockQueryRaw.mock.calls[0];
        expect(queryArgs[queryArgs.length - 1]).toBe(9); // safeLimit (3) * 3 over-fetch

        mockQueryRaw.mockClear();
        await retrieveContext('query', null, -4);
        queryArgs = mockQueryRaw.mock.calls[0];
        expect(queryArgs[queryArgs.length - 1]).toBe(3); // safeLimit (1) * 3 over-fetch
    });

    it('keeps only matches at or above the similarity threshold', async () => {
        mockQueryRaw.mockResolvedValue([
            { type: 'REQ', content: 'low', similarity: 0.2, qualityScore: 0.9, tags: [], source_title: 'A' },
            { type: 'REQ', content: 'edge', similarity: 0.25, qualityScore: 0.9, tags: [], source_title: 'Edge' },
            { type: 'REQ', content: 'high', similarity: 0.3, qualityScore: 0.9, tags: [], source_title: 'B' }
        ]);

        const result = await retrieveContext('query');

        expect(result).toEqual([
            expect.objectContaining({
                content: 'edge',
                similarity: 0.25,
                sourceTitle: 'Edge'
            }),
            expect.objectContaining({
                content: 'high',
                similarity: 0.3,
                sourceTitle: 'B'
            })
        ]);
    });
});
