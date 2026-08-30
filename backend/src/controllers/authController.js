import crypto from 'crypto';
import prisma from '../config/prisma.js';
import { registerUser, loginUser, handleGoogleAuth, handleGithubAuth, getUserById, verifyCredentialsForRestore } from '../services/auth/authService.js';
import { requestAccountDeletion, cancelAccountDeletion } from '../services/auth/accountDeletionService.js';
import { getGoogleAuthURL, getGoogleTokens, getGoogleUser } from '../config/googleOAuth.js';
import { getGithubAuthURL, getGithubTokens, getGithubUser } from '../config/githubOAuth.js';
import { validateSession, rotateSession, revokeSession, getUserSessions } from '../services/auth/sessionService.js';
import { signToken } from '../config/jwt.js';
import { createExchangeCode, consumeExchangeCode } from '../services/auth/oauthExchangeService.js';
import { exportUserData } from '../services/auth/dataExportService.js';

const OAUTH_STATE_COOKIE = 'oauth_state';
// Exported so authRoutes can point the CSRF guard at the same cookie this controller reads.
export const REFRESH_TOKEN_COOKIE = 'refreshToken';

const isProd = process.env.NODE_ENV === 'production';

// `httpOnly` and `secure` are written as literals at every res.cookie/clearCookie call below
// rather than hidden behind a helper. Both are load-bearing security attributes, and a reader
// (or a static analyzer) should be able to see them without following an indirection.
//
// `secure: true` is unconditional. Gating it on NODE_ENV used to leave the refresh token in
// clear text on any HTTPS deployment that was not tagged production — staging and preview
// builds, exactly the environments that carry real sessions. Browsers treat http://localhost
// as a trustworthy origin and accept Secure cookies from it, so local development is
// unaffected on Chrome, Edge and Firefox. (Safari does not implement that exception; local
// dev there needs HTTPS.)
//
// Frontend and backend are cross-site in production (separate Vercel deployments), so the
// refresh cookie must ride cross-origin fetch/XHR, not just top-level navigation — that
// requires SameSite=None. Locally (same registrable domain, different ports) Lax suffices.
const refreshCookieSameSite = isProd ? 'none' : 'lax';

const setRefreshCookie = (res, refreshToken) => {
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: refreshCookieSameSite,
        maxAge: 7 * 24 * 60 * 60 * 1000, // matches Session.expiresAt (7 days)
        path: '/',
    });
};

const clearRefreshCookie = (res) => {
    // clearCookie needs matching sameSite/secure attributes to reliably delete in all browsers.
    res.clearCookie(REFRESH_TOKEN_COOKIE, {
        httpOnly: true,
        secure: true,
        sameSite: refreshCookieSameSite,
        path: '/',
    });
};

export const signup = async (req, res, next) => {
    try {
        const { email, password, name } = req.body;
        if (!email || !password) {
            const error = new Error('Email and password are required');
            error.statusCode = 400;
            throw error;
        }

        const ip = req.ip;
        const userAgent = req.headers['user-agent'];

        const result = await registerUser(email, password, name, userAgent, ip);
        setRefreshCookie(res, result.refreshToken);
        res.status(201).json({ user: result.user, token: result.token });
    } catch (error) {
        next(error);
    }
};

export const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            const error = new Error('Email and password must be provided');
            error.statusCode = 400;
            throw error;
        }

        const ip = req.ip;
        const userAgent = req.headers['user-agent'];

        const result = await loginUser(email, password, userAgent, ip);
        setRefreshCookie(res, result.refreshToken);
        res.json({ user: result.user, token: result.token });
    } catch (error) {
        next(error);
    }
};

const OAUTH_STATE_COOKIE_MAX_AGE = 10 * 60 * 1000; // only needs to survive the redirect round-trip

export const googleStart = (req, res) => {
    const state = crypto.randomBytes(16).toString('hex');
    res.cookie(OAUTH_STATE_COOKIE, state, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: OAUTH_STATE_COOKIE_MAX_AGE,
        path: '/',
        signed: true,
    });
    const url = getGoogleAuthURL(state);
    res.redirect(url);
};

