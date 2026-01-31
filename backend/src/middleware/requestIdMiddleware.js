import { v4 as uuidv4 } from 'uuid';

/**
 * Middleware to attach a unique Request ID to each request.
 * The ID is added to req.id and sent back in the X-Request-Id response header.
 */
export const requestIdMiddleware = (req, res, next) => {
    const requestId = req.get('X-Request-Id') || uuidv4();
    req.id = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
};
