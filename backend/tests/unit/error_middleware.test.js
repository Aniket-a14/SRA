import { describe, it, expect, jest } from '@jest/globals';
import { errorHandler } from '../../src/middleware/errorMiddleware.js';

function mockRes() {
    const res = { statusCode: null, body: null, headers: {} };
    res.status = jest.fn((code) => { res.statusCode = code; return res; });
    res.json = jest.fn((body) => { res.body = body; return res; });
    res.set = jest.fn((key, value) => { res.headers[key] = value; return res; });
    return res;
}

const req = { id: 'req-1' };
const next = () => {};

describe('errorHandler', () => {
    it('sanitizes a raw provider-shaped error before it reaches the response body', () => {
        const err = new Error('[GoogleGenerativeAI Error]: [503 Service Unavailable] The model is overloaded.');
        const res = mockRes();

        errorHandler(err, req, res, next);

        expect(res.statusCode).toBe(503);
        expect(res.body.message).not.toContain('GoogleGenerativeAI');
        expect(res.body.success).toBe(false);
    });

    it('passes a deliberately-thrown client error (statusCode < 500) through verbatim', () => {
        const err = Object.assign(new Error('No GEMINI API key configured. Add your own key in Settings.'), { statusCode: 400 });
        const res = mockRes();

        errorHandler(err, req, res, next);

        expect(res.statusCode).toBe(400);
        expect(res.body.message).toBe(err.message);
    });

    it('never includes a stack trace outside development', () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        const err = new Error('boom');
        const res = mockRes();

        errorHandler(err, req, res, next);

        expect(res.body.details).toBeUndefined();
        process.env.NODE_ENV = originalEnv;
    });
});
