import { ZodError } from 'zod';
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
        // Only a ZodError is a validation failure; anything else is a bug and goes to the
        // error handler. `.issues` is the array zod 3 also exposed as `.errors`; zod 4 removed
        // that alias, which would have left every 400 without its `details` (the web app and
        // the published CLI both read them).
        if (!(error instanceof ZodError)) return next(error);
        logger.error({ msg: 'Validation Error', errors: error.issues });
        return res.status(400).json({
            error: 'Validation Error',
            details: error.issues,
        });
    }
};
