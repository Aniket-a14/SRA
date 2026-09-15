import { jest, describe, it, expect, beforeEach } from '@jest/globals';

/**
 * reuseController.js ("Gold Standard" requirement recycling) had zero test coverage —
 * the route it backs (POST /reuse/suggest) is a live production feature.
 */

const mockSearchGoldStandardFragments = jest.fn();

jest.unstable_mockModule('../../src/services/knowledge/ragService.js', () => ({
    searchGoldStandardFragments: mockSearchGoldStandardFragments,
}));

const { suggestReuse } = await import('../../src/controllers/reuseController.js');

function makeReq(body, userId = 'user-1') {
    return { body, user: { userId } };
}

function makeRes() {
    return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

describe('suggestReuse', () => {
    let next;

    beforeEach(() => {
        mockSearchGoldStandardFragments.mockReset();
        next = jest.fn();
    });

    it('returns suggestions and a count, scoped to the caller', async () => {
        const fragments = [
            { id: 'kc-1', type: 'functional', content: 'The system shall authenticate users.', qualityScore: 0.91 },
            { id: 'kc-2', type: 'functional', content: 'The system shall log failed attempts.', qualityScore: 0.85 },
        ];
        mockSearchGoldStandardFragments.mockResolvedValue(fragments);
        const res = makeRes();

        await suggestReuse(makeReq({ query: 'authentication', type: 'functional' }, 'user-1'), res, next);

        expect(mockSearchGoldStandardFragments).toHaveBeenCalledWith('authentication', 'functional', 'user-1');
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            data: { suggestions: fragments, count: 2 },
        }));
        expect(next).not.toHaveBeenCalled();
    });

    it('passes undefined type through when the caller omits it', async () => {
        mockSearchGoldStandardFragments.mockResolvedValue([]);
        const res = makeRes();

        await suggestReuse(makeReq({ query: 'rate limiting' }), res, next);

        expect(mockSearchGoldStandardFragments).toHaveBeenCalledWith('rate limiting', undefined, 'user-1');
    });

    it('400s when the query is missing, without calling the search service', async () => {
        const res = makeRes();

        await suggestReuse(makeReq({}), res, next);

        expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
        expect(mockSearchGoldStandardFragments).not.toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('400s on an empty-string query the same way as a missing one', async () => {
        const res = makeRes();

        await suggestReuse(makeReq({ query: '' }), res, next);

        expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
        expect(mockSearchGoldStandardFragments).not.toHaveBeenCalled();
    });

    it('forwards a search-service failure to next() instead of throwing unhandled', async () => {
        const serviceError = new Error('embedding provider unavailable');
        mockSearchGoldStandardFragments.mockRejectedValue(serviceError);
        const res = makeRes();

        await suggestReuse(makeReq({ query: 'authentication' }), res, next);

        expect(next).toHaveBeenCalledWith(serviceError);
        expect(res.status).not.toHaveBeenCalled();
    });

    it('returns an empty suggestion list with count 0 rather than erroring when nothing matches', async () => {
        mockSearchGoldStandardFragments.mockResolvedValue([]);
        const res = makeRes();

        await suggestReuse(makeReq({ query: 'something with no gold standard matches' }), res, next);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            data: { suggestions: [], count: 0 },
        }));
    });
});
