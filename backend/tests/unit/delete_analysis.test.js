import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockFindUnique = jest.fn();
const mockCount = jest.fn();
const mockDelete = jest.fn();
const mockFindMany = jest.fn();
const mockDeleteMany = jest.fn();

jest.unstable_mockModule('../../src/config/prisma.js', () => ({
    default: {
        analysis: {
            findUnique: mockFindUnique,
            count: mockCount,
            delete: mockDelete,
            findMany: mockFindMany,
            deleteMany: mockDeleteMany
        }
    }
}));

// getRedisClient is only used for best-effort cache invalidation here — keep it a no-op
// so this test stays focused on deleteAnalysis's own ownership/leaf/finalized logic.
jest.unstable_mockModule('../../src/config/redis.js', () => ({
    getRedisClient: () => null
}));

const { deleteAnalysis } = await import('../../src/services/analysisService.js');

describe('deleteAnalysis', () => {
    beforeEach(() => {
        mockFindUnique.mockReset();
        mockCount.mockReset();
        mockDelete.mockReset();
        mockFindMany.mockReset();
        mockDeleteMany.mockReset();
    });

    it('throws 404 when the analysis does not exist', async () => {
        mockFindUnique.mockResolvedValue(null);

        await expect(deleteAnalysis('user-1', 'missing-id')).rejects.toThrow('Analysis not found');
    });

    it('throws 403 when the analysis belongs to a different user', async () => {
        mockFindUnique.mockResolvedValue({ id: 'a1', userId: 'someone-else' });

        const error = await deleteAnalysis('user-1', 'a1').catch(e => e);
        expect(error.statusCode).toBe(403);
    });

    it('deletes a childless leaf version outright', async () => {
        mockFindUnique.mockResolvedValue({ id: 'a1', userId: 'user-1', isFinalized: false, rootId: 'root-1' });
        mockCount.mockResolvedValue(0);
        mockDelete.mockResolvedValue({});

        const result = await deleteAnalysis('user-1', 'a1');

        expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'a1' } });
        expect(result).toEqual({ deletedCount: 1, mode: 'leaf' });
    });

    it('refuses to delete a version that other versions depend on', async () => {
        mockFindUnique.mockResolvedValue({ id: 'a1', userId: 'user-1', isFinalized: false, rootId: 'root-1' });
        mockCount.mockResolvedValue(2); // two children point at this version

        const error = await deleteAnalysis('user-1', 'a1').catch(e => e);
        expect(error.statusCode).toBe(400);
        expect(mockDelete).not.toHaveBeenCalled();
    });

    it('refuses to delete a finalized leaf (would violate the KnowledgeChunk FK)', async () => {
        mockFindUnique.mockResolvedValue({ id: 'a1', userId: 'user-1', isFinalized: true, rootId: 'root-1' });

        const error = await deleteAnalysis('user-1', 'a1').catch(e => e);
        expect(error.statusCode).toBe(409);
        expect(mockCount).not.toHaveBeenCalled();
        expect(mockDelete).not.toHaveBeenCalled();
    });

    it('deletes the entire root chain when chain=true', async () => {
        mockFindUnique.mockResolvedValue({ id: 'a1', userId: 'user-1', isFinalized: false, rootId: 'root-1' });
        mockFindMany.mockResolvedValue([
            { id: 'root-1', isFinalized: false },
            { id: 'a1', isFinalized: false },
            { id: 'a2', isFinalized: false }
        ]);
        mockDeleteMany.mockResolvedValue({ count: 3 });

        const result = await deleteAnalysis('user-1', 'a1', { chain: true });

        expect(mockDeleteMany).toHaveBeenCalledWith({
            where: { userId: 'user-1', OR: [{ id: 'root-1' }, { rootId: 'root-1' }] }
        });
        expect(result).toEqual({ deletedCount: 3, mode: 'chain' });
    });

    it('refuses a chain delete if any version in the chain is finalized', async () => {
        mockFindUnique.mockResolvedValue({ id: 'a1', userId: 'user-1', isFinalized: false, rootId: 'root-1' });
        mockFindMany.mockResolvedValue([
            { id: 'root-1', isFinalized: false },
            { id: 'a1', isFinalized: true }
        ]);

        const error = await deleteAnalysis('user-1', 'a1', { chain: true }).catch(e => e);
        expect(error.statusCode).toBe(409);
        expect(mockDeleteMany).not.toHaveBeenCalled();
    });
});
