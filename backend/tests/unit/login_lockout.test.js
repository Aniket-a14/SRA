import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * Per-account brute-force protection.
 *
 * Rate limiting was keyed on IP, which cannot see the attack it most needs to: credential
 * stuffing against one known account spread across many addresses. Ten attempts each from a
 * thousand IPs never troubled a per-IP bucket, and the account had no defence of its own.
 */

const mockUserFindUnique = jest.fn();
const mockUserUpdate = jest.fn().mockResolvedValue({});
const mockComparePassword = jest.fn();
const mockCreateSession = jest.fn().mockResolvedValue({ refreshToken: 'rt', sessionId: 'sid' });

jest.unstable_mockModule('../../src/config/prisma.js', () => ({
    default: { user: { findUnique: mockUserFindUnique, update: mockUserUpdate, create: jest.fn() } }
}));

jest.unstable_mockModule('../../src/utils/passwordUtils.js', () => ({
    hashPassword: jest.fn(),
    comparePassword: mockComparePassword
}));

jest.unstable_mockModule('../../src/services/auth/sessionService.js', () => ({
    createSession: mockCreateSession
}));

jest.unstable_mockModule('../../src/config/jwt.js', () => ({ signToken: () => 'jwt' }));
jest.unstable_mockModule('../../src/utils/dataEncryption.js', () => ({ encryptData: (v) => v }));

const baseUser = (overrides = {}) => ({
    id: 'u1',
    email: 'a@example.com',
    password: '$2b$10$hash',
    failedLoginAttempts: 0,
    lockedUntil: null,
    deletedAt: null,
    ...overrides
});

beforeEach(() => {
    jest.clearAllMocks();
    mockUserUpdate.mockResolvedValue({});
});

describe('failed sign-ins accumulate against the account', () => {
    it('counts a wrong password without locking on the first mistake', async () => {
        const { loginUser } = await import('../../src/services/auth/authService.js');
        mockUserFindUnique.mockResolvedValue(baseUser({ failedLoginAttempts: 2 }));
        mockComparePassword.mockResolvedValue(false);

        await expect(loginUser('a@example.com', 'wrong')).rejects.toThrow('Invalid email or password');

        expect(mockUserUpdate).toHaveBeenCalledWith({
            where: { id: 'u1' },
            data: { failedLoginAttempts: 3 }
        });
    });

    it('locks the account once the threshold is reached', async () => {
        const { loginUser, LOCKOUT_THRESHOLD } = await import('../../src/services/auth/authService.js');
        mockUserFindUnique.mockResolvedValue(baseUser({ failedLoginAttempts: LOCKOUT_THRESHOLD - 1 }));
        mockComparePassword.mockResolvedValue(false);

        await expect(loginUser('a@example.com', 'wrong')).rejects.toMatchObject({ statusCode: 429 });

        const data = mockUserUpdate.mock.calls[0][0].data;
        expect(data.lockedUntil).toBeInstanceOf(Date);
        // Counter resets alongside the lock, so the cool-off is not immediately re-triggered
        // by a single attempt after it expires.
        expect(data.failedLoginAttempts).toBe(0);
    });

    it('rejects a locked account before comparing the password at all', async () => {
        const { loginUser } = await import('../../src/services/auth/authService.js');
        mockUserFindUnique.mockResolvedValue(baseUser({ lockedUntil: new Date(Date.now() + 60_000) }));

        const error = await loginUser('a@example.com', 'anything').catch(e => e);

        expect(error.statusCode).toBe(429);
        expect(error.retryAfter).toBeGreaterThan(0);
        // While locked an attempt must cost nothing and leak nothing — including through the
        // timing of a bcrypt compare.
        expect(mockComparePassword).not.toHaveBeenCalled();
    });

    it('lets a user back in once the lock has expired', async () => {
        const { loginUser } = await import('../../src/services/auth/authService.js');
        mockUserFindUnique.mockResolvedValue(baseUser({ lockedUntil: new Date(Date.now() - 60_000) }));
        mockComparePassword.mockResolvedValue(true);

        await expect(loginUser('a@example.com', 'right')).resolves.toMatchObject({ token: 'jwt' });
    });

    it('clears the record on a successful sign-in', async () => {
        const { loginUser } = await import('../../src/services/auth/authService.js');
        mockUserFindUnique.mockResolvedValue(baseUser({ failedLoginAttempts: 4 }));
        mockComparePassword.mockResolvedValue(true);

        await loginUser('a@example.com', 'right');

        expect(mockUserUpdate).toHaveBeenCalledWith({
            where: { id: 'u1' },
            data: { failedLoginAttempts: 0, lockedUntil: null }
        });
    });

    it('does not write to the row when there is nothing to clear', async () => {
        const { loginUser } = await import('../../src/services/auth/authService.js');
        mockUserFindUnique.mockResolvedValue(baseUser());
        mockComparePassword.mockResolvedValue(true);

        await loginUser('a@example.com', 'right');

        expect(mockUserUpdate).not.toHaveBeenCalled();
    });
});

describe('an account being erased cannot be signed into', () => {
    it('refuses login for a soft-deleted account and says why', async () => {
        const { loginUser } = await import('../../src/services/auth/authService.js');
        mockUserFindUnique.mockResolvedValue(baseUser({ deletedAt: new Date() }));
        mockComparePassword.mockResolvedValue(true);

        await expect(loginUser('a@example.com', 'right')).rejects.toMatchObject({ statusCode: 410 });
        expect(mockCreateSession).not.toHaveBeenCalled();
    });
});

describe('verifyCredentialsForRestore', () => {
    it('returns only an id — it is not a second, lockout-free way to sign in', async () => {
        const { verifyCredentialsForRestore } = await import('../../src/services/auth/authService.js');
        mockUserFindUnique.mockResolvedValue(baseUser({ deletedAt: new Date() }));
        mockComparePassword.mockResolvedValue(true);

        await expect(verifyCredentialsForRestore('a@example.com', 'right')).resolves.toBe('u1');
        expect(mockCreateSession).not.toHaveBeenCalled();
    });

    it('is subject to the same lockout as login', async () => {
        const { verifyCredentialsForRestore, LOCKOUT_THRESHOLD } = await import('../../src/services/auth/authService.js');
        mockUserFindUnique.mockResolvedValue(baseUser({ failedLoginAttempts: LOCKOUT_THRESHOLD - 1 }));
        mockComparePassword.mockResolvedValue(false);

        await expect(verifyCredentialsForRestore('a@example.com', 'wrong')).rejects.toMatchObject({ statusCode: 429 });
    });
});
