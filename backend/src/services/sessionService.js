import prisma from '../config/prisma.js';
import axios from 'axios';
import crypto from 'crypto';

const getLocationFromIp = async (ip) => {
    if (!ip || ip === '::1' || ip === '127.0.0.1') return 'Localhost';
    try {
        const response = await axios.get(`http://ip-api.com/json/${ip}`);
        if (response.data.status === 'success') {
            return `${response.data.city}, ${response.data.country}`;
        }
    } catch (error) {
        console.error('GeoIP lookup failed', error.message);
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
export const createSession = async (userId, userAgent, ipAddress) => {
    // Generate random refresh token
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiry

    const location = await getLocationFromIp(ipAddress);

    const session = await prisma.session.create({
        data: {
            userId,
            token: refreshToken,
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
    const session = await prisma.session.findUnique({
        where: { token: refreshToken },
        include: { user: true }
    });

    if (!session) return null;
    if (session.revoked) return null;
    if (new Date() > session.expiresAt) return null;

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

    // Update the existing session ID with new token (Rotation)
    await prisma.session.update({
        where: { id: oldSession.id },
        data: {
            token: newRefreshToken,
            expiresAt: newExpiresAt,
            lastUsedAt: new Date(),
            userAgent: newUserAgent || oldSession.userAgent, // Update UA if changed?
            ipAddress: newIp || oldSession.ipAddress,
            location
        }
    });

    return newRefreshToken;
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
            lastUsedAt: true,
            createdAt: true,
            expiresAt: true,
            location: true
        }
    });
};
