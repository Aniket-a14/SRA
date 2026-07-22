import logger from '../config/logger.js';

export const validate = (schema) => (req, res, next) => {
    try {
        const parsed = schema.parse({
            body: req.body,
            query: req.query,
            params: req.params,
        });
        // Write the parsed body back — schemas without .passthrough() strip any key not
        // explicitly whitelisted (e.g. updateAnalysisSchema), so this needs to actually
        // replace req.body for that whitelisting to have any effect downstream.
        if (parsed.body !== undefined) {
            req.body = parsed.body;
        }
        next();
    } catch (error) {
        logger.error({ msg: 'Validation Error', errors: error.errors });
        return res.status(400).json({
            error: 'Validation Error',
            details: error.errors,
        });
    }
};
