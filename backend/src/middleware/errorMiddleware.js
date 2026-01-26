export const errorHandler = (err, req, res, next) => {
    console.error(`[Error] ${err.message}`, err.stack);

    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Set headers if available (e.g., for Retry-After)
    if (err.retryAfter) {
        res.set('Retry-After', String(err.retryAfter));
    }

    res.status(statusCode).json({
        error: message,
        code: err.code || (statusCode === 429 ? "QUOTA_EXCEEDED" : "INTERNAL_ERROR"),
        retryAfter: err.retryAfter,
        details: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
};
