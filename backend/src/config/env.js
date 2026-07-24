import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const isProd = process.env.NODE_ENV === 'production';
const usesRealQueue = isProd && process.env.MOCK_QSTASH !== 'true';

/**
 * Environment schema. Split into three tiers:
 *  - Always required: the app cannot start or stay secure without these.
 *  - Conditionally required (production/real-queue): validated in a post-parse pass
 *    so local dev (email/password auth, MOCK_QSTASH) isn't forced to set prod-only secrets.
 *  - Optional: tuning/feature flags — presence is not enforced.
 *
 * The previous schema validated ENCRYPTION_SALT but NOT ENCRYPTION_KEY (the actual master
 * secret dataEncryption.js uses to encrypt every user's BYOK provider keys), nor the QStash
 * signing keys the worker needs to verify callbacks — so the app booted "validated" and then
 * failed at runtime. Those are now covered.
 */
const envSchema = z.object({
    // Server
    PORT: z.string().default('3000'),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    FRONTEND_URL: z.string().url().transform(val => val.replace(/\/$/, '')).optional(),
    BACKEND_URL: z.string().url().transform(val => val.replace(/\/$/, '')).optional(),
    ALLOWED_ORIGINS: z.string().optional(),

    // Database
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    DIRECT_URL: z.string().optional(),

    // AI providers (Gemini is the platform default/fallback; others are BYOK-only)
    GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
    OPENAI_API_KEY: z.string().optional(),

    // Auth / crypto — all master secrets that MUST be present and non-trivial
    JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
    COOKIE_SECRET: z.string().min(16, 'COOKIE_SECRET must be at least 16 characters'),
    ENCRYPTION_KEY: z.string().min(16, 'ENCRYPTION_KEY must be at least 16 characters (master secret for BYOK provider-key encryption)'),
    ENCRYPTION_SALT: z.string().min(1, 'ENCRYPTION_SALT is required'),

    // Queue / worker (Upstash QStash)
    QSTASH_TOKEN: z.string().min(1, 'QSTASH_TOKEN is required'),
    QSTASH_CURRENT_SIGNING_KEY: z.string().optional(),
    QSTASH_NEXT_SIGNING_KEY: z.string().optional(),

    // OAuth (optional per-provider; completeness enforced below if partially set)
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_REDIRECT_URI: z.string().optional(),
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
    GITHUB_CALLBACK_URL: z.string().optional(),

    // Backups (only exercised by the backup CLI/service)
    BACKUP_ENCRYPTION_SALT: z.string().min(1, 'BACKUP_ENCRYPTION_SALT is required'),
    BACKUP_ENCRYPTION_KEY: z.string().optional(),

    // Optional tuning / flags
    REDIS_URL: z.string().optional(),
    LOG_LEVEL: z.string().optional(),
    GEMINI_MODEL_NAME: z.string().optional(),
    OPENAI_MODEL_NAME: z.string().optional(),
    CLAUDE_MODEL_NAME: z.string().optional(),
    GROK_MODEL_NAME: z.string().optional(),
    MOCK_AI: z.string().optional(),
    MOCK_QSTASH: z.string().optional(),
});

/**
 * Production-only requirements that would be noise to enforce in local dev.
 * Returns an array of human-readable error strings (empty = all good).
 */
const checkConditional = (env) => {
    const errors = [];

    if (usesRealQueue) {
        if (!env.BACKEND_URL) errors.push('BACKEND_URL is required in production (QStash callback + signature URL)');
        if (!env.QSTASH_CURRENT_SIGNING_KEY) errors.push('QSTASH_CURRENT_SIGNING_KEY is required in production (worker signature verification)');
        if (!env.QSTASH_NEXT_SIGNING_KEY) errors.push('QSTASH_NEXT_SIGNING_KEY is required in production (worker signature key rotation)');
    }

    // OAuth is optional overall, but a half-configured provider is almost always a mistake.
    const googleParts = [env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REDIRECT_URI];
    if (googleParts.some(Boolean) && !googleParts.every(Boolean)) {
        errors.push('Google OAuth is partially configured — set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI together (or none)');
    }
    const githubParts = [env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET, env.GITHUB_CALLBACK_URL];
    if (githubParts.some(Boolean) && !githubParts.every(Boolean)) {
        errors.push('GitHub OAuth is partially configured — set GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, and GITHUB_CALLBACK_URL together (or none)');
    }

    return errors;
};

export const validateEnv = () => {
    let env;
    try {
        env = envSchema.parse(process.env);
    } catch (error) {
        if (error instanceof z.ZodError) {
            console.error('❌ Invalid environment variables:');
            error.errors.forEach((err) => {
                console.error(`   - ${err.path.join('.')}: ${err.message}`);
            });
        } else {
            console.error('❌ Failed to parse environment variables:', error);
        }
        process.exit(1);
    }

    const conditionalErrors = checkConditional(env);
    if (conditionalErrors.length > 0) {
        console.error('❌ Environment misconfiguration:');
        conditionalErrors.forEach((msg) => console.error(`   - ${msg}`));
        process.exit(1);
    }

    // Non-fatal warnings — the app runs, but degraded.
    if (!env.REDIS_URL) {
        console.warn('⚠️  REDIS_URL not set — rate limiting and analyses caching fall back to in-memory (not shared across replicas).');
    }

    return env;
};