export const googleCallback = async (req, res, next) => {
    try {
        const { code, state } = req.query;
        // A missing code is a malformed callback, not a server fault; bare it defaults to 500.
        if (!code) {
            const error = new Error('Authorization code missing');
            error.statusCode = 400;
            throw error;
        }

        const expectedState = req.signedCookies?.[OAUTH_STATE_COOKIE];
        res.clearCookie(OAUTH_STATE_COOKIE, { path: '/' });
        if (!state || !expectedState || state !== expectedState) {
            const error = new Error('Invalid or expired OAuth state');
            error.statusCode = 400;
            throw error;
        }

        const tokens = await getGoogleTokens(code);
        const googleUser = await getGoogleUser(tokens.id_token, tokens.access_token);

        const ip = req.ip;
        const userAgent = req.headers['user-agent'];

        const result = await handleGoogleAuth(googleUser, tokens, userAgent, ip);

        // Redirect with a short-lived, single-use exchange code instead of live tokens —
        // tokens never touch the URL (browser history / Referer headers).
        const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3001').replace(/\/$/, '');
        const exchangeCode = await createExchangeCode({ token: result.token, refreshToken: result.refreshToken });
        res.redirect(`${frontendUrl}/auth/complete?code=${exchangeCode}`);
    } catch (error) {
        next(error);
    }
};

export const githubStart = (req, res) => {
    const state = crypto.randomBytes(16).toString('hex');
    res.cookie(OAUTH_STATE_COOKIE, state, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: OAUTH_STATE_COOKIE_MAX_AGE,
        path: '/',
        signed: true,
    });
    const url = getGithubAuthURL(state);
    res.redirect(url);
};

export const githubCallback = async (req, res, next) => {
    try {
        const { code, state } = req.query;
        // A missing code is a malformed callback, not a server fault; bare it defaults to 500.
        if (!code) {
            const error = new Error('Authorization code missing');
            error.statusCode = 400;
            throw error;
        }

        const expectedState = req.signedCookies?.[OAUTH_STATE_COOKIE];
        res.clearCookie(OAUTH_STATE_COOKIE, { path: '/' });
        if (!state || !expectedState || state !== expectedState) {
            const error = new Error('Invalid or expired OAuth state');
            error.statusCode = 400;
            throw error;
        }

        const tokens = await getGithubTokens(code);
        const githubUser = await getGithubUser(tokens.access_token);

        const ip = req.ip;
        const userAgent = req.headers['user-agent'];

        const result = await handleGithubAuth(githubUser, tokens, userAgent, ip);

        const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3001').replace(/\/$/, '');
        const exchangeCode = await createExchangeCode({ token: result.token, refreshToken: result.refreshToken });
        res.redirect(`${frontendUrl}/auth/complete?code=${exchangeCode}`);
    } catch (error) {
        next(error);
    }
};

export const exchangeToken = async (req, res, next) => {
    try {
        const { code } = req.body;
        if (!code) {
            const error = new Error('Exchange code is required');
            error.statusCode = 400;
            throw error;
        }

        const payload = await consumeExchangeCode(code);
        if (!payload) {
            const error = new Error('Invalid or expired exchange code');
            error.statusCode = 400;
            throw error;
        }

        setRefreshCookie(res, payload.refreshToken);
        res.json({ token: payload.token });
    } catch (error) {
        next(error);
    }
};

export const getMe = async (req, res, next) => {
    try {
        const user = await getUserById(req.user.userId);
        res.json(user);
    } catch (error) {
        next(error);
    }
};

/**
 * GET /auth/me/export — the caller's own data, as a downloadable JSON file.
 *
 * Satisfies the access and portability rights (GDPR Art. 15/20, CCPA right to know), which
 * previously had no implementation at all: answering a request meant someone running queries
 * by hand. Scoped to `req.user.userId` throughout, so it is a self-service export and never
 * an admin one.
 */
