import prisma from '../../config/prisma.js';
import crypto, { createHash } from 'crypto';

// Helper to hash key for checking
export const hashKey = (key) => createHash('sha256').update(key).digest('hex');

/**
 * What an API key is allowed to do.
 *
 * A key used to carry the full authority of the account that created it, so the token a CI
 * job needs in order to run `sra check` could equally delete every project that account
 * owns. These are coarse on purpose — three levels a person can reason about at the moment
 * they create a key, rather than a permission matrix nobody will read.
 *
 *   read   GET anything you own
 *   write  create and update (analyze, sync, push)
 *   admin  destructive and credential-bearing operations (delete, provider keys)
 */
export const API_KEY_SCOPES = ['read', 'write', 'admin'];
export const DEFAULT_API_KEY_SCOPES = ['read', 'write'];

export const createApiKey = async (userId, name, expiresInDays = 365, scopes = DEFAULT_API_KEY_SCOPES) => {
    // Generate a secure random key: "sra_live_" + 64 hex chars
    const rawKey = `sra_live_${crypto.randomBytes(32).toString('hex')}`;
    const hashed = hashKey(rawKey);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const requested = Array.isArray(scopes) ? scopes.filter(s => API_KEY_SCOPES.includes(s)) : [];
    const grantedScopes = requested.length > 0 ? requested : DEFAULT_API_KEY_SCOPES;

    const apiKey = await prisma.apiKey.create({
        data: {
            userId,
            name,
            key: hashed,
            scopes: grantedScopes,
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
        scopes: apiKey.scopes,
        createdAt: apiKey.createdAt,
        expiresAt: apiKey.expiresAt,
        rawKey
    };
};

export const listApiKeys = async (userId) => {
    return await prisma.apiKey.findMany({
        where: { userId },
        select: { id: true, name: true, scopes: true, createdAt: true, lastUsed: true, expiresAt: true } // Don't return key hash
    });
};

export const revokeApiKey = async (id, userId) => {
    return await prisma.apiKey.deleteMany({
        where: { id, userId }
    });
};

/**
 * Resolve a raw API key to its owner and granted scopes.
 *
 * Returns `{ user, scopes }` rather than a bare user so the caller can enforce authority;
 * returning only the user is what made every key implicitly an admin key.
 */
export const verifyApiKey = async (rawKey) => {
    const hashed = hashKey(rawKey);
    const apiKey = await prisma.apiKey.findUnique({
        where: { key: hashed },
        include: { user: true }
    });

    if (!apiKey) return null;
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;
    // A key belonging to an account being erased stops working with the account.
    if (apiKey.user?.deletedAt) return null;

    // Update last used (fire-and-forget, don't block auth flow)
    prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsed: new Date() } }).catch(() => {});

    return {
        user: apiKey.user,
        scopes: apiKey.scopes?.length ? apiKey.scopes : DEFAULT_API_KEY_SCOPES
    };
};
