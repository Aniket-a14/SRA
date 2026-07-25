import { jest, describe, it, expect, beforeAll } from '@jest/globals';

const ALLOWED = 'https://app.example.com';
const FOREIGN = 'https://evil.example.net';

let requireTrustedOrigin;

beforeAll(async () => {
    // allowedOrigins reads FRONTEND_URL once at module load.
    process.env.FRONTEND_URL = ALLOWED;
    ({ requireTrustedOrigin } = await import('../../src/middleware/csrfMiddleware.js'));
});

const makeReq = ({ cookies = {}, headers = {} }) => ({
    cookies,
    get: (name) => headers[name.toLowerCase()]
});

const run = (req) => {
    const next = jest.fn();
    requireTrustedOrigin('refreshToken')(req, {}, next);
    return next;
};

describe('requireTrustedOrigin', () => {
    it('passes a request that carries no cookie — nothing ambient to abuse', () => {
        const next = run(makeReq({ headers: { origin: FOREIGN } }));
        expect(next).toHaveBeenCalledWith();
    });

    it('passes a cookie-bearing request from an allowlisted origin', () => {
        const next = run(makeReq({
            cookies: { refreshToken: 'abc' },
            headers: { origin: ALLOWED }
        }));
        expect(next).toHaveBeenCalledWith();
    });

    it('blocks a cookie-bearing request from a foreign origin', () => {
        const next = run(makeReq({
            cookies: { refreshToken: 'abc' },
            headers: { origin: FOREIGN }
        }));
        const error = next.mock.calls[0][0];
        expect(error).toBeInstanceOf(Error);
        expect(error.statusCode).toBe(403);
    });

    it('blocks a cookie-bearing request with neither Origin nor Referer', () => {
        const next = run(makeReq({ cookies: { refreshToken: 'abc' } }));
        expect(next.mock.calls[0][0].statusCode).toBe(403);
    });

    it('falls back to Referer when Origin is absent', () => {
        const next = run(makeReq({
            cookies: { refreshToken: 'abc' },
            headers: { referer: `${ALLOWED}/settings` }
        }));
        expect(next).toHaveBeenCalledWith();
    });

    it('blocks a foreign Referer', () => {
        const next = run(makeReq({
            cookies: { refreshToken: 'abc' },
            headers: { referer: `${FOREIGN}/attack` }
        }));
        expect(next.mock.calls[0][0].statusCode).toBe(403);
    });

    it('blocks a malformed Referer rather than throwing', () => {
        const next = run(makeReq({
            cookies: { refreshToken: 'abc' },
            headers: { referer: 'not a url' }
        }));
        expect(next.mock.calls[0][0].statusCode).toBe(403);
    });
});
