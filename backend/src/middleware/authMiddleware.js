import { verifyToken } from '../config/jwt.js';

export const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        const error = new Error('Unauthorized access');
        error.statusCode = 401;
        return next(error);
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded) {
        const error = new Error('Invalid or expired token');
        error.statusCode = 401;
        return next(error);
    }

    req.user = decoded; // { userId, email }
    next();
};
