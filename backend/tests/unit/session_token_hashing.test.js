import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import crypto from 'crypto';

/**
 * Refresh tokens are stored as digests.
 *
 * `Session.token` held the live credential in clear text, so a database dump — a backup on a
 * laptop, a leaked read replica, an over-broad support query — was a working session for
 * every user in it. No cracking step, just read the column and present the value.
 */

const mockSessionCreate = jest.fn();
const mockSessionFindUnique = jest.fn();
const mockSessionUpdate = jest.fn().mockResolvedValue({});

jest.unstable_mockModule('../../src/config/prisma.js', () => ({
    default: {
        session: {
            create: mockSessionCreate,
            findUnique: mockSessionFindUnique,
            update: mockSessionUpdate,
            deleteMany: jest.fn()
        }
    }
}));

jest.unstable_mockModule('axios', () => ({
    default: { get: jest.fn().mockResolvedValue({ data: { status: 'fail' } }) }
}));

const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');

beforeEach(() => {
    jest.clearAllMocks();
    mockSessionCreate.mockResolvedValue({ id: 'sid' });
    mockSessionUpdate.mockResolvedValue({});
});

describe('createSession', () => {
    it('persists a digest and never the token itself', async () => {
        const { createSession } = await import('../../src/services/auth/sessionService.js');

        const { refreshToken } = await createSession('u1', 'ua', '1.2.3.4');
        const written = mockSessionCreate.mock.calls[0][0].data;

        expect(written.tokenHash).toBe(sha256(refreshToken));
        expect(written).not.toHaveProperty('token');
        // The literal token must appear nowhere in what is written.
        expect(JSON.stringify(written)).not.toContain(refreshToken);
    });

    it('returns a token with enough entropy that a plain digest is the right choice', async () => {
        const { createSession } = await import('../../src/services/auth/sessionService.js');

        const { refreshToken } = await createSession('u1', 'ua', '1.2.3.4');

        // 40 random bytes, hex-encoded. There is no low-entropy secret here to brute-force,
        // which is why SHA-256 rather than a slow KDF is appropriate.
        expect(refreshToken).toHaveLength(80);
        expect(refreshToken).toMatch(/^[0-9a-f]+$/);
    });
});

describe('validateSession', () => {
    const live = (overrides = {}) => ({
        id: 'sid',
        userId: 'u1',
        revoked: false,
        expiresAt: new Date(Date.now() + 60_000),
        user: { id: 'u1', deletedAt: null },
        ...overrides
    });

    it('looks the session up by digest, not by the presented value', async () => {
        const { validateSession } = await import('../../src/services/auth/sessionService.js');
        mockSessionFindUnique.mockResolvedValue(live());

        await validateSession('presented-token');

        expect(mockSessionFindUnique.mock.calls[0][0].where).toEqual({
            tokenHash: sha256('presented-token')
        });
    });

    it('rejects a revoked session', async () => {
        const { validateSession } = await import('../../src/services/auth/sessionService.js');
        mockSessionFindUnique.mockResolvedValue(live({ revoked: true }));

        await expect(validateSession('t')).resolves.toBeNull();
    });

    it('rejects an expired session', async () => {
        const { validateSession } = await import('../../src/services/auth/sessionService.js');
        mockSessionFindUnique.mockResolvedValue(live({ expiresAt: new Date(Date.now() - 1000) }));

        await expect(validateSession('t')).resolves.toBeNull();
    });

    it('rejects a session whose account is being erased', async () => {
        const { validateSession } = await import('../../src/services/auth/sessionService.js');
        mockSessionFindUnique.mockResolvedValue(live({ user: { id: 'u1', deletedAt: new Date() } }));

        // Otherwise "delete my account" would leave a working credential in the browser for
        // the whole grace window.
        await expect(validateSession('t')).resolves.toBeNull();
    });

    it('rejects an empty token without querying', async () => {
        const { validateSession } = await import('../../src/services/auth/sessionService.js');

        await expect(validateSession(undefined)).resolves.toBeNull();
        expect(mockSessionFindUnique).not.toHaveBeenCalled();
    });
});

describe('rotateSession', () => {
    it('writes the digest of the new token, keeping the session identity', async () => {
        const { rotateSession } = await import('../../src/services/auth/sessionService.js');
        const oldSession = { id: 'sid', ipAddress: '1.2.3.4', location: 'X', userAgent: 'ua' };

        const newToken = await rotateSession(oldSession, 'ua', '1.2.3.4');
        const call = mockSessionUpdate.mock.calls[0][0];

        expect(call.where).toEqual({ id: 'sid' });
        expect(call.data.tokenHash).toBe(sha256(newToken));
        expect(call.data).not.toHaveProperty('token');
    });
});
