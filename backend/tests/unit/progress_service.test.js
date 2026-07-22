import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockPublish = jest.fn();
const mockGetRedisClient = jest.fn();

jest.unstable_mockModule('../../src/config/redis.js', () => ({
    getRedisClient: mockGetRedisClient
}));

const { publishProgress, progressChannel } = await import('../../src/services/progressService.js');

describe('progressService', () => {
    beforeEach(() => {
        mockPublish.mockReset();
        mockGetRedisClient.mockReset();
    });

    it('publishes a timestamped event to the analysis-scoped channel', async () => {
        mockGetRedisClient.mockReturnValue({ publish: mockPublish });

        await publishProgress('a1', { stage: 'architect', message: 'Designing...' });

        expect(mockPublish).toHaveBeenCalledTimes(1);
        const [channel, payload] = mockPublish.mock.calls[0];
        expect(channel).toBe(progressChannel('a1'));
        const parsed = JSON.parse(payload);
        expect(parsed).toMatchObject({ stage: 'architect', message: 'Designing...' });
        expect(typeof parsed.timestamp).toBe('number');
    });

    it('is a no-op when Redis is not configured', async () => {
        mockGetRedisClient.mockReturnValue(null);
        await expect(publishProgress('a1', { stage: 'x' })).resolves.toBeUndefined();
    });

    it('is a no-op when analysisId is missing', async () => {
        mockGetRedisClient.mockReturnValue({ publish: mockPublish });
        await publishProgress(null, { stage: 'x' });
        expect(mockPublish).not.toHaveBeenCalled();
    });

    it('swallows publish errors rather than throwing (must never break the pipeline run)', async () => {
        mockGetRedisClient.mockReturnValue({ publish: jest.fn().mockRejectedValue(new Error('redis down')) });
        await expect(publishProgress('a1', { stage: 'x' })).resolves.toBeUndefined();
    });
});
