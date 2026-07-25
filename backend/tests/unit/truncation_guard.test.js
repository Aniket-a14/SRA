import { describe, it, expect } from '@jest/globals';
import { assertNotTruncated, TruncatedOutputError } from '../../src/utils/truncationError.js';
import { repairAndParseJSON } from '../../src/utils/jsonRepair.js';

describe('assertNotTruncated', () => {
    it('throws on the Gemini MAX_TOKENS finish reason', () => {
        expect(() => assertNotTruncated('MAX_TOKENS', { provider: 'Gemini', maxOutputTokens: 20000 }))
            .toThrow(TruncatedOutputError);
    });

    it('throws on the OpenAI/Grok "length" finish reason', () => {
        expect(() => assertNotTruncated('length', { provider: 'OpenAI', maxOutputTokens: 4096 }))
            .toThrow(TruncatedOutputError);
    });

    it('throws on the Claude max_tokens stop reason', () => {
        expect(() => assertNotTruncated('max_tokens', { provider: 'Claude', maxOutputTokens: 4096 }))
            .toThrow(TruncatedOutputError);
    });

    it('allows a normal completion through', () => {
        expect(() => assertNotTruncated('STOP', { provider: 'Gemini' })).not.toThrow();
        expect(() => assertNotTruncated('stop', { provider: 'OpenAI' })).not.toThrow();
        expect(() => assertNotTruncated('end_turn', { provider: 'Claude' })).not.toThrow();
        expect(() => assertNotTruncated(undefined, { provider: 'Gemini' })).not.toThrow();
    });

    it('explains why the payload was not auto-repaired', () => {
        const error = (() => {
            try { assertNotTruncated('MAX_TOKENS', { provider: 'Gemini', maxOutputTokens: 20000 }); }
            catch (e) { return e; }
        })();

        expect(error.message).toMatch(/20000/);
        expect(error.message).toMatch(/NOT auto-repaired/);
        expect(error.truncated).toBe(true);
    });
});

describe('the data loss this guard prevents', () => {
    it('demonstrates that balancing a truncated array yields valid JSON with items missing', () => {
        // This is what reached production: a requirements array cut mid-flight. The repair
        // pipeline closes the brackets and the result parses cleanly — with fewer
        // requirements than the model actually wrote, and nothing downstream can tell.
        const truncated = '{"requirements":[{"id":"FR-1","text":"one"},{"id":"FR-2","text":"two"},{"id":"FR-3"';

        const repaired = repairAndParseJSON(truncated, { label: 'test' });

        expect(Array.isArray(repaired.requirements)).toBe(true);
        // Parsed happily, but FR-3 lost its text and any later requirement is simply gone.
        expect(repaired.requirements.length).toBeLessThan(4);
        // A schema expecting "an array of requirements" still accepts this, which is
        // precisely why truncation has to be caught upstream at the adapter.
    });
});
