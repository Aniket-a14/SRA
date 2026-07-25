import { describe, it, expect } from '@jest/globals';
import { normalizeVerificationMethod, normalizeFormatDoc } from '../../src/formats/normalize.js';
import { buildFormatSchema, VERIFICATION_METHODS } from '../../src/formats/schemaBuilder.js';
import { getFormat } from '../../src/formats/index.js';

describe('normalizeVerificationMethod', () => {
    it('accepts the canonical four regardless of casing', () => {
        expect(normalizeVerificationMethod('test')).toBe('Test');
        expect(normalizeVerificationMethod('INSPECTION')).toBe('Inspection');
        expect(normalizeVerificationMethod('Demonstration')).toBe('Demonstration');
    });

    it('resolves the spellings a model actually emits', () => {
        expect(normalizeVerificationMethod('Testing')).toBe('Test');
        expect(normalizeVerificationMethod('demo')).toBe('Demonstration');
        expect(normalizeVerificationMethod('review')).toBe('Inspection');
        expect(normalizeVerificationMethod('simulation')).toBe('Analysis');
    });

    it('takes the primary method from a compound answer', () => {
        expect(normalizeVerificationMethod('Test/Demonstration')).toBe('Test');
        expect(normalizeVerificationMethod('by inspection')).toBe('Inspection');
    });

    it('marks an unusable value TBD rather than inventing rigour', () => {
        // Coercing a missing method to "Test" would overstate what the document actually
        // commits to verifying.
        expect(normalizeVerificationMethod('')).toBe('TBD');
        expect(normalizeVerificationMethod(undefined)).toBe('TBD');
        expect(normalizeVerificationMethod('somehow')).toBe('TBD');
    });
});

describe('normalizeFormatDoc', () => {
    const spec = getFormat('iso29148');

    it('canonicalises methods inside a feature-list section', () => {
        const doc = normalizeFormatDoc({
            systemFunctions: [{
                name: 'Auth',
                functionalRequirements: [
                    { description: 'A', verificationMethod: 'testing' },
                    { description: 'B', verificationMethod: '' }
                ]
            }]
        }, spec);

        expect(doc.systemFunctions[0].functionalRequirements.map(r => r.verificationMethod))
            .toEqual(['Test', 'TBD']);
    });

    it('leaves formats without the attribute untouched', () => {
        const volere = getFormat('volere');
        const input = { functionalRequirements: [{ description: 'A', fitCriterion: 'measurable' }] };
        expect(normalizeFormatDoc(input, volere)).toEqual(input);
    });

    it('does not disturb other requirement fields', () => {
        const doc = normalizeFormatDoc({
            systemFunctions: [{
                name: 'Auth',
                functionalRequirements: [{ id: 'X-1', description: 'A', rationale: 'why', verificationMethod: 'demo', source: 'S' }]
            }]
        }, spec);

        expect(doc.systemFunctions[0].functionalRequirements[0])
            .toEqual({ id: 'X-1', description: 'A', rationale: 'why', verificationMethod: 'Demonstration', source: 'S' });
    });

    it('survives missing or malformed sections', () => {
        expect(normalizeFormatDoc({}, spec)).toEqual({});
        expect(normalizeFormatDoc({ systemFunctions: null }, spec)).toEqual({ systemFunctions: null });
        expect(normalizeFormatDoc(null, spec)).toBeNull();
    });
});

describe('generateFormatDoc integration', () => {
    it('normalises the assembled document, not just in isolation', async () => {
        const { generateFormatDoc } = await import('../../src/services/pipeline/formatGenerator.js');
        const spec = getFormat('iso29148');

        // Stub the agent: return one chunk's worth of realistically-messy model output.
        const devAgent = {
            generateFormatChunk: async () => ({
                systemFunctions: [{
                    name: 'Authentication',
                    functionalRequirements: [
                        { description: 'The system shall lock an account after five failed attempts.', verificationMethod: 'testing' },
                        { description: 'The system shall display the privacy notice.', verificationMethod: 'by inspection' },
                        { description: 'The system shall sustain 500 sessions.', verificationMethod: 'not sure' }
                    ]
                }]
            })
        };

        const doc = await generateFormatDoc({
            spec, text: 'raw', poOutput: {}, archOutput: {}, devAgent,
            projectName: 'Fleet Telemetry Portal', promptVersion: 'latest', ragContext: '',
            sleep: async () => {}, emitProgress: () => {}, cooldownMs: 0
        });

        expect(doc.systemFunctions[0].functionalRequirements.map(r => r.verificationMethod))
            .toEqual(['Test', 'Inspection', 'TBD']);
        expect(doc.formatId).toBe('iso29148');
    });
});

describe('ISO 29148 requirement schema', () => {
    it('carries the attribute set, keyed on description so existing consumers still read it', () => {
        const schema = buildFormatSchema(getFormat('iso29148'), ['systemFunctions']);
        const req = schema.properties.systemFunctions.items.properties.functionalRequirements.items;

        expect(Object.keys(req.properties).sort())
            .toEqual(['description', 'id', 'rationale', 'source', 'verificationMethod']);
        expect(req.required).toContain('verificationMethod');
        expect(req.required).toContain('description');
    });

    it('leaves IEEE 830 requirements as plain strings', () => {
        const schema = buildFormatSchema(getFormat('ieee830'), ['systemFeatures']);
        const req = schema.properties.systemFeatures.items.properties.functionalRequirements.items;
        expect(req.properties).toBeUndefined();
    });

    it('exposes exactly the four methods the normaliser targets', () => {
        expect(VERIFICATION_METHODS).toEqual(['Inspection', 'Analysis', 'Demonstration', 'Test']);
    });
});
