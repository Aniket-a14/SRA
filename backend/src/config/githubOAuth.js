import axios from 'axios';
import logger from './logger.js';

const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const CALLBACK_URL = process.env.GITHUB_CALLBACK_URL;

export const getGithubAuthURL = () => {
    const rootUrl = 'https://github.com/login/oauth/authorize';
    const options = {
        client_id: CLIENT_ID,
        redirect_uri: CALLBACK_URL,
        scope: 'user:email', // Request email access
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

        // If email is not public, fetch it explicitly
        let email = userRes.data.email;
        if (!email) {
            const emailRes = await axios.get('https://api.github.com/user/emails', {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            const primaryEmail = emailRes.data.find(e => e.primary && e.verified);
            if (primaryEmail) {
                email = primaryEmail.email;
            }
        }

        return { ...userRes.data, email };
    } catch (error) {
        logger.error({ msg: 'Failed to fetch GitHub user', error: error.response?.data || error.message });
        throw new Error('Failed to fetch GitHub user info');
    }
};
