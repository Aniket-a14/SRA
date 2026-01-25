import rateLimit from 'express-rate-limit';

// Strict limiter for authentication routes (login, signup, etc.)
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 requests per window
    message: {
        error: "Too many authentication attempts, please try again after 15 minutes",
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Moderate limiter for AI generation routes to prevent resource abuse
export const aiLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 30, // Limit each IP to 30 requests per hour
    message: {
        error: "AI generation limit reached. Please wait an hour before generating more requirements.",
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// General purpose limiter for standard API routes
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
});
