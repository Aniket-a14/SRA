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

// Moderate limiter for the auth router as a whole (OAuth, /me, /refresh, /sessions, /keys).
// Deliberately NOT the brute-force guard — credential endpoints get the stricter
// loginLimiter below. Kept relatively high so token refresh + session/key management
// under normal use don't trip it.
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
    store: createStore('rl:auth:'),
    message: {
        error: "Too many authentication requests, please try again after 15 minutes",
    },
});

// Strict brute-force guard for credential submission (POST /login, /signup). A separate,
// tight budget so password-guessing is throttled independently of benign auth traffic like
// token refresh or API-key management (which previously shared the same 100/15min bucket).
export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: Number(process.env.LOGIN_RATE_LIMIT) || 10,
    standardHeaders: true,
    legacyHeaders: false,
    // Only failed attempts count toward the limit — a user who logs in successfully
    // isn't penalized, but repeated wrong-password attempts are throttled quickly.
    skipSuccessfulRequests: true,
    store: createStore('rl:login:'),
    message: {
        error: "Too many login attempts. Please wait 15 minutes and try again.",
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
