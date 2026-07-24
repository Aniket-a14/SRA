import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockNodeFindMany = jest.fn();
const mockNodeCreateManyAndReturn = jest.fn();
const mockEdgeFindMany = jest.fn();
const mockEdgeCreateMany = jest.fn();

const txClient = {
    graphNode: {
        findMany: mockNodeFindMany,
        createManyAndReturn: mockNodeCreateManyAndReturn
    },
    graphEdge: {
        findMany: mockEdgeFindMany,
        createMany: mockEdgeCreateMany
    }
};

const mockTransaction = jest.fn(async (fn) => fn(txClient));

jest.unstable_mockModule('../../src/config/prisma.js', () => ({
    default: { $transaction: mockTransaction }
}));

jest.unstable_mockModule('../../src/config/logger.js', () => ({
    default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

const { storeGraph } = await import('../../src/services/knowledge/graphService.js');

describe('storeGraph', () => {
    beforeEach(() => {
        mockTransaction.mockClear();
        mockNodeFindMany.mockReset();
        mockNodeCreateManyAndReturn.mockReset();
        mockEdgeFindMany.mockReset();
        mockEdgeCreateMany.mockReset();
    });

    it('batches all-new nodes/edges into one createManyAndReturn + one createMany (not per-item round-trips)', async () => {
        mockNodeFindMany.mockResolvedValue([]); // no existing nodes
        mockNodeCreateManyAndReturn.mockResolvedValue([
            { id: 'n1', name: 'Admin', type: 'ACTOR' },
            { id: 'n2', name: 'Login', type: 'FEATURE' }
        ]);
        mockEdgeFindMany.mockResolvedValue([]);
        mockEdgeCreateMany.mockResolvedValue({ count: 1 });

        const graphData = {
            nodes: [{ name: 'Admin', type: 'ACTOR' }, { name: 'Login', type: 'FEATURE' }],
            edges: [{ source: 'Admin', target: 'Login', relation: 'USES' }]
        };

        await storeGraph(graphData, 'project-1');

        expect(mockNodeFindMany).toHaveBeenCalledTimes(1);
        expect(mockNodeCreateManyAndReturn).toHaveBeenCalledTimes(1);
        expect(mockNodeCreateManyAndReturn.mock.calls[0][0].data).toEqual([
            { projectId: 'project-1', name: 'Admin', type: 'ACTOR', metadata: {} },
            { projectId: 'project-1', name: 'Login', type: 'FEATURE', metadata: {} }
        ]);
        expect(mockEdgeFindMany).toHaveBeenCalledTimes(1);
        expect(mockEdgeCreateMany).toHaveBeenCalledTimes(1);
        expect(mockEdgeCreateMany.mock.calls[0][0].data).toEqual([
            { sourceId: 'n1', targetId: 'n2', relation: 'USES', metadata: {} }
        ]);
    });

    it('reuses existing nodes instead of recreating them', async () => {
        mockNodeFindMany.mockResolvedValue([{ id: 'existing-1', name: 'Admin', type: 'ACTOR', projectId: 'project-1' }]);
        mockEdgeFindMany.mockResolvedValue([]);
        mockEdgeCreateMany.mockResolvedValue({ count: 0 });

        const graphData = {
            nodes: [{ name: 'Admin', type: 'ACTOR' }],
            edges: []
        };

        await storeGraph(graphData, 'project-1');

        expect(mockNodeCreateManyAndReturn).not.toHaveBeenCalled();
    });

    it('dedupes nodes/edges repeated within the same extraction payload before writing', async () => {
        mockNodeFindMany.mockResolvedValue([]);
        mockNodeCreateManyAndReturn.mockResolvedValue([
            { id: 'n1', name: 'Admin', type: 'ACTOR' }
        ]);
        mockEdgeFindMany.mockResolvedValue([]);
        mockEdgeCreateMany.mockResolvedValue({ count: 1 });

        const graphData = {
            nodes: [{ name: 'Admin', type: 'ACTOR' }, { name: 'Admin', type: 'ACTOR' }],
            edges: [
                { source: 'Admin', target: 'Admin', relation: 'USES' },
                { source: 'Admin', target: 'Admin', relation: 'USES' }
            ]
        };

        await storeGraph(graphData, 'project-1');

        expect(mockNodeCreateManyAndReturn.mock.calls[0][0].data).toHaveLength(1);
        expect(mockEdgeCreateMany.mock.calls[0][0].data).toHaveLength(1);
    });

    it('skips edges that already exist in the DB', async () => {
        mockNodeFindMany.mockResolvedValue([
            { id: 'n1', name: 'Admin', type: 'ACTOR', projectId: 'project-1' },
            { id: 'n2', name: 'Login', type: 'FEATURE', projectId: 'project-1' }
        ]);
        mockEdgeFindMany.mockResolvedValue([{ sourceId: 'n1', targetId: 'n2', relation: 'USES' }]);

        const graphData = {
            nodes: [{ name: 'Admin', type: 'ACTOR' }, { name: 'Login', type: 'FEATURE' }],
            edges: [{ source: 'Admin', target: 'Login', relation: 'USES' }]
        };

        await storeGraph(graphData, 'project-1');

        expect(mockNodeCreateManyAndReturn).not.toHaveBeenCalled();
        expect(mockEdgeCreateMany).not.toHaveBeenCalled();
    });

    it('drops edges referencing a node name absent from the resolved node map', async () => {
        mockNodeFindMany.mockResolvedValue([]);
        mockNodeCreateManyAndReturn.mockResolvedValue([{ id: 'n1', name: 'Admin', type: 'ACTOR' }]);
        mockEdgeFindMany.mockResolvedValue([]);

        const graphData = {
            nodes: [{ name: 'Admin', type: 'ACTOR' }],
            edges: [{ source: 'Admin', target: 'Nonexistent', relation: 'USES' }]
        };

        await storeGraph(graphData, 'project-1');

        expect(mockEdgeCreateMany).not.toHaveBeenCalled();
    });
});
