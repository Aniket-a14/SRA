import { describe, it, expect } from '@jest/globals';
import { sanitizePII, sanitizeObject } from '../../src/utils/sanitizer.js';

describe('sanitizePII — IPv4 vs version strings', () => {
    it('redacts a real IP address', () => {
        expect(sanitizePII('Server at 192.168.1.1')).toBe('Server at [IP_REDACTED]');
    });

    it('leaves a version string with a preceding version-ish word alone', () => {
        expect(sanitizePII('version 2.0.0.1')).toBe('version 2.0.0.1');
        expect(sanitizePII('v2.0.0.1')).toBe('v2.0.0.1');
        expect(sanitizePII('build 2.0.0.1')).toBe('build 2.0.0.1');
        expect(sanitizePII('release 1.2.3.4')).toBe('release 1.2.3.4');
    });
});

describe('sanitizeObject', () => {
    it('sanitizes a top-level string', () => {
        expect(sanitizeObject('Contact: user@example.com')).toBe('Contact: [EMAIL_REDACTED]');
    });

    it('sanitizes primitive strings inside arrays', () => {
        expect(sanitizeObject(['user@example.com', 'no pii here'])).toEqual([
            '[EMAIL_REDACTED]',
            'no pii here'
        ]);
    });

    it('sanitizes strings nested in objects within arrays', () => {
        expect(sanitizeObject([{ note: 'user@example.com' }])).toEqual([
            { note: '[EMAIL_REDACTED]' }
        ]);
    });

    it('redacts rather than returns unsanitized data past the depth limit', () => {
        // Build a structure 25 levels deep with an email at the bottom.
        let deep = { email: 'user@example.com' };
        for (let i = 0; i < 25; i++) {
            deep = { child: deep };
        }
        const result = sanitizeObject(deep);
        const serialized = JSON.stringify(result);
        expect(serialized).not.toContain('user@example.com');
    });

    it('leaves shallow structures fully sanitized', () => {
        const result = sanitizeObject({ a: { b: { c: 'user@example.com' } } });
        expect(result.a.b.c).toBe('[EMAIL_REDACTED]');
    });
});
