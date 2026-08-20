import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const mockQueryRaw = jest.fn();
const mockExecuteRaw = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockEmbedText = jest.fn();

jest.unstable_mockModule('../../src/config/prisma.js', () => ({
    default: {
        $queryRaw: mockQueryRaw,
        $executeRaw: mockExecuteRaw,
        semanticPipelineCache: {
            create: mockCreate,
            update: mockUpdate
        }
    }
}));

jest.unstable_mockModule('../../src/services/knowledge/embeddingService.js', () => ({
    embedText: mockEmbedText
}));

jest.unstable_mockModule('../../src/config/logger.js', () => ({
    default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() }
}));

const { lookupRefinement, storeRefinement } = await import('../../src/services/knowledge/semanticPipelineCache.js');

describe('semanticPipelineCache', () => {
    const originalMockAi = process.env.MOCK_AI;
    const args = { userId: 'u1', sectionName: 'Shell', targetDraft: { a: 1 }, feedback: [{ issue: 'x' }] };

    beforeEach(() => {
        process.env.MOCK_AI = 'false';
        mockEmbedText.mockResolvedValue([0.1, 0.2, 0.3]);
        mockQueryRaw.mockReset();
        mockExecuteRaw.mockReset();
        mockCreate.mockReset();
        mockUpdate.mockReset().mockResolvedValue({});
    });

    afterEach(() => {
        process.env.MOCK_AI = originalMockAi;
    });

    describe('lookupRefinement', () => {
        it('requires a userId regardless of MOCK_AI', async () => {
            await expect(lookupRefinement({ ...args, userId: undefined })).rejects.toThrow(/requires a userId/);
            expect(mockEmbedText).not.toHaveBeenCalled();
        });

        it('is a no-op under MOCK_AI — never touches embedText or the database', async () => {
            process.env.MOCK_AI = 'true';
            const result = await lookupRefinement(args);
            expect(result).toBeNull();
            expect(mockEmbedText).not.toHaveBeenCalled();
            expect(mockQueryRaw).not.toHaveBeenCalled();
        });

        it('returns null when nothing is near-duplicate enough', async () => {
            mockQueryRaw.mockResolvedValue([{ id: 'c1', output: { fixed: true }, similarity: 0.5 }]);
            const result = await lookupRefinement(args);
            expect(result).toBeNull();
            expect(mockUpdate).not.toHaveBeenCalled();
        });

        it('returns the cached output and bumps hit bookkeeping on a near-duplicate match', async () => {
            mockQueryRaw.mockResolvedValue([{ id: 'c1', output: { fixed: true }, similarity: 0.99 }]);
            const result = await lookupRefinement(args);
            expect(result).toEqual({ fixed: true });
            expect(mockUpdate).toHaveBeenCalledWith({
                where: { id: 'c1' },
                data: { hitCount: { increment: 1 }, lastHitAt: expect.any(Date) }
            });
        });

        it('treats a hit right at the similarity threshold as a match', async () => {
            mockQueryRaw.mockResolvedValue([{ id: 'c1', output: { fixed: true }, similarity: 0.97 }]);
            const result = await lookupRefinement(args);
            expect(result).toEqual({ fixed: true });
        });

        it('falls through to null (not a thrown error) when the query fails', async () => {
            mockQueryRaw.mockRejectedValue(new Error('db down'));
            const result = await lookupRefinement(args);
            expect(result).toBeNull();
        });

        it('a bookkeeping update failure does not turn a hit into a miss', async () => {
            mockQueryRaw.mockResolvedValue([{ id: 'c1', output: { fixed: true }, similarity: 0.99 }]);
            mockUpdate.mockRejectedValue(new Error('update failed'));
            const result = await lookupRefinement(args);
            expect(result).toEqual({ fixed: true });
        });
    });

    describe('storeRefinement', () => {
        const storeArgs = { ...args, output: { fixed: true } };

        it('requires a userId regardless of MOCK_AI', async () => {
            await expect(storeRefinement({ ...storeArgs, userId: undefined })).rejects.toThrow(/requires a userId/);
        });

        it('is a no-op under MOCK_AI — never writes anything', async () => {
            process.env.MOCK_AI = 'true';
            await storeRefinement(storeArgs);
            expect(mockCreate).not.toHaveBeenCalled();
            expect(mockExecuteRaw).not.toHaveBeenCalled();
        });

        it('creates the row then sets the embedding via a raw vector update', async () => {
            mockCreate.mockResolvedValue({ id: 'new-id' });
            await storeRefinement(storeArgs);

            expect(mockCreate).toHaveBeenCalledWith({
                data: { userId: 'u1', sectionName: 'Shell', output: { fixed: true } }
            });
            expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
        });

        it('swallows a write failure rather than throwing — caching is best-effort', async () => {
            mockCreate.mockRejectedValue(new Error('write failed'));
            await expect(storeRefinement(storeArgs)).resolves.toBeUndefined();
        });
    });
});
