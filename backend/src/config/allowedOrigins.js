/**
 * The single source of truth for which browser origins may talk to this API.
 *
 * Extracted from app.js because two consumers need it: the `cors()` middleware, and the
 * CSRF guard on the cookie-authenticated auth routes (middleware/csrfMiddleware.js).
 * They must agree — an origin CORS trusts is exactly an origin allowed to present the
 * refresh cookie.
 */

const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:3001').replace(/\/$/, '');

// ALLOWED_ORIGINS previously only fed the CSP connect-src — multi-origin deployments
// (preview URLs, staging) relying on it for CORS were silently rejected by the browser.
const ADDITIONAL_ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

// A wildcard whose first label is `*` directly in front of a shared multi-tenant hosting
// suffix (e.g. "https://*.vercel.app") is dangerous with `credentials: true`: ANY tenant on
// that platform — including an attacker's own preview deployment — would pass CORS and make
// credentialed requests. Bounded wildcards ("https://sra-*.vercel.app") are fine. Broad ones
// are dropped unless ALLOW_BROAD_CORS_WILDCARD=true is set explicitly.
const MULTI_TENANT_SUFFIXES = ['vercel.app', 'netlify.app', 'onrender.com', 'pages.dev', 'web.app', 'firebaseapp.com', 'herokuapp.com', 'github.io'];

const isBroadWildcard = (pattern) => {
    const m = pattern.match(/^https?:\/\/\*\.(.+)$/);
    return !!m && MULTI_TENANT_SUFFIXES.includes(m[1].toLowerCase());
};

const allowBroad = process.env.ALLOW_BROAD_CORS_WILDCARD === 'true';
const rejectedBroad = [];
const safeAdditional = ADDITIONAL_ALLOWED_ORIGINS.filter((p) => {
    if (isBroadWildcard(p) && !allowBroad) { rejectedBroad.push(p); return false; }
    return true;
});

export const ALLOWED_ORIGIN_LIST = [FRONTEND_URL, ...safeAdditional];

if (rejectedBroad.length > 0) {
    console.warn(`⚠️  CORS: dropped broad multi-tenant wildcard origin(s) ${rejectedBroad.join(', ')} — they would let any tenant on that host make credentialed requests. Use a bounded pattern (e.g. https://sra-*.vercel.app) or set ALLOW_BROAD_CORS_WILDCARD=true to override.`);
}
console.log(`[CORS] Effective allowlist: ${ALLOWED_ORIGIN_LIST.join(', ')}`);

// Supports simple `*` wildcard entries (e.g. "https://sra-*.vercel.app") in addition to exact origins.
export const originMatches = (origin, pattern) => {
    if (!pattern.includes('*')) return origin === pattern;
    const regex = new RegExp('^' + pattern.split('*').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
    return regex.test(origin);
};

export const isOriginAllowed = (origin) =>
    !!origin && ALLOWED_ORIGIN_LIST.some(pattern => originMatches(origin, pattern));

export const corsOriginCallback = (origin, callback) => {
    if (!origin) return callback(null, true); // non-browser requests (curl, server-to-server)
    if (isOriginAllowed(origin)) return callback(null, true);

    // Without an explicit status this surfaces as a 500 with a stack trace — a rejected
    // origin is a client error, not a server fault.
    const error = new Error('Not allowed by CORS');
    error.statusCode = 403;
    return callback(error);
};
