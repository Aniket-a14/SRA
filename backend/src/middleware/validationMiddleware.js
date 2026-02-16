export const validate = (schema) => (req, res, next) => {
    try {
        schema.parse({
            body: req.body,
            query: req.query,
            params: req.params,
        });
        next();
    } catch (error) {
        console.error("[Validation Middleware] Error:", JSON.stringify(error.errors, null, 2));
        return res.status(400).json({
            error: 'Validation Error',
            details: error.errors,
        });
    }
};
