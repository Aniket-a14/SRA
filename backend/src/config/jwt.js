import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

// Access tokens were signed for 7 days — the same lifetime as the refresh token they are
// supposed to be exchanged for, which made the refresh/rotation machinery ceremonial. The
// token is held in localStorage, so any XSS yields a credential good for a week.
//
// Shortening it is only safe because the client now refreshes transparently on a 401
// (frontend/lib/hooks.ts) and every request validates the session behind the token. Both
// are prerequisites: without the first, users are thrown out mid-session with no recovery
// until they reload; without the second, a short TTL still cannot revoke anything early.
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';

export const signToken = (payload) => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: EXPIRES_IN });
};

export const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
};
