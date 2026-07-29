import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * What POST /auth/refresh says when there is no usable session.
 *
 * A missing refresh cookie was thrown as a bare Error, so it carried no statusCode and the
 * error handler defaulted it to 500. The client treats 5xx as "the server said nothing" —
 * deliberately, so a cold start or a gateway blip cannot end a session — and therefore kept a
 * session it could no longer use. The result was an app that stayed signed in, let the user
 * navigate, and failed every request behind it, with no sign-out and no way back except
 * clearing storage by hand. The status code is the whole contract here.
 */

const mockValidateSession = jest.fn();
const mockRotateSession = jest.fn();
const mockSignToken = jest.fn(() => 'new.access.token');

jest.unstable_mockModule('../../src/services/auth/sessionService.js', () => ({
    validateSession: mockValidateSession,
    rotateSession: mockRotateSession,
    revokeSession: jest.fn(),
    getUserSessions: jest.fn()
}));

jest.unstable_mockModule('../../src/config/jwt.js', () => ({
    signToken: mockSignToken,
    verifyToken: jest.fn()
}));

jest.unstable_mockModule('../../src/services/auth/authService.js', () => ({
    registerUser: jest.fn(), loginUser: jest.fn(), handleGoogleAuth: jest.fn(),
    handleGithubAuth: jest.fn(), getUserById: jest.fn(), verifyCredentialsForRestore: jest.fn()
}));
jest.unstable_mockModule('../../src/services/auth/accountDeletionService.js', () => ({
    requestAccountDeletion: jest.fn(), cancelAccountDeletion: jest.fn()
}));
jest.unstable_mockModule('../../src/config/googleOAuth.js', () => ({
    getGoogleAuthURL: jest.fn(), getGoogleTokens: jest.fn(), getGoogleUser: jest.fn()
}));
jest.unstable_mockModule('../../src/config/githubOAuth.js', () => ({
    getGithubAuthURL: jest.fn(), getGithubTokens: jest.fn(), getGithubUser: jest.fn()
}));
jest.unstable_mockModule('../../src/services/auth/oauthExchangeService.js', () => ({
    createExchangeCode: jest.fn(), consumeExchangeCode: jest.fn()
}));
jest.unstable_mockModule('../../src/services/auth/dataExportService.js', () => ({
    exportUserData: jest.fn()
}));

const makeRes = () => ({
    cookie: jest.fn(),
    clearCookie: jest.fn(),
    json: jest.fn(),
    status: jest.fn().mockReturnThis()
});

beforeEach(() => {
    jest.clearAllMocks();
});

describe('refreshToken', () => {
    it('answers a missing refresh cookie with 401, not 500', async () => {
        const { refreshToken } = await import('../../src/controllers/authController.js');
        const next = jest.fn();

        await refreshToken({ cookies: {}, body: {}, headers: {} }, makeRes(), next);

        const error = next.mock.calls[0][0];
        // 500 here is what left the client unable to tell "your session is over" from "the
        // server is having a moment", so it chose the safe reading and never signed out.
        expect(error.statusCode).toBe(401);
    });

    it('does not consult the session store when no token was presented', async () => {
        const { refreshToken } = await import('../../src/controllers/authController.js');

        await refreshToken({ cookies: {}, body: {}, headers: {} }, makeRes(), jest.fn());

        expect(mockValidateSession).not.toHaveBeenCalled();
    });

    it('answers an unknown or expired refresh token with 401 and clears the cookie', async () => {
        const { refreshToken } = await import('../../src/controllers/authController.js');
        mockValidateSession.mockResolvedValue(null);
        const res = makeRes();
        const next = jest.fn();

        await refreshToken({ cookies: { refreshToken: 'dead' }, body: {}, headers: {} }, res, next);

        expect(next.mock.calls[0][0].statusCode).toBe(401);
        // Leaving a token the server has rejected in the jar means every later refresh
        // repeats the same round-trip to reach the same answer.
        expect(res.clearCookie).toHaveBeenCalled();
    });

    it('rotates and issues a new access token for a live session', async () => {
        const { refreshToken } = await import('../../src/controllers/authController.js');
        mockValidateSession.mockResolvedValue({ id: 's1', userId: 'u1', user: { email: 'a@b.co' } });
        mockRotateSession.mockResolvedValue('rotated-refresh-token');
        const res = makeRes();
        const next = jest.fn();

        await refreshToken({ cookies: { refreshToken: 'good' }, body: {}, headers: {} }, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({ token: 'new.access.token' });
        // sessionId must ride in the access token, or authMiddleware cannot check revocation.
        expect(mockSignToken).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 's1' }));
    });
});
