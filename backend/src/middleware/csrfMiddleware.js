import { doubleCsrf } from 'csrf-csrf';

const csrfSecret = process.env.CSRF_SECRET || 'a-very-secret-string-for-csrf';

const csrf = doubleCsrf({
    getSecret: () => csrfSecret,
    getSessionIdentifier: (req) => req.cookies?.['x-csrf-token'] || 'stateless', // Tie it to the cookie or a default
    cookieName: 'x-csrf-token',
    cookieOptions: {
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' requires secure: true
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
    return protection(req, res, next);
};
