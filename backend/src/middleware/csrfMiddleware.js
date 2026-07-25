import { isOriginAllowed } from '../config/allowedOrigins.js';

/**
 * CSRF guard for the only endpoints that authenticate with an ambient credential.
 *
 * Every other route authenticates with a Bearer token in the `Authorization` header, which a
 * cross-site page cannot make a browser attach — those are structurally immune. `/auth/refresh`
 * and `/auth/logout` are the exception: they read the refresh token from a cookie, and in
 * production that cookie must be `SameSite=None` (frontend and backend are separate
 * deployments), so a cross-site POST *does* carry it. Unguarded, an attacker's page could force
 * a victim's logout or churn their session rotation.
 *
 * Browsers always attach `Origin` to a POST and page script cannot forge it, so requiring it to
 * be present and allowlisted is a complete mitigation without a token round-trip.
 *
 * Requests that carry no cookie are passed through: they are non-browser callers (the CLI,
 * server-to-server) presenting a bearer token or an explicit body parameter, neither of which
 * is ambient and neither of which CSRF can reach.
 */
export const requireTrustedOrigin = (cookieName) => (req, res, next) => {
    if (!req.cookies?.[cookieName]) return next();

    const origin = req.get('origin');
    if (origin) {
        if (isOriginAllowed(origin)) return next();
        return next(crossSiteError());
    }

    // A handful of navigation cases omit Origin but still send Referer; accept it on the same
    // allowlist rather than rejecting a legitimate first-party request.
    const referer = req.get('referer');
    if (referer) {
        try {
            if (isOriginAllowed(new URL(referer).origin)) return next();
        } catch {
            // Malformed Referer — fall through and reject.
        }
    }

    return next(crossSiteError());
};

const crossSiteError = () => {
    const error = new Error('Cross-site request blocked');
    error.statusCode = 403;
    return error;
};
