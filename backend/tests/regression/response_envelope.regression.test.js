import { describe, it, expect, jest } from '@jest/globals';
import { successResponse, errorResponse } from '../../src/utils/response.js';

/**
 * Regression guard for the response-envelope contract.
 *
 * Bug: the backend wraps every payload in { success, message, data } via
 * successResponse(). Several frontend call sites consumed `await res.json()`
 * directly instead of unwrapping `.data`, so they operated on the envelope —
 * version-timeline set history to `{success,message,data}` (crashing `.map`),
 * the compare page diffed the envelope keys, and diagram-editor read
 * `json.code` (undefined) instead of `json.data.code`, silently discarding
 * auto-repaired diagrams.
 *
 * These tests pin the envelope shape so any change to it is a conscious,
 * reviewed decision — the frontend depends on `.data` being where the payload lives.
 */
function mockRes() {
    return {
        statusCode: null,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; }
    };
}

describe('response envelope contract (regression)', () => {
    it('successResponse always nests the payload under .data', () => {
        const res = mockRes();
        const payload = [{ id: 'v1' }, { id: 'v2' }];
        successResponse(res, payload);

        expect(res.body).toEqual({ success: true, message: 'Success', data: payload });
        // The frontend fetcher does `json.data || json` — .data must be the array itself.
        expect(res.body.data).toBe(payload);
        expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('a single-object payload is reachable at .data (diagram-repair path)', () => {
        const res = mockRes();
        successResponse(res, { code: 'graph TD; A-->B' });
        // diagram-editor must read res.body.data.code, not res.body.code.
        expect(res.body.code).toBeUndefined();
        expect(res.body.data.code).toBe('graph TD; A-->B');
    });

    it('errorResponse never carries a data field and flags success:false', () => {
        const res = mockRes();
        errorResponse(res, 'Analysis not found', 404, 'NOT_FOUND');
        expect(res.statusCode).toBe(404);
        expect(res.body.success).toBe(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errorCode).toBe('NOT_FOUND');
    });

    it('honors a custom status code on success', () => {
        const res = mockRes();
        successResponse(res, {}, 'Created', 201);
        expect(res.statusCode).toBe(201);
    });
});

describe('unwrap helper parity (regression)', () => {
    // Mirrors the exact `json.data ?? json` / `json.data || json` idiom the fixed
    // frontend components now use, so the contract is exercised from the consumer side too.
    const unwrap = (json) => json?.data ?? json;

    it('unwraps an enveloped array to the array', () => {
        const enveloped = { success: true, message: 'Success', data: [1, 2, 3] };
        expect(unwrap(enveloped)).toEqual([1, 2, 3]);
    });

    it('passes a bare (non-enveloped) payload through unchanged', () => {
        expect(unwrap([1, 2, 3])).toEqual([1, 2, 3]);
    });

    it('produces something .map-able for the version timeline', () => {
        const enveloped = { success: true, message: 'Success', data: [{ id: 'a' }] };
        const history = Array.isArray(unwrap(enveloped)) ? unwrap(enveloped) : [];
        expect(() => history.map((h) => h.id)).not.toThrow();
    });
});
