import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * Two properties of the auth layer that were not true before, and whose failure modes are
 * both silent — nothing errors, the wrong thing simply works.
 */

const mockSessionFindUnique = jest.fn();
const mockUserFindUnique = jest.fn();
const mockUserCreate = jest.fn();
const mockSessionCreate = jest.fn();

jest.unstable_mockModule('../../src/config/prisma.js', () => ({
    default: {
        session: { findUnique: mockSessionFindUnique, create: mockSessionCreate },
        user: { findUnique: mockUserFindUnique, create: mockUserCreate }
    }
}));

jest.unstable_mockModule('../../src/config/logger.js', () => ({
    default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    REDACTED_PATHS: []
}));

// axios is only reached by the IP-geolocation lookup during session creation.
jest.unstable_mockModule('axios', () => ({
    default: { get: jest.fn().mockResolvedValue({ data: { status: 'fail' } }) }
}));

const USER_ID = 'user-1';
const SESSION_ID = 'session-1';

const future = () => new Date(Date.now() + 60 * 60 * 1000);
const past = () => new Date(Date.now() - 60 * 60 * 1000);

beforeEach(() => {
    jest.clearAllMocks();
});

/**
 * Access tokens are signed for 7 days — the same lifetime as the refresh token. Nothing
 * consulted the Session table on a request, so deleting a session (logout, or "sign out this
 * device") left every token already issued against it working until it expired on its own.
 * The product offered two ways to revoke access and neither revoked anything.
 */
describe('isSessionActive — the check that makes revocation real', () => {
    it('accepts a live session belonging to the token subject', async () => {
        const { isSessionActive } = await import('../../src/services/auth/sessionService.js');
        mockSessionFindUnique.mockResolvedValue({ userId: USER_ID, revoked: false, expiresAt: future() });

        await expect(isSessionActive(SESSION_ID, USER_ID)).resolves.toBe(true);
    });

    it('rejects once the session row is gone — this is what logout does', async () => {
        const { isSessionActive } = await import('../../src/services/auth/sessionService.js');
        mockSessionFindUnique.mockResolvedValue(null);

        await expect(isSessionActive(SESSION_ID, USER_ID)).resolves.toBe(false);
    });

    it('rejects a session flagged revoked', async () => {
        const { isSessionActive } = await import('../../src/services/auth/sessionService.js');
        mockSessionFindUnique.mockResolvedValue({ userId: USER_ID, revoked: true, expiresAt: future() });

        await expect(isSessionActive(SESSION_ID, USER_ID)).resolves.toBe(false);
    });

    it('rejects an expired session even though the JWT itself may still be in date', async () => {
        const { isSessionActive } = await import('../../src/services/auth/sessionService.js');
        mockSessionFindUnique.mockResolvedValue({ userId: USER_ID, revoked: false, expiresAt: past() });

        await expect(isSessionActive(SESSION_ID, USER_ID)).resolves.toBe(false);
    });

    it('rejects a session that belongs to a different account', async () => {
        const { isSessionActive } = await import('../../src/services/auth/sessionService.js');
        mockSessionFindUnique.mockResolvedValue({ userId: 'somebody-else', revoked: false, expiresAt: future() });

        await expect(isSessionActive(SESSION_ID, USER_ID)).resolves.toBe(false);
    });

    it('rejects a token carrying no sessionId instead of waving it through', async () => {
        const { isSessionActive } = await import('../../src/services/auth/sessionService.js');

        await expect(isSessionActive(undefined, USER_ID)).resolves.toBe(false);
        expect(mockSessionFindUnique).not.toHaveBeenCalled();
    });

    it('does not load the user relation — the password hash has no business in this query', async () => {
        const { isSessionActive } = await import('../../src/services/auth/sessionService.js');
        mockSessionFindUnique.mockResolvedValue({ userId: USER_ID, revoked: false, expiresAt: future() });

        await isSessionActive(SESSION_ID, USER_ID);

        const query = mockSessionFindUnique.mock.calls[0][0];
        expect(query.include).toBeUndefined();
        expect(Object.keys(query.select)).toEqual(expect.arrayContaining(['userId', 'revoked', 'expiresAt']));
    });
});

/**
 * `POST /auth/signup` and `POST /auth/login` answered with the raw Prisma User row, so a
 * successful sign-in returned the account's own bcrypt hash in the response body.
 */
describe('toPublicUser — what may leave the server', () => {
    it('drops the password hash', async () => {
        const { toPublicUser } = await import('../../src/services/auth/authService.js');

        const publicUser = toPublicUser({
            id: USER_ID,
            email: 'a@example.com',
            name: 'A',
            image: null,
            createdAt: new Date(0),
            password: '$2b$10$notarealhashbutstillsecret'
        });

        expect(publicUser).not.toHaveProperty('password');
        expect(publicUser.email).toBe('a@example.com');
    });

    it('is a whitelist, so a field added to the model later is not published by default', async () => {
        const { toPublicUser } = await import('../../src/services/auth/authService.js');

        const publicUser = toPublicUser({
            id: USER_ID,
            email: 'a@example.com',
            password: 'hash',
            stripeCustomerId: 'cus_123',
            internalRiskScore: 99
        });

        expect(Object.keys(publicUser).sort()).toEqual(['createdAt', 'email', 'id', 'image', 'name']);
    });
});

/**
 * An email address is the only link between an OAuth identity and an existing account: the
 * lookup hands over whatever account already claims that address, including one created with
 * a password. That is only sound if the provider verified it.
 */
describe('OAuth sign-in requires a verified email', () => {
    it('refuses a Google profile whose email is not verified', async () => {
        const { handleGoogleAuth } = await import('../../src/services/auth/authService.js');

        await expect(
            handleGoogleAuth(
                { email: 'victim@example.com', name: 'V', picture: null, id: 'g1', verified_email: false },
                { access_token: 'x', refresh_token: 'y' },
                'ua',
                '1.2.3.4'
            )
        ).rejects.toMatchObject({ statusCode: 400 });

        // Never got as far as looking for an account to take over.
        expect(mockUserFindUnique).not.toHaveBeenCalled();
    });

    it('refuses a Google profile with no email at all', async () => {
        const { handleGoogleAuth } = await import('../../src/services/auth/authService.js');

        await expect(
            handleGoogleAuth({ id: 'g1', verified_email: true }, {}, 'ua', '1.2.3.4')
        ).rejects.toMatchObject({ statusCode: 400 });
    });
});
