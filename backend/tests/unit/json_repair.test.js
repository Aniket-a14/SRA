import { describe, it, expect } from '@jest/globals';
import { repairAndParseJSON, extractJsonBody, balanceTruncation } from '../../src/utils/jsonRepair.js';

// This suite used to assert against a COPY of the repair logic pasted into the test file,
// so it stayed green while the real parser in aiService failed in production. It now
// exercises the shipped module that both BaseAgent and aiService call.
describe('repairAndParseJSON', () => {
    it('passes clean JSON straight through', () => {
        expect(repairAndParseJSON('{"key": "value"}')).toEqual({ key: 'value' });
    });

    it('strips markdown fences', () => {
        expect(repairAndParseJSON('```json\n{"key": "value"}\n```')).toEqual({ key: 'value' });
    });

    it('ignores prose surrounding the JSON body', () => {
        expect(repairAndParseJSON('Sure! Here is the result:\n{"key": "value"}\nHope that helps.')).toEqual({ key: 'value' });
    });

    it('strips line and block comments', () => {
        expect(repairAndParseJSON('{\n "key": "value", // note\n "n": 1\n}')).toEqual({ key: 'value', n: 1 });
        expect(repairAndParseJSON('{\n "key": "value" /* note */\n}')).toEqual({ key: 'value' });
    });

    it('removes trailing commas in objects and arrays', () => {
        expect(repairAndParseJSON('{"key": "value", }')).toEqual({ key: 'value' });
        expect(repairAndParseJSON('{"list": [1, 2, ]}')).toEqual({ list: [1, 2] });
    });

    it('escapes lone backslashes that are not valid JSON escapes', () => {
        expect(repairAndParseJSON('{"path": "C:\\Program Files"}')).toEqual({ path: 'C:\\Program Files' });
    });

    it('recovers unquoted and single-quoted keys via jsonrepair', () => {
        // Exactly the class of failure that killed a live validation-gate run:
        // "Expected double-quoted property name in JSON at position 240".
        expect(repairAndParseJSON("{validation_status: 'PASS', issues: []}")).toEqual({ validation_status: 'PASS', issues: [] });
    });

    it('closes a truncated response, innermost structure first', () => {
        const truncated = '{"issues": [{"id": "a", "severity": "critical"';
        expect(repairAndParseJSON(truncated)).toEqual({ issues: [{ id: 'a', severity: 'critical' }] });
    });

    it('repairs a missing colon between key and value', () => {
        expect(repairAndParseJSON('{"key" "value"}')).toEqual({ key: 'value' });
    });

    it('parses a bare top-level array', () => {
        expect(repairAndParseJSON('["Gap A", "Gap B"]')).toEqual(['Gap A', 'Gap B']);
    });

    it('throws when the payload is not recoverable as JSON', () => {
        expect(() => repairAndParseJSON('I cannot help with that request.')).toThrow();
    });
});

describe('extractJsonBody', () => {
    it('prefers an object body over a stray array', () => {
        expect(extractJsonBody('noise {"a": [1,2]} noise')).toBe('{"a": [1,2]}');
    });

    it('falls back to an array body when there is no object', () => {
        expect(extractJsonBody('here: [1,2] done')).toBe('[1,2]');
    });
});

describe('balanceTruncation', () => {
    it('reports a balanced payload as untruncated', () => {
        const out = balanceTruncation('{"a": [1]}');
        expect(out.truncated).toBe(false);
        expect(out.text).toBe('{"a": [1]}');
    });

    it('closes brackets before braces so the array stays nested', () => {
        const out = balanceTruncation('{"a": [1');
        expect(out).toMatchObject({ truncated: true, missingBraces: 1, missingBrackets: 1 });
        expect(JSON.parse(out.text)).toEqual({ a: [1] });
    });
});
