import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
    // Server Config
    PORT: z.string().default('3000'),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    FRONTEND_URL: z.string().url().transform(val => val.replace(/\/$/, '')).optional(),
    BACKEND_URL: z.string().url().transform(val => val.replace(/\/$/, '')).optional(),

    // Database
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

    // AI Providers
    GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
    OPENAI_API_KEY: z.string().optional(),

    // Auth
    JWT_SECRET: z.string().min(8, "JWT_SECRET must be at least 8 characters"),
    COOKIE_SECRET: z.string().min(8, "COOKIE_SECRET must be at least 8 characters"),
    ENCRYPTION_SALT: z.string().min(1, "ENCRYPTION_SALT is required"),
    BACKUP_ENCRYPTION_SALT: z.string().min(1, "BACKUP_ENCRYPTION_SALT is required"),

    // Infrastructure
    QSTASH_TOKEN: z.string().min(1, "QSTASH_TOKEN is required"),
    INTERNAL_API_SECRET: z.string().optional(),
    MOCK_AI: z.string().optional(),
    MOCK_QSTASH: z.string().optional(),
});

export const validateEnv = () => {
    try {
        const env = envSchema.parse(process.env);

        if (env.NODE_ENV === 'production') {
            if (!env.INTERNAL_API_SECRET || env.INTERNAL_API_SECRET.length < 16) {
                throw new Error('INTERNAL_API_SECRET must be set in production and be at least 16 characters');
            }

            if (env.MOCK_AI === 'true') {
                throw new Error('MOCK_AI must be disabled in production');
            }

            if (env.MOCK_QSTASH === 'true') {
                throw new Error('MOCK_QSTASH must be disabled in production');
            }
        }

        return env;
    } catch (error) {
        if (error instanceof z.ZodError) {
            console.error("❌ Invalid environment variables:");
            error.errors.forEach((err) => {
                console.error(`   - ${err.path.join('.')}: ${err.message}`);
            });
        } else if (error instanceof Error) {
            console.error(`❌ Environment policy violation: ${error.message}`);
        } else {
            console.error("❌ Failed to parse environment variables:", error);
        }
        process.exit(1);
    }
};
