/**
 * Security Configuration
 * Generates Content Security Policy (CSP) headers based on environment
 */

export const getCSP = (isDev = false) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean)
        : (isDev ? ['http://localhost:3000', 'http://localhost:3001', 'https://*.vercel.app'] : []);

    const scriptSrc = [
        "'self'",
        'https://cdnjs.cloudflare.com',
        'https://cdn.jsdelivr.net'
    ];

    const styleSrc = [
        "'self'",
        'https://fonts.googleapis.com',
        'https://cdnjs.cloudflare.com',
        'https://cdn.jsdelivr.net'
    ];

    if (isDev) {
        scriptSrc.push("'unsafe-inline'", 'https://vercel.live');
        styleSrc.push("'unsafe-inline'");
    }

    return {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc,
            styleSrc,
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            imgSrc: [
                "'self'",
                'data:',
                'https:',
                'https://cdnjs.cloudflare.com',
                'https://cdn.jsdelivr.net',
                'https://*.googleusercontent.com',
                'https://avatars.githubusercontent.com'
            ],
            connectSrc: [
                "'self'",
                'https://generativelanguage.googleapis.com',
                ...allowedOrigins
            ],
            frameSrc: isDev ? ["'self'", 'https://vercel.live'] : ["'self'"],
            frameAncestors: ["'none'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"]
        }
    };
};
