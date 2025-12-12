import { registerUser, loginUser, handleGoogleAuth, handleGithubAuth, getUserById } from '../services/authService.js';
import { getGoogleAuthURL, getGoogleTokens, getGoogleUser } from '../config/googleOAuth.js';
import { getGithubAuthURL, getGithubTokens, getGithubUser } from '../config/githubOAuth.js';
import { validateSession, rotateSession, revokeSession, getUserSessions } from '../services/sessionService.js';
import { signToken } from '../config/jwt.js';

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
        res.status(201).json(result);
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
        res.json(result);
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

        const result = await handleGoogleAuth(googleUser, tokens);

        // Redirect to frontend with token
        // Update FRONTEND_URL in .env if needed, defaulting to root provided in requirements or same host
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
        res.redirect(`${frontendUrl}/?token=${result.token}`);
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

        const result = await handleGithubAuth(githubUser, tokens);

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
        res.redirect(`${frontendUrl}/?token=${result.token}`);
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
        const newAccessToken = signToken({ userId: session.userId, email: session.user.email });

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
        const sessions = await getUserSessions(req.user.userId);
        // Mask token
        res.json(sessions);
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
