import { verifyToken } from '../config/jwt.js';
import { verifyApiKey } from '../services/auth/apiKeyService.js';
import { isSessionActive } from '../services/auth/sessionService.js';

export const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        const error = new Error('Unauthorized access');
        error.statusCode = 401;
        return next(error);
    }

    const token = authHeader.split(' ')[1];
    if (token.startsWith('sra_live_')) {
        // API Key Auth
        try {
            const user = await verifyApiKey(token);
            if (!user) throw new Error('Invalid API Key');
            req.user = { userId: user.id, email: user.email }; // Minimal user context
            return next();
        } catch (e) {
            const error = new Error('Invalid or revoked API Key');
            error.statusCode = 401;
            return next(error);
        }
    }

    // JWT Auth
    const decoded = verifyToken(token);

    if (!decoded) {
        const error = new Error('Invalid or expired token');
        error.statusCode = 401;
        return next(error);
    }

    // The signature proves the token was issued by us; it says nothing about whether the
    // session behind it still exists. Access tokens live 7 days — the same as the refresh
    // token — and nothing here consulted the Session table, so revocation did not revoke:
    //
    //   - POST /auth/logout deleted the session and returned "Logged out" while the access
    //     token in the caller's hand stayed valid for the remainder of its 7 days.
    //   - DELETE /auth/sessions/:id, the "sign out this device" control, was cosmetic for
    //     exactly the case it exists to handle — a device you no longer trust.
    //
    // So a leaked token could not be taken back by any action the product offers. Binding
    // each request to a live session is what makes both controls real. It costs one indexed
    // lookup per authenticated request; if that ever shows up in latency, cache revoked
    // session ids in Redis rather than dropping the check.
    if (!decoded.sessionId || !(await isSessionActive(decoded.sessionId, decoded.userId))) {
        const error = new Error('Session is no longer valid. Please sign in again.');
        error.statusCode = 401;
        return next(error);
    }

    req.user = decoded; // { userId, email, sessionId }
    next();
};
