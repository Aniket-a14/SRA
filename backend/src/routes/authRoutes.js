import express from 'express';
import cookieParser from 'cookie-parser';
import { signup, login, googleStart, googleCallback, githubStart, githubCallback, exchangeToken, getMe, refreshToken, logout, getSessions, revokeSessionEndpoint, exportMyData, deleteMyAccount, restoreMyAccount, REFRESH_TOKEN_COOKIE } from '../controllers/authController.js';
import { authenticate, requireScope } from '../middleware/authMiddleware.js';
import { loginLimiter } from '../middleware/rateLimiters.js';
import { validate } from '../middleware/validationMiddleware.js';
import { requireTrustedOrigin } from '../middleware/csrfMiddleware.js';
import { signupSchema, loginSchema, restoreAccountSchema } from '../utils/validationSchemas.js';

const router = express.Router();

// Cookies are read here and nowhere else in the app (the OAuth state cookie and the refresh
// token), so the parser is scoped to this router rather than mounted globally — every other
// route authenticates with a bearer header and has no business seeing a parsed cookie jar.
router.use(cookieParser(process.env.COOKIE_SECRET));

// The two endpoints that authenticate with an ambient cookie need CSRF protection; everything
// else on this router is either unauthenticated or bearer-authenticated. See csrfMiddleware.js.
const guardRefreshCookie = requireTrustedOrigin(REFRESH_TOKEN_COOKIE);

// Credential endpoints get the strict brute-force limiter on top of the router-wide authLimiter.
router.post('/signup', loginLimiter, validate(signupSchema), signup);
router.post('/login', loginLimiter, validate(loginSchema), login);
router.get('/google/start', googleStart);
router.get('/google/callback', googleCallback);
router.get('/github/start', githubStart);
router.get('/github/callback', githubCallback);
router.post('/exchange', exchangeToken);
router.get('/me', authenticate, getMe);
// Data access/portability (GDPR Art. 15/20). Bearer-authenticated like /me, so it is not
// reachable with the ambient refresh cookie and needs no CSRF guard.
router.get('/me/export', authenticate, exportMyData);
// Erasure (Art. 17). Restore is credential-authenticated rather than bearer-authenticated,
// because requesting deletion revokes every session — there is no token left to present —
// and re-entering a password is the right bar for undoing a destructive request. It carries
// loginLimiter for the same reason /login does: it takes a password.
router.delete('/me', authenticate, requireScope('admin'), deleteMyAccount);
router.post('/me/restore', loginLimiter, validate(restoreAccountSchema), restoreMyAccount);
router.post('/refresh', guardRefreshCookie, refreshToken);
router.post('/logout', guardRefreshCookie, logout);
router.get('/sessions', authenticate, getSessions);
router.delete('/sessions/:sessionId', authenticate, revokeSessionEndpoint);

import { createKey, listKeys, revokeKey } from '../controllers/apiKeyController.js';

// Key management is 'admin': without it, a leaked read-only key could mint itself a fully
// privileged one, and the scope system would be decorative.
router.post('/keys', authenticate, requireScope('admin'), createKey);
router.get('/keys', authenticate, listKeys);
router.delete('/keys/:id', authenticate, requireScope('admin'), revokeKey);

export default router;
