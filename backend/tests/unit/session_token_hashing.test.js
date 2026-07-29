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

/**
 * Rotation grace.
 *
 * Rotation retired the old token the instant the new one was written, so a rotation response
 * the browser never received — a tab closed mid-request, a dropped mobile connection — left it
 * holding a token the server had already invalidated. The next refresh then 401'd and signed
 * the user out of a session with days left, which is what "the refresh token expires too soon"
 * actually was. The superseded token stays valid until its replacement is seen in use.
 */
describe('validateSession — rotation grace', () => {
    const live = (overrides = {}) => ({
        id: 'sid',
        userId: 'u1',
        revoked: false,
        expiresAt: new Date(Date.now() + 60_000),
        user: { id: 'u1', deletedAt: null },
        ...overrides
    });

    it('accepts the superseded token while the replacement is unconfirmed', async () => {
        const { validateSession } = await import('../../src/services/auth/sessionService.js');
        // Miss on tokenHash, hit on prevTokenHash.
        mockSessionFindUnique
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(live({ successorConfirmed: false }));

        await expect(validateSession('stale-but-mine')).resolves.toMatchObject({ id: 'sid' });

        expect(mockSessionFindUnique.mock.calls[1][0].where).toEqual({
            prevTokenHash: sha256('stale-but-mine')
        });
    });

    it('revokes the session when a superseded token appears after its replacement was used', async () => {
        const { validateSession } = await import('../../src/services/auth/sessionService.js');
        mockSessionFindUnique
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(live({ successorConfirmed: true }));

        // The browser has the newer token, so whoever presents this one copied it.
        await expect(validateSession('replayed')).resolves.toBeNull();
        expect(mockSessionUpdate).toHaveBeenCalledWith({
            where: { id: 'sid' },
            data: { revoked: true }
        });
    });

    it('confirms the successor the first time the current token is presented', async () => {
        const { validateSession } = await import('../../src/services/auth/sessionService.js');
        mockSessionFindUnique.mockResolvedValue(live({ successorConfirmed: false }));

        await validateSession('current');

        expect(mockSessionUpdate).toHaveBeenCalledWith({
            where: { id: 'sid' },
            data: { successorConfirmed: true }
        });
    });

    it('does not re-confirm on every refresh', async () => {
        const { validateSession } = await import('../../src/services/auth/sessionService.js');
        mockSessionFindUnique.mockResolvedValue(live({ successorConfirmed: true }));

        await validateSession('current');

        expect(mockSessionUpdate).not.toHaveBeenCalled();
    });

    it('never looks up prevTokenHash when the current token matches', async () => {
        const { validateSession } = await import('../../src/services/auth/sessionService.js');
        mockSessionFindUnique.mockResolvedValue(live({ successorConfirmed: true }));

        await validateSession('current');

        expect(mockSessionFindUnique).toHaveBeenCalledTimes(1);
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

    it('demotes the outgoing token to prevTokenHash and marks the new one unconfirmed', async () => {
        const { rotateSession } = await import('../../src/services/auth/sessionService.js');
        const oldSession = { id: 'sid', tokenHash: 'outgoing', successorConfirmed: true };

        await rotateSession(oldSession, 'ua', '1.2.3.4');
        const { data } = mockSessionUpdate.mock.calls[0][0];

        expect(data.prevTokenHash).toBe('outgoing');
        expect(data.successorConfirmed).toBe(false);
    });

    it('keeps the older token when the outgoing one was never confirmed received', async () => {
        const { rotateSession } = await import('../../src/services/auth/sessionService.js');
        // The browser is demonstrably still on `still-held` — it just presented it.
        const oldSession = { id: 'sid', tokenHash: 'never-arrived', prevTokenHash: 'still-held', successorConfirmed: false };

        await rotateSession(oldSession, 'ua', '1.2.3.4');
        const { data } = mockSessionUpdate.mock.calls[0][0];

        // Promoting `never-arrived` here would strand the browser one refresh later — the
        // exact bug, just moved along by one hop.
        expect(data.prevTokenHash).toBe('still-held');
    });
});
