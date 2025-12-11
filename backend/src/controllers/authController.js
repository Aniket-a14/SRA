import { registerUser, loginUser, handleGoogleAuth, handleGithubAuth, getUserById } from '../services/authService.js';
import { getGoogleAuthURL, getGoogleTokens, getGoogleUser } from '../config/googleOAuth.js';
import { getGithubAuthURL, getGithubTokens, getGithubUser } from '../config/githubOAuth.js';

export const signup = async (req, res, next) => {
    try {
        const { email, password, name } = req.body;
        if (!email || !password) {
            const error = new Error('Email and password are required');
            error.statusCode = 400;
            throw error;
        }

        const result = await registerUser(email, password, name);
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

        const result = await loginUser(email, password);
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
