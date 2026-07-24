import { ErrorCodes } from '../utils/errorCodes.js';
import logger from '../config/logger.js';

export const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    const errorCode = err.code || (statusCode === 429 ? ErrorCodes.RATE_LIMIT_EXCEEDED : ErrorCodes.INTERNAL_ERROR);

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
