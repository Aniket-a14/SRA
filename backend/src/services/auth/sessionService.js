import prisma from '../../config/prisma.js';
import axios from 'axios';
import crypto from 'crypto';

// axios has no default timeout — an unreachable/slow ip-api.com would otherwise hang
// login/session-rotation (a critical path) for as long as the TCP connection allows.
const GEOLOCATION_TIMEOUT_MS = 3000;

const getLocationFromIp = async (ip) => {
    if (!ip || ip === '::1' || ip === '127.0.0.1') return 'Localhost';
    try {
        // `trust proxy` is on, so `ip` derives from X-Forwarded-For — a client-controlled
        // header. Interpolated raw, a value like `1.2.3.4/../../some/other/path` reshapes the
        // request path. Encoding pins it to a single path segment.
        const response = await axios.get(`http://ip-api.com/json/${encodeURIComponent(ip)}`, { timeout: GEOLOCATION_TIMEOUT_MS });
        if (response.data.status === 'success') {
            return `${response.data.city}, ${response.data.country}`;
        }
    } catch (_error) {
        // Silently fail - we don't want this error to crash the login.
        // It's better to log in without a location than to fail entirely.
        // In production, we might want to log this to Sentry/Datadog, but not here.
    }
    return 'Unknown Location';
};

/**
 * Creates a new session/refresh token for a user.
 * @param {string} userId - ID of the user.
 * @param {string} userAgent - Browser user agent.
 * @param {string} ipAddress - Client IP.
 * @returns {Promise<{refreshToken: string, sessionId: string}>}
 */
/**
 * Digest of a refresh token, as stored.
 *
 * The token is 40 bytes from a CSPRNG, so there is no low-entropy secret here for anyone to
 * guess and a plain SHA-256 is the right tool — bcrypt/scrypt would buy nothing and cost a
 * KDF on every refresh. What this defends is the database at rest: stored in clear text,
 * `Session.token` made a dump a live session for every user in it, presentable as-is with
 * no cracking step.
 */
export const hashRefreshToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export const createSession = async (userId, userAgent, ipAddress) => {
    // Generate random refresh token
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiry

    const location = await getLocationFromIp(ipAddress);

    const session = await prisma.session.create({
        data: {
            userId,
            // Only the digest is persisted; the token itself is returned to the caller and
            // otherwise exists nowhere on the server.
            tokenHash: hashRefreshToken(refreshToken),
            userAgent,
            ipAddress,
            location,
            expiresAt
        }
    });

    return { refreshToken, sessionId: session.id };
};

/**
 * Validates a refresh token and returns the session if valid.
 * @param {string} refreshToken
 * @returns {Promise<Object|null>}
 */
export const validateSession = async (refreshToken) => {
    if (!refreshToken) return null;

    const hash = hashRefreshToken(refreshToken);

    let session = await prisma.session.findUnique({
        where: { tokenHash: hash },
        include: { user: true }
    });

    if (session) {
        // Holding the current token proves the last rotation response arrived, which retires
        // its predecessor for good and re-arms replay detection below.
        if (!session.successorConfirmed) {
            await prisma.session.update({
                where: { id: session.id },
                data: { successorConfirmed: true }
            });
        }
    } else {
        // The superseded token. Rotation used to make this fatal, but a rotation response the
        // browser never received leaves it holding exactly this — a closed tab, a dropped
        // mobile connection — and signing the user out for our lost packet is wrong. It stays
        // valid until we have seen its replacement actually used.
        session = await prisma.session.findUnique({
            where: { prevTokenHash: hash },
            include: { user: true }
        });

        if (session?.successorConfirmed) {
            // The replacement is known to have arrived, so the browser is not the one
            // presenting this. Someone copied it; end the session rather than serve both.
            await prisma.session.update({ where: { id: session.id }, data: { revoked: true } });
            return null;
        }
    }

    if (!session) return null;
    if (session.revoked) return null;
    if (new Date() > session.expiresAt) return null;
    // A soft-deleted account is unusable from the moment erasure is requested, including
    // via a refresh token issued before it — otherwise "delete my account" would leave a
    // working credential in the browser for the length of the grace window.
    if (session.user?.deletedAt) return null;

    return session;
};

/**
 * Rotates a refresh token (Delete old, create new) to prevent replay attacks.
 * @param {Object} oldSession
 * @param {string} newUserAgent
 * @param {string} newIp
 * @returns {Promise<string>} New Refresh Token
 */
export const rotateSession = async (oldSession, newUserAgent, newIp) => {
    // Revoke old session (or delete it? Revoke allows tracking history).
    // Strategy: Delete old session to keep table clean, OR Revoke.
    // Let's delete for now, or update the existing record with new token?
    // Updating matches "Rotation" better.

    const newRefreshToken = crypto.randomBytes(40).toString('hex');
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7);

    const location = (newIp && newIp !== oldSession.ipAddress)
        ? await getLocationFromIp(newIp)
        : oldSession.location;

    // Which token stays valid alongside the new one. If the previous rotation was never
    // confirmed as received, the browser is demonstrably still on `prevTokenHash` — replacing
    // it with a token we have no evidence ever arrived would strand it one refresh later.
    const prevTokenHash = oldSession.successorConfirmed
        ? oldSession.tokenHash
        : (oldSession.prevTokenHash ?? null);

    // Update the existing session ID with new token (Rotation)
    await prisma.session.update({
        where: { id: oldSession.id },
        data: {
            tokenHash: hashRefreshToken(newRefreshToken),
            prevTokenHash,
            successorConfirmed: false,
            expiresAt: newExpiresAt,
            lastUsedAt: new Date(),
            userAgent: newUserAgent || oldSession.userAgent, // Update UA if changed?
            ipAddress: newIp || oldSession.ipAddress,
            location
        }
    });

    return newRefreshToken;
};

/**
 * Is the session behind an access token still live?
 *
 * Called on every bearer-authenticated request (see authMiddleware), so it selects the
 * three fields the decision needs and nothing else — no `include: { user: true }`, which
 * would pull the password hash into memory on every request to answer a boolean.
 *
 * `userId` is checked too: the session id comes out of a signed token, but binding it back
 * to the subject means a token can never be presented against a session that has since been
 * reassigned or that belongs to a different account.
 */
export const isSessionActive = async (sessionId, userId) => {
    if (!sessionId) return false;

    const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: { userId: true, revoked: true, expiresAt: true }
    });

    if (!session) return false;               // revoked sessions are deleted outright
    if (session.userId !== userId) return false;
    if (session.revoked) return false;
    return new Date() <= session.expiresAt;
};

export const revokeSession = async (sessionId, userId) => {
    // Ensure ownership if userId provided
    const where = userId ? { id: sessionId, userId } : { id: sessionId };
    await prisma.session.deleteMany({ where }); // deleteMany works safe
};

export const getUserSessions = async (userId) => {
    return await prisma.session.findMany({
        where: { userId },
        orderBy: { lastUsedAt: 'desc' },
        select: {
            id: true,
            userAgent: true,
            ipAddress: true,
            lastUsedAt: true,

            createdAt: true,
            expiresAt: true,
            location: true
        }
    });
};
