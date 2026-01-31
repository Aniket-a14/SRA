import { doubleCsrf } from 'csrf-csrf';

const csrfSecret = process.env.CSRF_SECRET || 'a-very-secret-string-for-csrf';

const csrf = doubleCsrf({
    getSecret: () => csrfSecret,
    getSessionIdentifier: () => 'stateless', // Use a constant for stateless apps
    cookieName: 'x-csrf-token',
    cookieOptions: {
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
    },
    getTokenFromRequest: (req) => req.headers['x-csrf-token'],
});

const protection = csrf.doubleCsrfProtection;

export const {
    invalidCsrfTokenError,
    generateCsrfToken: generateToken,
    validateRequest,
} = csrf;

export const doubleCsrfProtection = (req, res, next) => {
    if (process.env.NODE_ENV === 'test') {
        return next();
    }

    // Logging for debugging in development
    if (process.env.NODE_ENV === 'development') {
        const tokenInHeader = req.headers['x-csrf-token'];
        const cookiePresent = !!req.cookies?.['x-csrf-token'];

        // If it's localhost and we're in dev, we can be more lenient if needed
        // but let's try to just log first.
        if (!tokenInHeader || !cookiePresent) {
            console.warn(`[CSRF Debug] Missing token or cookie. Header: ${!!tokenInHeader}, Cookie: ${cookiePresent}`);
        }
    }

    return protection(req, res, next);
};
