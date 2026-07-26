import prisma from '../../config/prisma.js';
import crypto, { createHash } from 'crypto';

// Helper to hash key for checking
export const hashKey = (key) => createHash('sha256').update(key).digest('hex');

export const createApiKey = async (userId, name, expiresInDays = 365) => {
    // Generate a secure random key: "sra_live_" + 64 hex chars
    const rawKey = `sra_live_${crypto.randomBytes(32).toString('hex')}`;
    const hashed = hashKey(rawKey);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const apiKey = await prisma.apiKey.create({
        data: {
            userId,
            name,
            key: hashed,
            expiresAt
        }
    });

    // Return the RAW key once (this is the only time it exists outside the caller's hands),
    // but not the stored SHA-256 `key` column. Spreading the whole row published the hash to
    // the client and into the response logs of anything in between, for no purpose — nothing
    // reads it, and `listApiKeys` already withholds it.
    return {
        id: apiKey.id,
        name: apiKey.name,
        createdAt: apiKey.createdAt,
        expiresAt: apiKey.expiresAt,
        rawKey
    };
};

export const listApiKeys = async (userId) => {
    return await prisma.apiKey.findMany({
        where: { userId },
        select: { id: true, name: true, createdAt: true, lastUsed: true, expiresAt: true } // Don't return key hash
    });
};

export const revokeApiKey = async (id, userId) => {
    return await prisma.apiKey.deleteMany({
        where: { id, userId }
    });
};

export const verifyApiKey = async (rawKey) => {
    const hashed = hashKey(rawKey);
    const apiKey = await prisma.apiKey.findUnique({
        where: { key: hashed },
        include: { user: true }
    });

    if (!apiKey) return null;
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

    // Update last used (fire-and-forget, don't block auth flow)
    prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsed: new Date() } }).catch(() => {});

    return apiKey.user;
};
