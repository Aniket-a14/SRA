import axios from 'axios';
import logger from './logger.js';

const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const CALLBACK_URL = process.env.GITHUB_CALLBACK_URL;

export const getGithubAuthURL = (state) => {
    const rootUrl = 'https://github.com/login/oauth/authorize';
    const options = {
        client_id: CLIENT_ID,
        redirect_uri: CALLBACK_URL,
        scope: 'user:email', // Request email access
        state,
    };

    const qs = new URLSearchParams(options);
    return `${rootUrl}?${qs.toString()}`;
};

export const getGithubTokens = async (code) => {
    const url = 'https://github.com/login/oauth/access_token';
    const values = {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        redirect_uri: CALLBACK_URL,
    };

    try {
        const res = await axios.post(url, values, {
            headers: {
                Accept: 'application/json',
            },
        });
        return res.data;
    } catch (error) {
        logger.error({ msg: 'Failed to fetch GitHub tokens', error: error.response?.data || error.message });
        throw new Error(error.response?.data?.error_description || 'Failed to fetch GitHub tokens');
    }
};

export const getGithubUser = async (accessToken) => {
    try {
        const userRes = await axios.get('https://api.github.com/user', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        // The address is always resolved from /user/emails and must be BOTH primary and
        // verified. `userRes.data.email` — the profile's public email — was preferred when
        // present, and that field carries no verification guarantee from this endpoint.
        // Since an email match is what links an OAuth identity to an existing account
        // (authService), accepting an unverified address means whoever controls the OAuth
        // identity inherits whatever local account claims that address.
        //
        // Falling back to the public email when the list is unavailable would defeat the
        // check, so there is no fallback: no verified primary address, no sign-in.
        const emailRes = await axios.get('https://api.github.com/user/emails', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        const primaryEmail = Array.isArray(emailRes.data)
            ? emailRes.data.find(e => e.primary && e.verified)
            : null;

        if (!primaryEmail?.email) {
            const error = new Error('Your GitHub account has no verified primary email address. Verify one with GitHub, then sign in again.');
            error.statusCode = 400;
            throw error;
        }

        return { ...userRes.data, email: primaryEmail.email };
    } catch (error) {
        // The unverified-email rejection above is a decision, not a transport failure —
        // let it through with its own message and status instead of flattening it into a
        // generic 500 the user can do nothing about.
        if (error.statusCode) throw error;

        logger.error({ msg: 'Failed to fetch GitHub user', error: error.response?.data || error.message });
        throw new Error('Failed to fetch GitHub user info');
    }
};
