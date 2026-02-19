import logger from '../config/logger.js';

export const validate = (schema) => (req, res, next) => {
    try {
        schema.parse({
            body: req.body,
            query: req.query,
            params: req.params,
        });
        next();
    } catch (error) {
        logger.error({ msg: 'Validation Error', errors: error.errors });
        return res.status(400).json({
            error: 'Validation Error',
            details: error.errors,
        });
    }
};
