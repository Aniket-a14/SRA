import { ErrorCodes } from '../utils/errorCodes.js';

export const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    const errorCode = err.code || (statusCode === 429 ? ErrorCodes.RATE_LIMIT_EXCEEDED : ErrorCodes.INTERNAL_ERROR);

    console.error(`[${errorCode}] [ID: ${req.id}] ${statusCode} - ${err.message}`, err.stack);

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
