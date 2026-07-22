import crypto from 'crypto';
import { getRedisClient } from '../config/redis.js';
import logger from '../config/logger.js';

const EXCHANGE_TTL_SECONDS = 60;
const KEY_PREFIX = 'oauth_exchange:';

// Fallback store used only when Redis isn't configured (e.g. local dev without REDIS_URL).
// Not safe across multiple backend replicas — production always has Redis configured
// (already required for rate limiting), so this path only matters for single-instance dev.
const memoryStore = new Map();

const buildKey = (code) => `${KEY_PREFIX}${code}`;

/**
 * Stores a payload (JWT + refresh token) behind a short-lived, single-use random code,
 * so OAuth callbacks can redirect with an opaque nonce instead of live tokens in the URL.
 */
export const createExchangeCode = async (payload) => {
    const code = crypto.randomBytes(32).toString('hex');
    const key = buildKey(code);
    const serialized = JSON.stringify(payload);
    const redis = getRedisClient();

    if (redis) {
        await redis.set(key, serialized, 'EX', EXCHANGE_TTL_SECONDS);
    } else {
        logger.warn('[OAuth Exchange] Redis unavailable — using in-process fallback store (single-instance only)');
        memoryStore.set(key, serialized);
        const timer = setTimeout(() => memoryStore.delete(key), EXCHANGE_TTL_SECONDS * 1000);
        timer.unref?.();
    }

    return code;
};

/**
 * Consumes (single-use) an exchange code, returning the stored payload or null if
 * missing/expired/already used.
 */
export const consumeExchangeCode = async (code) => {
    if (!code) return null;
    const key = buildKey(code);
    const redis = getRedisClient();

    if (redis) {
        const value = await redis.get(key);
        if (!value) return null;
        await redis.del(key);
        return JSON.parse(value);
    }

    const value = memoryStore.get(key);
    if (!value) return null;
    memoryStore.delete(key);
    return JSON.parse(value);
};
