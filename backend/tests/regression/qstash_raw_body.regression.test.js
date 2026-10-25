import { jest, describe, it, expect, beforeAll } from '@jest/globals';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

/**
 * QStash signs the exact bytes it delivers. The worker's verifyQStash read `req.rawBody`,
 * but nothing ever set it, so it hashed JSON.stringify(req.body) instead. Any delivery whose
 * bytes differ from that re-serialization (whitespace, key spacing, \u escapes) failed with
 * 401 even though the signature was genuine. app.js now keeps the raw buffer for worker routes.
 *
 * Signatures here are minted with the real algorithm (HS256 JWT, iss "Upstash", sub = URL,
 * body = base64url(sha256(raw body))) and checked by the real @upstash/qstash Receiver.
 */
const SIGNING_KEY = 'sig_test_current_key';
const BACKEND_URL = 'http://backend.test';

process.env.NODE_ENV = 'production';
process.env.BACKEND_URL = BACKEND_URL;
process.env.QSTASH_CURRENT_SIGNING_KEY = SIGNING_KEY;
process.env.QSTASH_NEXT_SIGNING_KEY = 'sig_test_next_key';

const processJob = jest.fn((req, res) => res.status(200).json({ reached: true, body: req.body }));
jest.unstable_mockModule('../../src/controllers/workerController.js', () => ({
    processJob,
    reconcileJobs: jest.fn((req, res) => res.status(200).json({ ok: true })),
    handleDeadLetterJob: jest.fn((req, res) => res.status(200).json({ ok: true }))
}));
jest.unstable_mockModule('../../src/config/prisma.js', () => ({ default: {} }));
jest.unstable_mockModule('../../src/config/redis.js', () => ({ getRedisClient: () => null, default: null }));

const { default: request } = await import('supertest');
const { default: app } = await import('../../src/app.js');

const sign = (rawBody, path) => jwt.sign({
    iss: 'Upstash',
    sub: `${BACKEND_URL}${path}`,
    body: crypto.createHash('sha256').update(rawBody).digest('base64url'),
    nbf: Math.floor(Date.now() / 1000) - 5,
    exp: Math.floor(Date.now() / 1000) + 300
}, SIGNING_KEY, { algorithm: 'HS256' });

const post = (path, rawBody, signature) => request(app)
    .post(path)
    .set('Content-Type', 'application/json')
    .set('Upstash-Signature', signature)
    .send(rawBody);

describe('QStash signature is verified against the raw request body', () => {
    beforeAll(() => processJob.mockClear());

    // Not what JSON.stringify(JSON.parse(x)) gives back: extra spaces and a \u escape.
    const rawBody = '{ "userId": "u1",  "text": "caf\\u00e9 ordering",  "analysisId": "a1" }';

    it('accepts a genuine delivery whose bytes differ from re-serialized JSON', async () => {
        expect(JSON.stringify(JSON.parse(rawBody))).not.toBe(rawBody); // precondition

        const res = await post('/api/worker/process', rawBody, sign(rawBody, '/api/worker/process'));

        expect(res.status).toBe(200);
        expect(res.body.reached).toBe(true);
        expect(res.body.body.text).toBe('café ordering');
    });

    it('works on the unprefixed mount too', async () => {
        const res = await post('/worker/process', rawBody, sign(rawBody, '/worker/process'));
        expect(res.status).toBe(200);
    });

    it('still rejects a body that was not the one signed', async () => {
        processJob.mockClear();
        const tampered = rawBody.replace('u1', 'u2');
        const res = await post('/api/worker/process', tampered, sign(rawBody, '/api/worker/process'));

        expect(res.status).toBe(401);
        expect(processJob).not.toHaveBeenCalled();
    });

    it('still rejects a signature minted for another URL', async () => {
        const res = await post('/api/worker/process', rawBody, sign(rawBody, '/api/worker/reconcile'));
        expect(res.status).toBe(401);
    });
});
