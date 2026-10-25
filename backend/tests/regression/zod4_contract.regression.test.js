import { jest, describe, it, expect } from '@jest/globals';

/**
 * zod 3 -> 4 kept the request-validation contract intact:
 * - 400 responses still carry `details` as an array of issues (zod 4 removed the `.errors`
 *   alias the middleware read; `details` would have silently vanished from every 400);
 * - ids keep zod 3's 8-4-4-4-12 hex acceptance (zod 4's `.uuid()` also demands RFC 9562
 *   version/variant bits, which would start rejecting ids that validated before);
 * - free-form `metadata` / `settings` records still accept arbitrary keys (single-argument
 *   `z.record()` no longer exists in zod 4);
 * - a non-validation error is passed on, not reported as a validation failure.
 */
const { validate } = await import('../../src/middleware/validationMiddleware.js');
const schemas = await import('../../src/utils/validationSchemas.js');

const run = (schema, req) => {
    const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
    const next = jest.fn();
    validate(schema)({ body: {}, query: {}, params: {}, ...req }, res, next);
    return { res, next };
};

describe('validation contract on zod 4', () => {
    it('returns details as a non-empty array of issues with path and message', () => {
        const { res, next } = run(schemas.idParamSchema, { params: { id: 'not-an-id' } });
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('Validation Error');
        expect(Array.isArray(res.body.details)).toBe(true);
        expect(res.body.details.length).toBeGreaterThan(0);
        expect(res.body.details[0]).toEqual(expect.objectContaining({ path: ['params', 'id'], message: 'Invalid analysis ID' }));
        expect(next).not.toHaveBeenCalled();
    });

    it.each([
        '11111111-1111-1111-1111-111111111111', // zod 3 accepted; zod 4 .uuid() would not
        '3f2504e0-4f89-41d3-9a0c-0305e82c3301', // RFC 4122 v4
        'A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11'
    ])('accepts id %s as zod 3 did', (id) => {
        const { res, next } = run(schemas.idParamSchema, { params: { id } });
        expect(res.statusCode).toBe(200);
        expect(next).toHaveBeenCalledWith();
    });

    it.each(['', 'abc', '11111111-1111-1111-1111-11111111111', '11111111x1111-1111-1111-111111111111'])(
        'still rejects malformed id %p', (id) => {
            expect(run(schemas.idParamSchema, { params: { id } }).res.statusCode).toBe(400);
        }
    );

    it('accepts free-form metadata records with arbitrary keys', () => {
        const id = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
        const { res, next } = run(schemas.updateAnalysisSchema, {
            params: { id },
            body: { metadata: { anything: 1, nested: { deep: [true] } } }
        });
        expect(res.statusCode).toBe(200);
        expect(next).toHaveBeenCalledWith();
    });

    it('forwards a non-zod error to the error handler instead of answering 400', () => {
        const boom = new Error('bug in a refinement');
        const exploding = { parse: () => { throw boom; } };
        const { res, next } = run(exploding, {});
        expect(next).toHaveBeenCalledWith(boom);
        expect(res.statusCode).toBe(200);
    });
});
