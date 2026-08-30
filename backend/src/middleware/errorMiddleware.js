import { ErrorCodes } from '../utils/errorCodes.js';
import { sanitizeError } from '../utils/errorSanitizer.js';
import logger from '../config/logger.js';

export const errorHandler = (err, req, res, _next) => {
    // sanitizeError trusts any message already attached to a statusCode < 500 (our own
    // deliberately-thrown, client-actionable errors) and only rewrites raw/5xx/unclassified
    // provider text — so this is safe to apply to every error that reaches this handler.
    const sanitized = sanitizeError(err);
    const statusCode = err.statusCode || sanitized.statusCode || 500;
    const message = sanitized.message;
    // sanitized.code already preserves err.code for our own deliberately-thrown errors
    // (statusCode < 500) — using err.code here too would let an arbitrary third-party
    // error code (e.g. a raw Prisma or provider SDK code) leak past the canonical
    // ErrorCodes contract the frontend pattern-matches on.
    const errorCode = sanitized.code || ErrorCodes.INTERNAL_ERROR;

    // Structured logging via pino (was console.error, which bypassed the logger and its
    // redaction/formatting). 5xx are logged at error level with the stack; expected 4xx
    // client errors are logged at warn without stack noise.
    const logPayload = { errorCode, requestId: req.id, statusCode, msg: err.message };
    if (statusCode >= 500) {
        logger.error({ ...logPayload, stack: err.stack });
    } else {
        logger.warn(logPayload);
    }

    // Set headers if available (e.g., for Retry-After)
    if (err.retryAfter) {
        res.set('Retry-After', String(err.retryAfter));
    }

    res.status(statusCode).json({
        success: false,
        message,
        errorCode,
        requestId: req.id,
        retryAfter: err.retryAfter,
        details: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
};
