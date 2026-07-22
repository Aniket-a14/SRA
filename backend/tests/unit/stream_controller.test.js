import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { EventEmitter } from 'events';

const mockGetAnalysisById = jest.fn();
jest.unstable_mockModule('../../src/services/analysisService.js', () => ({
    getAnalysisById: mockGetAnalysisById
}));

const mockGetRedisClient = jest.fn();
jest.unstable_mockModule('../../src/config/redis.js', () => ({
    getRedisClient: mockGetRedisClient
}));

const { streamAnalysisProgress } = await import('../../src/controllers/streamController.js');

function makeRes() {
    const res = new EventEmitter();
    res.writeHead = jest.fn();
    res.write = jest.fn();
    res.end = jest.fn();
    return res;
}

function makeReq(id = 'a1') {
    const req = new EventEmitter();
    req.params = { id };
    req.user = { userId: 'user-1' };
    return req;
}

describe('streamAnalysisProgress', () => {
    let next;

    beforeEach(() => {
        mockGetAnalysisById.mockReset();
        mockGetRedisClient.mockReset();
        next = jest.fn();
    });

    it('forwards ownership/404 errors from getAnalysisById to next() without opening the stream', async () => {
        const notFound = new Error('Analysis not found');
        notFound.statusCode = 404;
        mockGetAnalysisById.mockRejectedValue(notFound);

        const req = makeReq();
        const res = makeRes();
        await streamAnalysisProgress(req, res, next);

        expect(next).toHaveBeenCalledWith(notFound);
        expect(res.writeHead).not.toHaveBeenCalled();
    });

    it('answers immediately from the DB and closes for an already-terminal analysis', async () => {
        mockGetAnalysisById.mockResolvedValue({ status: 'COMPLETED', resultQuality: 'FULL' });

        const req = makeReq();
        const res = makeRes();
        await streamAnalysisProgress(req, res, next);

        expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({ 'Content-Type': 'text/event-stream' }));
        expect(res.write).toHaveBeenCalledTimes(1);
        const payload = JSON.parse(res.write.mock.calls[0][0].replace(/^data: /, ''));
        expect(payload).toMatchObject({ terminal: true, status: 'COMPLETED' });
        expect(res.end).toHaveBeenCalledTimes(1);
    });

    it('degrades gracefully to a terminal "unavailable" event when Redis is not configured', async () => {
        mockGetAnalysisById.mockResolvedValue({ status: 'IN_PROGRESS' });
        mockGetRedisClient.mockReturnValue(null);

        const req = makeReq();
        const res = makeRes();
        await streamAnalysisProgress(req, res, next);

        const payload = JSON.parse(res.write.mock.calls[0][0].replace(/^data: /, ''));
        expect(payload).toMatchObject({ stage: 'unavailable', terminal: true });
        expect(res.end).toHaveBeenCalledTimes(1);
    });

    it('subscribes on a duplicated connection (never the shared client) and relays published messages', async () => {
        mockGetAnalysisById.mockResolvedValue({ status: 'IN_PROGRESS' });

        const subscriber = new EventEmitter();
        subscriber.subscribe = jest.fn().mockResolvedValue(1);
        subscriber.unsubscribe = jest.fn().mockResolvedValue(1);
        subscriber.quit = jest.fn().mockResolvedValue('OK');

        const sharedClient = { duplicate: jest.fn().mockReturnValue(subscriber) };
        mockGetRedisClient.mockReturnValue(sharedClient);

        const req = makeReq('a1');
        const res = makeRes();
        await streamAnalysisProgress(req, res, next);

        expect(sharedClient.duplicate).toHaveBeenCalledTimes(1);
        expect(subscriber.subscribe).toHaveBeenCalledWith('analysis:progress:a1');

        // Simulate a published progress event
        subscriber.emit('message', 'analysis:progress:a1', JSON.stringify({ stage: 'architect', message: 'Designing...' }));
        expect(res.write).toHaveBeenCalledWith(expect.stringContaining('"stage":"architect"'));
        expect(res.end).not.toHaveBeenCalled();

        // A terminal event should trigger cleanup
        subscriber.emit('message', 'analysis:progress:a1', JSON.stringify({ stage: 'completed', terminal: true }));
        expect(subscriber.unsubscribe).toHaveBeenCalledTimes(1);
        expect(subscriber.quit).toHaveBeenCalledTimes(1);
        expect(res.end).toHaveBeenCalledTimes(1);
    });

    it('cleans up the subscriber when the client disconnects', async () => {
        mockGetAnalysisById.mockResolvedValue({ status: 'PENDING' });

        const subscriber = new EventEmitter();
        subscriber.subscribe = jest.fn().mockResolvedValue(1);
        subscriber.unsubscribe = jest.fn().mockResolvedValue(1);
        subscriber.quit = jest.fn().mockResolvedValue('OK');
        mockGetRedisClient.mockReturnValue({ duplicate: () => subscriber });

        const req = makeReq('a1');
        const res = makeRes();
        await streamAnalysisProgress(req, res, next);

        req.emit('close');

        expect(subscriber.unsubscribe).toHaveBeenCalledTimes(1);
        expect(subscriber.quit).toHaveBeenCalledTimes(1);
        expect(res.end).toHaveBeenCalledTimes(1);
    });
});
