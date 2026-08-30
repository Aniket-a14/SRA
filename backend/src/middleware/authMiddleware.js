import { verifyToken } from '../config/jwt.js';
import { verifyApiKey, API_KEY_SCOPES } from '../services/auth/apiKeyService.js';
import { isSessionActive } from '../services/auth/sessionService.js';

export const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        const error = new Error('Unauthorized access');
        error.statusCode = 401;
        return next(error);
    }

    const token = authHeader.split(' ')[1]?.trim();
    if (!token) {
        const error = new Error('Unauthorized access');
        error.statusCode = 401;
        return next(error);
    }

    if (token.startsWith('sra_live_')) {
        // API Key Auth
        try {
            const result = await verifyApiKey(token);
            if (!result) throw new Error('Invalid API Key');
            const { user, scopes } = result;
            // `scopes` is what requireScope reads. A session-authenticated user is the
            // account itself and holds every scope; a key holds only what it was granted.
            req.user = { userId: user.id, email: user.email, scopes, authMethod: 'apiKey' };
            return next();
        } catch (_e) {
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

    // A live session implies a live, non-deleted account (requestAccountDeletion revokes
    // every session, and validateSession refuses a soft-deleted user), so the account state
    // does not need re-checking here.
    req.user = { ...decoded, scopes: API_KEY_SCOPES, authMethod: 'session' };
    next();
};

/**
 * Require a scope on the credential presented.
 *
 * Only meaningful for API keys: a session-authenticated user *is* the account and holds
 * every scope, so this is a no-op for them by construction. What it stops is the CI token
 * that only needs to read a spec being able to delete the project it came from.
 *
 * Applied per route rather than inferred from the HTTP verb, because the mapping is not
 * reliable — `POST /analyze` is ordinary work, `POST /settings/provider-keys` hands over a
 * credential.
 */
export const requireScope = (scope) => (req, res, next) => {
    const held = req.user?.scopes || [];

    if (held.includes(scope)) return next();

    const error = new Error(
        `This API key lacks the "${scope}" scope. Create a key with it in Settings, or use one that has it.`
    );
    error.statusCode = 403;
    return next(error);
};
