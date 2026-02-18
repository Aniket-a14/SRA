import { verifyToken } from '../config/jwt.js';
import { verifyApiKey } from '../services/apiKeyService.js';

export const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        const error = new Error('Unauthorized access');
        error.statusCode = 401;
        return next(error);
    }

    const token = authHeader.split(' ')[1];
    if (token.startsWith('sra_live_')) {
        // API Key Auth
        try {
            const user = await verifyApiKey(token);
            if (!user) throw new Error('Invalid API Key');
            req.user = { userId: user.id, email: user.email }; // Minimal user context
            return next();
        } catch (e) {
            const error = new Error('Invalid or revoked API Key');
            error.statusCode = 401;
            return next(error);
        }
    }

    // JWT Auth
    const decoded = verifyToken(token);

    if (!decoded) {
        const error = new Error('Invalid or expired token');
        error.statusCode = 401;
        return next(error);
    }

    req.user = decoded; // { userId, email }
    next();
};
