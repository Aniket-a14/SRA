import { jest, describe, it, expect, beforeEach, afterAll } from '@jest/globals';

// assertWithinQuota short-circuits when NODE_ENV === 'test' (to keep the rest of the suite
// deterministic), so this file flips NODE_ENV to 'production' to actually exercise the
// enforcement logic, and restores it afterward.
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

const mockCount = jest.fn();

jest.unstable_mockModule('../../src/config/prisma.js', () => ({
    default: {
        analysis: { count: mockCount }
    }
}));

const { assertWithinQuota, MAX_CONCURRENT_ANALYSES, MAX_DAILY_ANALYSES } = await import('../../src/services/quotaService.js');

describe('assertWithinQuota', () => {
    beforeEach(() => {
        process.env.NODE_ENV = 'production';
        mockCount.mockReset();
    });

    afterAll(() => {
        process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    });

    it('is a no-op in the test environment', async () => {
        process.env.NODE_ENV = 'test';
        await expect(assertWithinQuota('user-1')).resolves.toBeUndefined();
        expect(mockCount).not.toHaveBeenCalled();
    });

    it('passes when the user is under both limits', async () => {
        mockCount
            .mockResolvedValueOnce(0)  // concurrency
            .mockResolvedValueOnce(0); // daily
        await expect(assertWithinQuota('user-1')).resolves.toBeUndefined();
        expect(mockCount).toHaveBeenCalledTimes(2);
    });

    it('throws 429 with Retry-After when at the concurrency cap', async () => {
        mockCount.mockResolvedValueOnce(MAX_CONCURRENT_ANALYSES); // at the concurrency limit

        const error = await assertWithinQuota('user-1').catch(e => e);
        expect(error.statusCode).toBe(429);
        expect(error.retryAfter).toBe(60);
        // Daily check should not run once concurrency already failed.
        expect(mockCount).toHaveBeenCalledTimes(1);
    });

    it('throws 429 with a day-scale Retry-After when at the daily cap', async () => {
        mockCount
            .mockResolvedValueOnce(0)                      // under concurrency
            .mockResolvedValueOnce(MAX_DAILY_ANALYSES);    // at daily limit

        const error = await assertWithinQuota('user-1').catch(e => e);
        expect(error.statusCode).toBe(429);
        expect(error.retryAfter).toBe(3600);
    });

    it('excludes DRAFT rows from the daily count query', async () => {
        mockCount
            .mockResolvedValueOnce(0)
            .mockResolvedValueOnce(0);
        await assertWithinQuota('user-1');

        // Second call is the daily-count query — assert it filters out DRAFT rows.
        const dailyCallArgs = mockCount.mock.calls[1][0];
        expect(dailyCallArgs.where.status).toEqual({ not: 'DRAFT' });
        expect(dailyCallArgs.where.userId).toBe('user-1');
    });
});
