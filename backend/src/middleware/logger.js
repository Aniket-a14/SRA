import pinoHttp from 'pino-http';
import pino from 'pino';

import { v4 as uuidv4 } from 'uuid';
import { REDACTED_PATHS } from '../config/logger.js';

const pinoLogger = pino({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    // Same scrub list as the application logger. This instance is the one every request
    // passes through, so it is the one most likely to be handed an object it did not expect.
    redact: { paths: REDACTED_PATHS, censor: '[Redacted]' },
    transport: process.env.NODE_ENV !== 'production' ? {
        target: 'pino-pretty',
        options: {
            colorize: true,
        },
    } : undefined,
});

// Query parameters that are credentials rather than parameters. The OAuth callbacks are the
// reason this exists: every request line was logged as `req.url` verbatim, so
// `GET /auth/google/callback?code=4/0Ax...&state=...` wrote a live authorization code into
// the access log. The code is single-use and short-lived, but a log aggregator keeps it for
// weeks, and anyone with log access could replay one caught mid-flight.
const SENSITIVE_QUERY_PARAMS = new Set([
    'code', 'state', 'token', 'access_token', 'refresh_token', 'id_token', 'key', 'apikey', 'api_key', 'password'
]);

/**
 * The request target with credential-bearing query parameters masked, keeping the ordinary
 * ones (`?mode=sync`, `?chain=true`) that make a log line worth reading.
 */
export const safeUrl = (url = '') => {
    const [path, queryString] = url.split('?');
    if (!queryString) return path;

    const params = new URLSearchParams(queryString);
    for (const name of params.keys()) {
        if (SENSITIVE_QUERY_PARAMS.has(name.toLowerCase())) params.set(name, '[Redacted]');
    }
    return `${path}?${params.toString()}`;
};

export const logger = pinoHttp({
    logger: pinoLogger,
    autoLogging: true,
    // Streamline: Don't log the full req/res objects which clutter the terminal
    serializers: {
        req: () => undefined,
        res: () => undefined,
    },
    // A client-supplied x-request-id is accepted for cross-service correlation, but it is
    // attacker-controlled text heading for the log, so it is bounded and restricted to the
    // characters an id legitimately uses — otherwise a crafted header can inject newlines
    // and forge whole log entries in any line-oriented collector.
    genReqId: (req) => {
        if (req.id) return req.id;
        const supplied = req.headers['x-request-id'];
        if (typeof supplied === 'string' && /^[\w.-]{1,128}$/.test(supplied)) return supplied;
        return uuidv4();
    },
    customSuccessMessage: (req, res, responseTime) => {
        return `${req.method} ${safeUrl(req.url)} ${res.statusCode} - ${responseTime}ms`;
    },
    customErrorMessage: (req, res, err) => {
        return `${req.method} ${safeUrl(req.url)} ${res.statusCode} - ${err.message}`;
    },
    customProps: (req, res) => ({
        userId: req.user?.userId,
        requestId: req.id
    })
});

export const log = pinoLogger;
