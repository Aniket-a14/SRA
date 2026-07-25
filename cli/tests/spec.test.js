import { describe, test, expect } from '@jest/globals';
import { extractFeatures, mergeLocalState, normalizeRequirement, reqToString } from '../src/lib/spec.js';

const ieeeDescriptor = {
    id: 'ieee830',
    name: 'IEEE 830-1998',
    sections: [
        { id: 'introduction', number: '1', title: 'Introduction', kind: 'group' },
        { id: 'systemFeatures', number: '4', title: 'System Features', kind: 'feature-list' },
        { id: 'appendices', number: 'A', title: 'Appendices', kind: 'glossary', appendix: true }
    ]
};

const agileDescriptor = {
    id: 'agile-prd',
    name: 'Agile PRD',
    sections: [
        { id: 'problemStatement', number: '1', title: 'Problem', kind: 'prose' },
        { id: 'userStories', number: '3', title: 'User Stories', kind: 'user-stories' }
    ]
};

const volereDescriptor = {
    id: 'volere',
    name: 'Volere',
    sections: [
        { id: 'functionalRequirements', number: '9', title: 'Functional Requirements', kind: 'requirement-group' },
        { id: 'lookAndFeel', number: '10', title: 'Look and Feel', kind: 'requirement-group' }
    ]
};

describe('reqToString', () => {
    test('passes strings through', () => {
        expect(reqToString('The system shall log in users.')).toBe('The system shall log in users.');
    });

    test('renders a user story object as prose', () => {
        expect(reqToString({ role: 'admin', action: 'revoke a session', benefit: 'access is contained' }))
            .toBe('As a admin, I want revoke a session, so that access is contained.');
    });

    test('prefers an explicit description on a Volere shell', () => {
        expect(reqToString({ id: 'FR-1', description: 'Encrypt data at rest.', fitCriterion: 'AES-256' }))
            .toBe('Encrypt data at rest.');
    });
});

describe('normalizeRequirement', () => {
    test('reuses an id embedded in the requirement text', () => {
        const req = normalizeRequirement('SRA-FR-1.2: The system shall queue jobs.');
        expect(req.id).toBe('SRA-FR-1.2');
        expect(req.metadata.verification_status).toBe('DRAFT_AI');
    });

    test('preserves an existing decision', () => {
        const req = normalizeRequirement({
            id: 'FR-9',
            description: 'Rotate keys.',
            metadata: { verification_status: 'APPROVED_HUMAN', verifiedBy: 'ada' }
        });
        expect(req.metadata).toEqual({ verification_status: 'APPROVED_HUMAN', verifiedBy: 'ada' });
    });
});

