import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { PassThrough } from 'stream';

const stream = jest.fn();
const get = jest.fn();

jest.unstable_mockModule('../src/api/api-client.js', () => ({
    api: { get, put: jest.fn(), post: jest.fn(), delete: jest.fn(), stream },
    describeError: (error) => error?.message || 'error',
    statusOf: () => null,
    DEFAULT_BACKEND_URL: 'https://example.invalid'
}));

const { followAnalysis, describeStage } = await import('../src/lib/progress.js');

const sse = (payload) => `data: ${JSON.stringify(payload)}\n\n`;

beforeEach(() => {
    stream.mockReset();
    get.mockReset();
});

describe('followAnalysis over SSE', () => {
    test('reports each stage and resolves on the terminal event', async () => {
        const source = new PassThrough();
        stream.mockResolvedValue(source);

        const stages = [];
        const pending = followAnalysis('a1', { onStage: (e) => stages.push(e.stage) });

        source.write(sse({ stage: 'product_owner', message: 'Refining scope' }));
        source.write(sse({ stage: 'architect', message: 'Designing' }));
        source.write(sse({ stage: 'completed', terminal: true, status: 'COMPLETED', resultQuality: 'FULL' }));

        await expect(pending).resolves.toEqual({ status: 'COMPLETED', resultQuality: 'FULL' });
        expect(stages).toEqual(['product_owner', 'architect', 'completed']);
    });

    test('reassembles an event split across chunk boundaries', async () => {
        const source = new PassThrough();
        stream.mockResolvedValue(source);

        const stages = [];
        const pending = followAnalysis('a1', { onStage: (e) => stages.push(e.stage) });

        const frame = sse({ stage: 'developer_draft', message: 'Writing sections' });
        source.write(frame.slice(0, 12));
        source.write(frame.slice(12));
        source.write(sse({ terminal: true, status: 'COMPLETED' }));

        await pending;
        expect(stages).toContain('developer_draft');
    });

    test('surfaces a FAILED run rather than reporting success', async () => {
        const source = new PassThrough();
        stream.mockResolvedValue(source);

        const pending = followAnalysis('a1');
        source.write(sse({ stage: 'failed', terminal: true, status: 'FAILED' }));

        await expect(pending).resolves.toEqual({ status: 'FAILED', resultQuality: undefined });
    });

    test('ignores heartbeat comments and malformed frames', async () => {
        const source = new PassThrough();
        stream.mockResolvedValue(source);

        const stages = [];
        const pending = followAnalysis('a1', { onStage: (e) => stages.push(e.stage) });

        source.write(': keep-alive\n\n');
        source.write('data: {not json\n\n');
        source.write(sse({ stage: 'rag_retrieval' }));
        source.write(sse({ terminal: true, status: 'COMPLETED' }));

        await pending;
        expect(stages).toEqual(['rag_retrieval', undefined]);
    });
});

describe('followAnalysis fallback to polling', () => {
    test('polls when the stream cannot be opened', async () => {
        stream.mockRejectedValue(new Error('no redis'));
        get.mockResolvedValue({ data: { status: 'COMPLETED', resultQuality: 'FULL' } });

        await expect(followAnalysis('a1')).resolves.toEqual({ status: 'COMPLETED', resultQuality: 'FULL' });
        expect(get).toHaveBeenCalledWith('/api/analyze/job/a1');
    });

    test('polls when the server says live progress is unavailable', async () => {
        const source = new PassThrough();
        stream.mockResolvedValue(source);
        get.mockResolvedValue({ data: { status: 'COMPLETED' } });

        const pending = followAnalysis('a1');
        source.write(sse({ stage: 'unavailable', terminal: true }));

        await expect(pending).resolves.toEqual({ status: 'COMPLETED', resultQuality: undefined });
        expect(get).toHaveBeenCalled();
    });

    test('polls when the stream ends without a terminal event', async () => {
        const source = new PassThrough();
        stream.mockResolvedValue(source);
        get.mockResolvedValue({ data: { status: 'FAILED' } });

        const pending = followAnalysis('a1');
        source.write(sse({ stage: 'architect' }));
        source.end();

        // A clean close mid-run means the invocation yielded, not that the run finished —
        // claiming COMPLETED here would report a half-built document as done.
        await expect(pending).resolves.toEqual({ status: 'FAILED', resultQuality: undefined });
    });
});

describe('describeStage', () => {
    test('prefers the server-supplied message', () => {
        expect(describeStage({ stage: 'architect', message: 'Designing the system' })).toBe('Designing the system');
    });

    test('humanises a bare stage id', () => {
        expect(describeStage({ stage: 'developer_draft' })).toBe('Developer draft');
    });

    test('falls back when there is nothing to describe', () => {
        expect(describeStage({})).toBe('Working...');
    });
});