export const exportMyData = async (req, res, next) => {
    try {
        const data = await exportUserData(req.user.userId);

        // Content-Disposition so a browser saves it rather than rendering it, and no-store
        // so this response is never held in a shared cache — it is the densest collection of
        // one user's personal data the API will ever return.
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="sra-export-${Date.now()}.json"`);
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).send(JSON.stringify(data, null, 2));
    } catch (error) {
        next(error);
    }
};

/**
 * GET /auth/me/audit-logs — returns paginated audit events for the authenticated user.
 */
export const getMyAuditLogs = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
        const skip = (page - 1) * limit;

        const { action, status, from, to } = req.query;

        const where = { userId };
        if (action) where.action = String(action);
        if (status) where.status = String(status);
        if (from || to) {
            where.createdAt = {};
            if (from) where.createdAt.gte = new Date(from);
            if (to) where.createdAt.lte = new Date(to);
        }

        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                select: {
                    id: true,
                    action: true,
                    resource: true,
                    resourceId: true,
                    ipAddress: true,
                    userAgent: true,
                    status: true,
                    metadata: true,
                    createdAt: true
                }
            }),
            prisma.auditLog.count({ where })
        ]);

        res.json({
            success: true,
            data: logs,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /auth/me — request erasure of the caller's own account (GDPR Art. 17).
 *
 * Takes effect immediately (sessions revoked, account unusable); the data itself is purged
 * after a grace window by the reconciliation sweep. Bearer-authenticated, so it is not
 * reachable with the ambient refresh cookie.
 */
export const deleteMyAccount = async (req, res, next) => {
    try {
        const result = await requestAccountDeletion(req.user.userId);
        clearRefreshCookie(res);
        res.json({
            message: `Account scheduled for deletion. You have ${result.graceDays} days to change your mind by signing in again and cancelling.`,
            ...result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /auth/me/restore — cancel a pending deletion inside the grace window.
 *
 * Deliberately not bearer-authenticated: requesting deletion revokes every session, so the
 * user has no access token to present. Cancelling therefore requires re-authenticating with
 * a password, which is also the right bar for undoing a destructive request.
 */
export const restoreMyAccount = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            const error = new Error('Email and password are required');
            error.statusCode = 400;
            throw error;
        }

        const userId = await verifyCredentialsForRestore(email, password);
        const result = await cancelAccountDeletion(userId);
        res.json({ message: 'Account restored. You can sign in as usual.', ...result });
    } catch (error) {
        next(error);
    }
};

export const refreshToken = async (req, res, next) => {
    try {
        const refreshTokenValue = req.cookies?.[REFRESH_TOKEN_COOKIE] || req.body?.refreshToken;

        // No cookie means the session is over as far as this browser is concerned, and that is
        // a 401. Thrown bare it carried no statusCode, so the error handler defaulted it to 500
        // — and the client reads 5xx as "the server said nothing", keeping a session it can no
        // longer use. That mismatch is what left the app signed in but unable to load anything.
        if (!refreshTokenValue) {
            const error = new Error("No active session");
            error.statusCode = 401;
            throw error;
        }

        const session = await validateSession(refreshTokenValue);
        if (!session) {
            clearRefreshCookie(res);
            const error = new Error("Invalid or Expired Refresh Token");
            error.statusCode = 401;
            throw error;
        }

        const ip = req.ip;
        const userAgent = req.headers['user-agent'];

        // Rotate Refresh Token
        const newRefreshToken = await rotateSession(session, userAgent, ip);

        // Issue new Access Token
        const newAccessToken = signToken({ userId: session.userId, email: session.user.email, sessionId: session.id });

        setRefreshCookie(res, newRefreshToken);
        res.json({ token: newAccessToken });
    } catch (error) {
        next(error);
    }
};

export const logout = async (req, res, next) => {
    try {
        const refreshTokenValue = req.cookies?.[REFRESH_TOKEN_COOKIE] || req.body?.refreshToken;
        if (refreshTokenValue) {
            const session = await validateSession(refreshTokenValue);
            if (session) {
                await revokeSession(session.id);
            }
        }
        clearRefreshCookie(res);
        res.json({ message: "Logged out" });
    } catch (error) {
        next(error);
    }
};

export const getSessions = async (req, res, next) => {
    try {
        const sessions = await getUserSessions(req.user.userId);

        // Mark current session
        const currentSessionId = req.user.sessionId;
        const result = sessions.map(s => ({
            ...s,
            isCurrent: s.id === currentSessionId
        }));

        res.json(result);
    } catch (error) {
        next(error);
    }
};

export const revokeSessionEndpoint = async (req, res, next) => {
    try {
        const { sessionId } = req.params;
        await revokeSession(sessionId, req.user.userId);
        res.json({ message: "Session revoked" });
    } catch (error) {
        next(error);
    }
};
