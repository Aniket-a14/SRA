/**
 * Standard API response utility for consistency across the backend.
 */

export const successResponse = (res, data = {}, message = 'Success', status = 200) => {
    return res.status(status).json({
        success: true,
        message,
        data
    });
};

/**
 * `data` is optional (omitted entirely rather than sent as `undefined`) since most callers
 * have no extra diagnostic payload beyond the message/errorCode — see healthRoutes.js for
 * the one caller that does (readiness/liveness probes returning per-service status).
 */
export const errorResponse = (res, message = 'Error', status = 500, errorCode = 'INTERNAL_ERROR', data = undefined) => {
    return res.status(status).json({
        success: false,
        message,
        errorCode,
        ...(data !== undefined ? { data } : {})
    });
};
