import { describe, test, expect } from '@jest/globals';
import { extractTerms, findEvidence, buildDigest } from '../src/lib/scanner.js';

const scanFixture = (files) => ({
    root: 'demo',
    cwd: '/demo',
    fileCount: files.size,
    sourceFileCount: files.size,
    scannedFileCount: files.size,
    truncated: false,
    languages: { TypeScript: files.size },
    manifests: [],
    directories: [],
    routes: [],
    models: [],
    exportsByFile: new Map(),
    fileContents: files,
    files: [...files.keys()]
});

describe('extractTerms', () => {
    test('drops requirement boilerplate that matches everything', () => {
        const terms = extractTerms('The system shall allow the user to reset their password.');
        expect(terms).toContain('reset');
        expect(terms).toContain('password');
        expect(terms).not.toContain('system');
        expect(terms).not.toContain('shall');
        expect(terms).not.toContain('user');
    });

    test('splits camelCase so identifiers match prose', () => {
        expect(extractTerms('resetPassword handler')).toEqual(expect.arrayContaining(['reset', 'password']));
    });

    test('returns nothing for empty or boilerplate-only input', () => {
        expect(extractTerms('')).toEqual([]);
        expect(extractTerms(null)).toEqual([]);
        expect(extractTerms('The system shall')).toEqual([]);
    });
});

describe('findEvidence', () => {
    test('ranks a file whose path and body both match above one that only mentions a term', () => {
        const scan = scanFixture(new Map([
            ['src/auth/password-reset.ts', 'export function resetPassword() { sendResetEmail() }'],
            ['src/docs/notes.ts', '// we should probably add a password thing one day'],
            ['src/billing/invoice.ts', 'export function createInvoice() {}']
        ]));

        const evidence = findEvidence(scan, 'The system shall allow the user to reset their password.');

        expect(evidence[0].file).toBe('src/auth/password-reset.ts');
        expect(evidence.map(e => e.file)).not.toContain('src/billing/invoice.ts');
    });

    test('returns nothing when no distinctive term appears anywhere', () => {
        const scan = scanFixture(new Map([['src/a.ts', 'const x = 1']]));
        expect(findEvidence(scan, 'The system shall reticulate splines.')).toEqual([]);
    });

    test('honours the result limit', () => {
        const files = new Map();
        for (let i = 0; i < 10; i++) files.set(`src/checkout-${i}.ts`, 'checkout checkout checkout');
        expect(findEvidence(scanFixture(files), 'checkout flow', { limit: 3 })).toHaveLength(3);
    });
});

describe('buildDigest', () => {
    const richScan = {
        ...scanFixture(new Map()),
        manifests: [{ file: 'package.json', name: 'demo', description: 'A demo app', scripts: ['dev'], dependencies: ['express'] }],
        directories: [{ dir: 'src/api', count: 12 }],
        routes: [{ signature: 'GET /health', file: 'src/api/health.ts' }],
        models: ['User', 'Invoice'],
        exportsByFile: new Map([['src/api/health.ts', ['healthCheck']]])
    };

    test('includes the structural facts a spec is written against', () => {
        const digest = buildDigest(richScan);

        expect(digest).toContain('# Codebase: demo');
        expect(digest).toContain('GET /health');
        expect(digest).toContain('User, Invoice');
        expect(digest).toContain('healthCheck');
        expect(digest).toContain('express');
    });

    test('carries maintainer notes the code cannot convey', () => {
        expect(buildDigest(richScan, { notes: 'Internal tool for the finance team.' }))
            .toContain('Internal tool for the finance team.');
    });

    test('never exceeds the budget, because the platform rejects oversized input outright', () => {
        const huge = {
            ...richScan,
            routes: Array.from({ length: 5000 }, (_, i) => ({ signature: `GET /route-${i}`, file: `src/r${i}.ts` })),
            exportsByFile: new Map(Array.from({ length: 5000 }, (_, i) => [`src/m${i}.ts`, ['aVeryLongExportedSymbolName']]))
        };

        const digest = buildDigest(huge, { budget: 4000 });
        expect(digest.length).toBeLessThanOrEqual(4000);
        // The header always survives — a digest without it is not usable input.
        expect(digest).toContain('# Codebase: demo');
    });
});
