import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient } from '../config/redis.js';
import { log } from './logger.js';

// Setup Redis Store Factory
const redisClient = getRedisClient();

const createStore = (prefix) => {
    if (!redisClient) {
        log.warn(`Redis client not initialized, falling back to memory rate limiting for ${prefix}.`);
        return undefined;
    }
    return new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
        prefix: prefix,
    });
};

// Strict limiter for authentication routes (login, signup, etc.)
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 10, // Limit each IP to 10 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    store: createStore('rl:auth:'), // Unique store with prefix
    message: {
        error: "Too many authentication attempts, please try again after 15 minutes",
    },
});

// Moderate limiter for AI generation routes to prevent resource abuse
export const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 500, // Increased to support polling and active generation
    standardHeaders: true,
    legacyHeaders: false,
    store: createStore('rl:ai:'), // Unique store with prefix
    message: {
        error: "AI generation limit reached. Please wait a few minutes before generating more requirements.",
    },
});

// General purpose limiter for standard API routes
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 1000, // Higher limit for general API usage
    standardHeaders: true,
    legacyHeaders: false,
    store: createStore('rl:api:'), // Unique store with prefix
});
