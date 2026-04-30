import prisma from '../config/prisma.js';
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

    // Return RAW key to user (only once!), store HASH in DB
    return { ...apiKey, rawKey };
};

const normalizePagination = (page = 1, limit = 20) => {
    const normalizedPage = Number.isFinite(Number(page)) ? Math.max(1, Number(page)) : 1;
    const normalizedLimit = Number.isFinite(Number(limit))
        ? Math.min(100, Math.max(1, Number(limit)))
        : 20;

    return {
        page: normalizedPage,
        limit: normalizedLimit,
        skip: (normalizedPage - 1) * normalizedLimit
    };
};

export const listApiKeys = async (userId, { page = 1, limit = 20 } = {}) => {
    const pagination = normalizePagination(page, limit);

    const [items, total] = await prisma.$transaction([
        prisma.apiKey.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            skip: pagination.skip,
            take: pagination.limit,
            select: { id: true, name: true, createdAt: true, lastUsed: true, expiresAt: true }
        }),
        prisma.apiKey.count({ where: { userId } })
    ]);

    return {
        items,
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / pagination.limit))
    };
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
