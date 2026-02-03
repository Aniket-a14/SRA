/**
 * Security Configuration
 * Generates Content Security Policy (CSP) headers based on environment
 */

export const getCSP = (isDev = false) => {
    const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',')
        : ["'self'", "http://localhost:*", "https://*.vercel.app"];

    return {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://cdnjs.cloudflare.com",
                "https://vercel.live",
                "https://cdn.jsdelivr.net"
            ],
            styleSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://fonts.googleapis.com",
                "https://cdnjs.cloudflare.com",
                "https://cdn.jsdelivr.net"
            ],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: [
                "'self'",
                "data:",
                "https:",
                "https://cdnjs.cloudflare.com",
                "https://cdn.jsdelivr.net",
                "https://*.googleusercontent.com", // Auth images
                "https://avatars.githubusercontent.com" // GitHub images
            ],
            connectSrc: [
                "'self'",
                "https://generativelanguage.googleapis.com",
                ...ALLOWED_ORIGINS // Dynamic Allowlist
            ],
            frameSrc: ["'self'", "https://vercel.live"],
            frameAncestors: ["'none'"],
        }
    };
};
