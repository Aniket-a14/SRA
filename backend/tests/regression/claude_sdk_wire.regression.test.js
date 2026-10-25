import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import http from 'node:http';

/**
 * The real @anthropic-ai/sdk (no mock) against a local stub server: proves what the upgraded
 * SDK actually sends and that the adapter's calls (`create().withResponse()`, `stream()`,
 * `countTokens()`, paginated `models.list()`) work on this SDK major. Localhost only, so the
 * network guard lets it through.
 */
let server;
let base;
const seen = [];

const reply = (res, status, body, headers = {}) => {
    res.writeHead(status, { 'content-type': 'application/json', 'request-id': 'req_test', ...headers });
    res.end(JSON.stringify(body));
};

beforeAll(async () => {
    server = http.createServer((req, res) => {
        let raw = '';
        req.on('data', (c) => { raw += c; });
        req.on('end', () => {
            const body = raw ? JSON.parse(raw) : null;
            seen.push({ method: req.method, url: req.url, headers: req.headers, body });
            if (req.url.startsWith('/v1/messages/count_tokens')) return reply(res, 200, { input_tokens: 42 });
            if (req.url.startsWith('/v1/messages') && body?.stream) {
                res.writeHead(200, { 'content-type': 'text/event-stream' });
                const ev = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
                ev('message_start', { message: { id: 'msg_1', type: 'message', role: 'assistant', model: body.model, content: [], stop_reason: null, usage: { input_tokens: 1, output_tokens: 0 } } });
                ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
                ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: '{"a":' } });
                ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: '1}' } });
                ev('content_block_stop', { index: 0 });
                ev('message_delta', { delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 3 } });
                ev('message_stop', {});
                return res.end();
            }
            if (req.url.startsWith('/v1/messages')) {
                return reply(res, 200, {
                    id: 'msg_1', type: 'message', role: 'assistant', model: body.model,
                    content: [{ type: 'text', text: '{"ok":true}' }], stop_reason: 'end_turn',
                    usage: { input_tokens: 1, output_tokens: 1 }
                }, { 'anthropic-ratelimit-requests-remaining': '9' });
            }
            if (req.url.startsWith('/v1/models')) {
                const second = req.url.includes('after_id=claude-opus-5-5');
                return reply(res, 200, second
                    ? { data: [{ type: 'model', id: 'claude-haiku-4-5', display_name: 'Claude Haiku 4.5', created_at: '2025-10-01T00:00:00Z' }], has_more: false, first_id: 'claude-haiku-4-5', last_id: 'claude-haiku-4-5' }
                    : { data: [{ type: 'model', id: 'claude-opus-5-5', display_name: 'Claude Opus 5.5', created_at: '2026-09-01T00:00:00Z' }], has_more: true, first_id: 'claude-opus-5-5', last_id: 'claude-opus-5-5' });
            }
            reply(res, 404, { type: 'error', error: { type: 'not_found_error', message: req.url } });
        });
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${server.address().port}`;
    process.env.ANTHROPIC_BASE_URL = base;
});

afterAll(async () => {
    delete process.env.ANTHROPIC_BASE_URL;
    await new Promise((r) => server.close(r));
});

describe('ClaudeAdapter on the real SDK', () => {
    it('sends API version 2026-10-21 with the key as a bearer token and no sampling fields', async () => {
        const { ClaudeAdapter } = await import('../../src/services/providers/ClaudeAdapter.js');
        const adapter = new ClaudeAdapter('sk-ant-test');
        const text = await adapter.generateContent({
            prompt: 'p', systemInstruction: 's', temperature: 0.2, maxOutputTokens: 500, jsonMode: true, modelName: 'claude-opus-5-5'
        });

        expect(text).toBe('{"ok":true}');
        const call = seen.find((c) => c.url.startsWith('/v1/messages') && !c.body?.stream && !c.url.includes('count'));
        expect(call.headers['anthropic-version']).toBe('2026-10-21');
        expect(call.headers.authorization).toBe('Bearer sk-ant-test');
        expect(call.body).not.toHaveProperty('temperature');
        expect(call.body.thinking).toBeUndefined();
        expect(call.body.output_config).toEqual({ effort: 'low' });
        expect(adapter.lastRateLimit).toBeTruthy();
    });

    it('streams text and checks the final stop reason', async () => {
        const { ClaudeAdapter } = await import('../../src/services/providers/ClaudeAdapter.js');
        const chunks = [];
        for await (const c of new ClaudeAdapter('sk-ant-test').generateContentStream({
            prompt: 'p', modelName: 'claude-sonnet-5-5', jsonMode: true
        })) chunks.push(c);
        expect(chunks.join('')).toBe('{"a":1}');
        const call = seen.find((c) => c.body?.stream);
        expect(call.body.thinking).toEqual({ type: 'between_tools' });
    });

    it('counts tokens', async () => {
        const { ClaudeAdapter } = await import('../../src/services/providers/ClaudeAdapter.js');
        await expect(new ClaudeAdapter('sk-ant-test').countTokens('hello', 'claude-opus-5-5')).resolves.toBe(42);
    });

    it('discovers models across pages', async () => {
        const { discoverModels } = await import('../../src/services/providers/modelDiscovery.js');
        const { models } = await discoverModels('CLAUDE', 'sk-ant-test');
        expect(models.map((m) => m.id)).toEqual(['claude-opus-5-5', 'claude-haiku-4-5']);
    });
});
