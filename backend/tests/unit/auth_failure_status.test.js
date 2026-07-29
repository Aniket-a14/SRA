import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * The status code an expected auth failure carries.
 *
 * errorMiddleware defaults a statusCode-less error to 500, so every bare `throw new Error` in
 * this layer reported an ordinary event — a mistyped password, a duplicate signup, a truncated
 * OAuth callback — as the server breaking. Two consequences, both real: the client cannot tell
 * "you got it wrong" from "we are down" and so cannot respond correctly to either, and every
 * typo was logged at error level with a stack trace, burying actual faults.
 */

const mockUserFindUnique = jest.fn();
const mockUserUpdate = jest.fn().mockResolvedValue({});
const mockComparePassword = jest.fn();

jest.unstable_mockModule('../../src/config/prisma.js', () => ({
    default: {
        user: { findUnique: mockUserFindUnique, create: jest.fn(), update: mockUserUpdate },
        session: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() }
    }
}));

jest.unstable_mockModule('../../src/utils/passwordUtils.js', () => ({
    hashPassword: jest.fn().mockResolvedValue('hashed'),
    comparePassword: mockComparePassword
}));

jest.unstable_mockModule('../../src/config/logger.js', () => ({
    default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    REDACTED_PATHS: []
}));

jest.unstable_mockModule('axios', () => ({
    default: { get: jest.fn().mockResolvedValue({ data: { status: 'fail' } }) }
}));

const account = (overrides = {}) => ({
    id: 'u1',
    email: 'someone@example.com',
    password: 'stored-hash',
    failedLoginAttempts: 0,
    lockedUntil: null,
    deletedAt: null,
    ...overrides
});

beforeEach(() => {
    jest.clearAllMocks();
    mockUserUpdate.mockResolvedValue({});
});

describe('loginUser', () => {
    it('reports a wrong password as 401, not 500', async () => {
        const { loginUser } = await import('../../src/services/auth/authService.js');
        mockUserFindUnique.mockResolvedValue(account());
        mockComparePassword.mockResolvedValue(false);

        await expect(loginUser('someone@example.com', 'wrong')).rejects.toMatchObject({
            statusCode: 401
        });
    });

    it('reports an unknown address as 401 too', async () => {
        const { loginUser } = await import('../../src/services/auth/authService.js');
        mockUserFindUnique.mockResolvedValue(null);

        await expect(loginUser('nobody@example.invalid', 'x')).rejects.toMatchObject({
            statusCode: 401
        });
    });

    it('says exactly the same thing either way', async () => {
        const { loginUser } = await import('../../src/services/auth/authService.js');

        mockUserFindUnique.mockResolvedValue(null);
        const unknownAddress = await loginUser('nobody@example.invalid', 'x').catch(e => e);

        mockUserFindUnique.mockResolvedValue(account());
        mockComparePassword.mockResolvedValue(false);
        const wrongPassword = await loginUser('someone@example.com', 'wrong').catch(e => e);

        // Distinguishable messages turn the login form into an account-existence oracle.
        expect(unknownAddress.message).toBe(wrongPassword.message);
        expect(unknownAddress.statusCode).toBe(wrongPassword.statusCode);
    });
});

describe('registerUser', () => {
    it('reports a taken email as 409, not 500', async () => {
        const { registerUser } = await import('../../src/services/auth/authService.js');
        mockUserFindUnique.mockResolvedValue(account());

        await expect(registerUser('someone@example.com', 'pw', 'Name')).rejects.toMatchObject({
            statusCode: 409
        });
    });
});
