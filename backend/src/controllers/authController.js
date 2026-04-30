import { registerUser, loginUser, handleGoogleAuth, handleGithubAuth, getUserById } from '../services/authService.js';
import { getGoogleAuthURL, getGoogleTokens, getGoogleUser } from '../config/googleOAuth.js';
import { getGithubAuthURL, getGithubTokens, getGithubUser } from '../config/githubOAuth.js';
import { validateSession, rotateSession, revokeSession, getUserSessions } from '../services/sessionService.js';
import { signToken } from '../config/jwt.js';
import crypto from 'crypto';
import { getRedisClient } from '../config/redis.js';
import logger from '../config/logger.js';

/**
 * Generate a short-lived, single-use auth code and store tokens in Redis.
 * This prevents tokens from appearing in URLs, browser history, and server logs.
 */
const generateAuthCode = async (result) => {
    const code = crypto.randomBytes(32).toString('hex');
    const redis = getRedisClient();

    if (redis) {
        await redis.set(
            `auth_code:${code}`,
            JSON.stringify({ token: result.token, refreshToken: result.refreshToken }),
            'EX', 60 // 60 second TTL
        );
        return code;
    }

    // Fallback: If Redis is unavailable (dev only), return tokens directly
    logger.warn('[Auth] Redis unavailable for auth code exchange, falling back to URL tokens (dev only)');
    return null;
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
        // SEC-006: Exclude password hash from API response
        const { password: _, ...safeUser } = result.user;
        res.status(201).json({ ...result, user: safeUser });
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
        // SEC-006: Exclude password hash from API response
        const { password: _, ...safeUser } = result.user;
        res.json({ ...result, user: safeUser });
    } catch (error) {
        next(error);
    }
};

export const googleStart = (req, res) => {
    const url = getGoogleAuthURL();
    res.redirect(url);
};

export const googleCallback = async (req, res, next) => {
    try {
        const { code } = req.query;
        if (!code) throw new Error('Authorization code missing');

        const tokens = await getGoogleTokens(code);
        const googleUser = await getGoogleUser(tokens.id_token, tokens.access_token);

        const ip = req.ip;
        const userAgent = req.headers['user-agent'];

        const result = await handleGoogleAuth(googleUser, tokens, userAgent, ip);

        // BUG-005 FIX: Use auth code exchange instead of passing tokens in URL
        const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3001').replace(/\/$/, '');
        const authCode = await generateAuthCode(result);

        if (authCode) {
            res.redirect(`${frontendUrl}/?code=${authCode}`);
        } else {
            // Fallback for dev without Redis
            res.redirect(`${frontendUrl}/?token=${result.token}&refreshToken=${result.refreshToken}`);
        }
    } catch (error) {
        next(error);
    }
};

export const githubStart = (req, res) => {
    const url = getGithubAuthURL();
    res.redirect(url);
};

export const githubCallback = async (req, res, next) => {
    try {
        const { code } = req.query;
        if (!code) throw new Error('Authorization code missing');

        const tokens = await getGithubTokens(code);
        const githubUser = await getGithubUser(tokens.access_token);

        const ip = req.ip;
        const userAgent = req.headers['user-agent'];

        const result = await handleGithubAuth(githubUser, tokens, userAgent, ip);

        // BUG-005 FIX: Use auth code exchange instead of passing tokens in URL
        const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3001').replace(/\/$/, '');
        const authCode = await generateAuthCode(result);

        if (authCode) {
            res.redirect(`${frontendUrl}/?code=${authCode}`);
        } else {
            // Fallback for dev without Redis
            res.redirect(`${frontendUrl}/?token=${result.token}&refreshToken=${result.refreshToken}`);
        }
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

export const refreshToken = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) throw new Error("Refresh Token Required");

        const session = await validateSession(refreshToken);
        if (!session) {
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

        res.json({ token: newAccessToken, refreshToken: newRefreshToken });
    } catch (error) {
        next(error);
    }
};

export const logout = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        if (refreshToken) {
            // Find session by token and delete
            // Note: revokeSession expects ID, but we can look it up first inside service or just find by token here.
            // Simplified: let's modify sessionService to allow find by token? 
            // Better: validateSession returns session object, use session.id
            const session = await validateSession(refreshToken);
            if (session) {
                await revokeSession(session.id);
            }
        }
        res.json({ message: "Logged out" });
    } catch (error) {
        next(error);
    }
};

export const getSessions = async (req, res, next) => {
    try {
        const page = Number.parseInt(req.query.page, 10) || 1;
        const limit = Number.parseInt(req.query.limit, 10) || 20;
        const sessions = await getUserSessions(req.user.userId, { page, limit });

        const currentSessionId = req.user.sessionId;
        const items = sessions.items.map(session => ({
            ...session,
            isCurrent: session.id === currentSessionId
        }));

        res.json({
            ...sessions,
            items
        });
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

/**
 * BUG-005: Exchange a short-lived auth code for JWT + refresh tokens.
 * The auth code is single-use and expires after 60 seconds.
 */
export const exchangeCode = async (req, res, next) => {
    try {
        const { code } = req.body;
        if (!code) {
            const error = new Error('Authorization code is required');
            error.statusCode = 400;
            throw error;
        }

        const redis = getRedisClient();
        if (!redis) {
            const error = new Error('Auth code exchange requires Redis');
            error.statusCode = 503;
            throw error;
        }

        const key = `auth_code:${code}`;
        const data = await redis.get(key);

        if (!data) {
            const error = new Error('Invalid or expired authorization code');
            error.statusCode = 401;
            throw error;
        }

        // Single-use: delete immediately after retrieval
        await redis.del(key);

        const tokens = JSON.parse(data);
        res.json(tokens);
    } catch (error) {
        next(error);
    }
};
