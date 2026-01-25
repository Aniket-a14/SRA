import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
    // Server Config
    PORT: z.string().default('3000'),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    FRONTEND_URL: z.string().url(),
    BACKEND_URL: z.string().url(),

    // Database
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

    // AI Providers
    GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
    OPENAI_API_KEY: z.string().optional(),

    // Auth
    JWT_SECRET: z.string().min(8, "JWT_SECRET must be at least 8 characters"),
    COOKIE_SECRET: z.string().min(8, "COOKIE_SECRET must be at least 8 characters"),

    // Infrastructure
    QSTASH_TOKEN: z.string().min(1, "QSTASH_TOKEN is required"),
    MOCK_AI: z.string().optional(),
    MOCK_QSTASH: z.string().optional(),
});

export const validateEnv = () => {
    try {
        const env = envSchema.parse(process.env);
        return env;
    } catch (error) {
        if (error instanceof z.ZodError) {
            console.error("❌ Invalid environment variables:");
            error.errors.forEach((err) => {
                console.error(`   - ${err.path.join('.')}: ${err.message}`);
            });
        } else {
            console.error("❌ Failed to parse environment variables:", error);
        }
        process.exit(1);
    }
};
