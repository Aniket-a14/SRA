import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src');

/**
 * BYOK invariant: the platform's GEMINI_API_KEY funds embeddings and nothing else.
 *
 * Every other AI call — generation, the Layer-2 validation gate, auto-fix, alignment,
 * surgical refinement, feature expansion, diagram repair, graph extraction, RAG eval —
 * runs on the user's own key. These are structural assertions rather than behavioural
 * ones because the failure mode they guard against is silent: a call that quietly falls
 * back to the shared platform client still works, it just bills the wrong account.
 */
describe('BYOK: platform key funds embeddings only', () => {
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return walk(full);
        return entry.name.endsWith('.js') ? [full] : [];
    });

    it('imports the shared platform Gemini client in embeddings and the adapter only', () => {
        const importers = walk(SRC)
            .filter((file) => /from\s+['"].*config\/gemini\.js['"]/.test(fs.readFileSync(file, 'utf8')))
            .map((file) => path.relative(SRC, file).replace(/\\/g, '/'))
            .sort();

        // GeminiAdapter keeps it purely as the MOCK_AI fallback when no key is supplied.
        expect(importers).toEqual([
            'services/knowledge/embeddingService.js',
            'services/providers/GeminiAdapter.js'
        ]);
    });

    it('routes every analyzeText caller through the user key helper', () => {
        const offenders = walk(SRC)
            .filter((file) => !file.endsWith('aiService.js'))
            .filter((file) => {
                const source = fs.readFileSync(file, 'utf8');
                return /\banalyzeText\s*\(/.test(source) && !/asAiSettings\s*\(/.test(source);
            })
            .map((file) => path.relative(SRC, file).replace(/\\/g, '/'));

        expect(offenders).toEqual([]);
    });
});

describe('BYOK: graph extraction', () => {
    const originalMock = process.env.MOCK_AI;
    const originalKey = process.env.GEMINI_API_KEY;

    beforeEach(() => {
        // Turning MOCK_AI off is the point of this test — it exercises the real BYOK path.
        // But that also re-arms config/gemini.js's module-load guard, which throws when no
        // GEMINI_API_KEY is set outside mock mode. A placeholder satisfies the guard so the
        // import succeeds; the test asserts no call is made, so the value is never used.
        // Without it the test passes only on a machine that happens to have a local .env,
        // and fails in CI.
        process.env.MOCK_AI = 'false';
        if (!process.env.GEMINI_API_KEY) process.env.GEMINI_API_KEY = 'test-placeholder-not-a-real-key';
    });

    afterEach(() => {
        process.env.MOCK_AI = originalMock;
        if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
        else process.env.GEMINI_API_KEY = originalKey;
    });

    it('skips extraction rather than falling back to the platform key', async () => {
        jest.resetModules();
        const warn = jest.fn();
        jest.unstable_mockModule('../../src/config/logger.js', () => ({
            default: { warn, info: jest.fn(), error: jest.fn(), debug: jest.fn() }
        }));
        jest.unstable_mockModule('../../src/config/prisma.js', () => ({ default: {} }));

        const { extractGraph } = await import('../../src/services/knowledge/graphService.js');

        // No providerConfig => nothing to charge the call to => no call at all.
        await extractGraph('some requirements text', 'project-1');

        expect(warn).toHaveBeenCalledWith(expect.stringMatching(/Skipping Graph Extraction/));
    });
});
