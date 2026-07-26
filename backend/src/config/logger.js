import pino from 'pino';

/**
 * Centralized logger for backend observability.
 * Uses 'pino' for structured JSON logging in production and 'pino-pretty' in development.
 */
/**
 * Paths scrubbed before anything is written.
 *
 * This is a backstop, not the control: the rule is still that credentials are never passed
 * to the logger in the first place. But `logger.error({ err })` on a failed outbound call
 * serialises the whole axios error — including `config.headers.Authorization`, which on the
 * OAuth and provider-discovery paths is a live third-party token — and no reviewer reliably
 * spots that at the call site. Redaction turns "someone logged an object that happened to
 * contain a secret" from a disclosure into a `[Redacted]`.
 *
 * Wildcards are used because the sensitive field is usually nested somewhere unpredictable
 * in a serialised error or request object.
 */
export const REDACTED_PATHS = [
    'req.headers.authorization',
    'req.headers.cookie',
    'headers.authorization',
    'headers.cookie',
    '*.headers.authorization',
    '*.headers.cookie',
    '*.config.headers.Authorization',
    'password',
    '*.password',
    'apiKey',
    '*.apiKey',
    'token',
    '*.token',
    'refreshToken',
    '*.refreshToken',
    'encryptedKey',
    '*.encryptedKey',
    'access_token',
    '*.access_token',
    'refresh_token',
    '*.refresh_token',
    'id_token',
    '*.id_token',
    'client_secret',
    '*.client_secret'
];

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    redact: { paths: REDACTED_PATHS, censor: '[Redacted]' },
    base: {
        env: process.env.NODE_ENV,
        service: 'sra-backend'
    },
    transport: process.env.NODE_ENV === 'development' ? {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname'
        }
    } : undefined
});

export default logger;