describe('extractFeatures with a format descriptor', () => {
    test('reads IEEE features and records where they came from', () => {
        const features = extractFeatures({
            systemFeatures: [
                { name: 'Authentication', description: 'Sign in.', functionalRequirements: ['Users shall sign in.'] },
                { name: 'Billing', functionalRequirements: ['Charge cards.', 'Refund cards.'] }
            ]
        }, ieeeDescriptor);

        expect(features).toHaveLength(2);
        expect(features[0].name).toBe('Authentication');
        expect(features[0].source).toEqual({ section: 'systemFeatures', index: 0, kind: 'feature-list' });
        expect(features[1].source.index).toBe(1);
        // Bare IEEE strings gain the object form `review` needs to record a decision against.
        expect(features[1].functionalRequirements.map(r => r.description))
            .toEqual(['Charge cards.', 'Refund cards.']);
        expect(features[1].functionalRequirements[0].metadata.verification_status).toBe('DRAFT_AI');
    });

    test('keeps every attribute of a structured requirement through extraction', () => {
        // Extraction used to stringify these, so `push` wrote plain text back over the
        // platform's objects and each requirement lost its rationale, fit criterion, source
        // and verification method.
        const features = extractFeatures({
            systemFunctions: [{
                name: 'Authentication',
                functionalRequirements: [{
                    id: 'FTP-REQ-001',
                    description: 'The system shall lock an account after five failed attempts.',
                    rationale: 'Limits credential stuffing.',
                    verificationMethod: 'Test',
                    source: 'Security review, 2026-03-02'
                }]
            }]
        }, {
            id: 'iso29148',
            name: 'ISO/IEC/IEEE 29148:2018',
            sections: [{ id: 'systemFunctions', number: '4', title: 'System Functions', kind: 'feature-list' }]
        });

        const req = features[0].functionalRequirements[0];
        expect(req.id).toBe('FTP-REQ-001');
        expect(req.rationale).toBe('Limits credential stuffing.');
        expect(req.verificationMethod).toBe('Test');
        expect(req.source).toBe('Security review, 2026-03-02');
        expect(req.metadata.verification_status).toBe('DRAFT_AI');
    });

    test('reads Agile user stories as one group tied to userStories', () => {
        const features = extractFeatures({
            userStories: [
                { role: 'developer', action: 'sync a spec', benefit: 'my repo matches the doc' },
                { role: 'lead', action: 'see coverage', benefit: 'I can plan work' }
            ]
        }, agileDescriptor);

        expect(features).toHaveLength(1);
        expect(features[0].source).toEqual({ section: 'userStories', index: null, kind: 'user-stories' });
        expect(features[0].functionalRequirements).toHaveLength(2);
        // Nothing may be attributed to a section this format does not define.
        expect(features.some(f => f.source.section === 'systemFeatures')).toBe(false);
    });

    test('reads each Volere requirement group as its own entry', () => {
        const features = extractFeatures({
            functionalRequirements: [{ id: 'FR-1', description: 'Store analyses.' }],
            lookAndFeel: [{ id: 'LF-1', description: 'Match the brand palette.' }]
        }, volereDescriptor);

        expect(features.map(f => f.source.section)).toEqual(['functionalRequirements', 'lookAndFeel']);
        expect(features.every(f => f.source.kind === 'requirement-group')).toBe(true);
    });

    test('skips appendices', () => {
        const features = extractFeatures({
            systemFeatures: [{ name: 'A', functionalRequirements: ['x'] }],
            appendices: [{ name: 'Glossary', functionalRequirements: ['not a requirement'] }]
        }, ieeeDescriptor);

        expect(features).toHaveLength(1);
    });

    test('falls back to shape detection when the document does not match its descriptor', () => {
        // A document generated before a format change: claims Agile, holds IEEE features.
        const features = extractFeatures({
            systemFeatures: [{ name: 'Legacy', functionalRequirements: ['Still works.'] }]
        }, agileDescriptor);

        expect(features).toHaveLength(1);
        expect(features[0].name).toBe('Legacy');
    });
});

describe('extractFeatures without a descriptor', () => {
    test('detects feature-shaped arrays under any key', () => {
        const features = extractFeatures({
            systemFunctions: [{ name: 'Ingest', functionalRequirements: ['Accept uploads.'] }]
        });

        expect(features).toHaveLength(1);
        expect(features[0].source.section).toBe('systemFunctions');
    });

    test('returns nothing for a document with no requirements', () => {
        expect(extractFeatures({ introduction: { purpose: 'x' } })).toEqual([]);
    });

    test('tolerates a missing document', () => {
        expect(extractFeatures(null)).toEqual([]);
        expect(extractFeatures(undefined)).toEqual([]);
    });
});

describe('mergeLocalState', () => {
    const fresh = [{
        id: 'FEAT-NEW',
        name: 'Authentication',
        description: 'Sign in.',
        functionalRequirements: ['Users shall sign in.', 'Users shall sign out.'],
        status: 'pending',
        verification_files: [],
        source: { section: 'systemFeatures', index: 0, kind: 'feature-list' }
    }];

    test('carries verification files and status across a re-sync', () => {
        const merged = mergeLocalState(fresh, [{
            name: 'Authentication',
            verification_files: ['src/auth.ts'],
            status: 'verified',
            functionalRequirements: []
        }]);

        expect(merged[0].verification_files).toEqual(['src/auth.ts']);
        expect(merged[0].status).toBe('verified');
    });

    test('carries review decisions matched on requirement text, not on id', () => {
        const merged = mergeLocalState(fresh, [{
            name: 'Authentication',
            verification_files: [],
            functionalRequirements: [{
                id: 'SOME-OTHER-ID',
                description: 'Users shall sign in.',
                metadata: { verification_status: 'APPROVED_HUMAN', verifiedBy: 'ada' }
            }]
        }]);

        expect(merged[0].functionalRequirements[0].metadata.verification_status).toBe('APPROVED_HUMAN');
        // The undecided requirement stays exactly as the platform sent it.
        expect(merged[0].functionalRequirements[1]).toBe('Users shall sign out.');
    });

    test('takes requirement text from the platform, not from disk', () => {
        const merged = mergeLocalState(fresh, [{
            name: 'Authentication',
            functionalRequirements: [{ description: 'A stale local edit.', metadata: {} }]
        }]);

        expect(merged[0].functionalRequirements).toContain('Users shall sign in.');
        expect(JSON.stringify(merged)).not.toContain('A stale local edit.');
    });

    test('leaves entries with no prior counterpart untouched', () => {
        expect(mergeLocalState(fresh, [])).toEqual(fresh);
    });
});
