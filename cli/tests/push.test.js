import { jest, describe, test, expect, beforeEach, afterAll } from '@jest/globals';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const put = jest.fn();
const get = jest.fn();

jest.unstable_mockModule('../src/api/api-client.js', () => ({
    api: { get, put, post: jest.fn(), delete: jest.fn(), stream: jest.fn() },
    describeError: (error) => error?.message || 'error',
    statusOf: () => null,
    DEFAULT_BACKEND_URL: 'https://example.invalid'
}));

jest.unstable_mockModule('../src/config/config-manager.js', () => ({
    configManager: { load: async () => ({ analysisId: 'analysis-1' }) }
}));

const { push } = await import('../src/commands/push.js');

const originalCwd = process.cwd();
let workdir;

/** The local spec is read from disk for real — only the network is mocked. */
async function writeLocalSpec(spec) {
    await fs.writeFile(path.join(workdir, 'sra.spec.json'), JSON.stringify(spec, null, 2));
}

const remote = (resultJson, version = 1) => ({
    data: { id: 'analysis-1', version, resultJson }
});

const lastPayload = () => put.mock.calls.at(-1)[1];

beforeEach(async () => {
    workdir = await fs.mkdtemp(path.join(os.tmpdir(), 'sra-push-'));
    process.chdir(workdir);

    process.exitCode = 0;
    get.mockReset();
    put.mockReset();
    put.mockResolvedValue({ data: {} });
});

afterAll(() => {
    process.chdir(originalCwd);
    // Commands signal failure by setting process.exitCode; a test that asserts on that
    // would otherwise leave the flag set and fail the whole Jest run.
    process.exitCode = 0;
});

describe('push writeback', () => {
    test('patches the IEEE feature section in place, preserving fields the CLI never sees', async () => {
        get.mockResolvedValue(remote({
            formatId: 'ieee830',
            systemFeatures: [{
                name: 'Authentication',
                description: 'Sign in.',
                priority: 'High',
                stimulusResponseSequences: ['User submits credentials -> session issued'],
                functionalRequirements: ['Users shall sign in.']
            }]
        }, 3));

        await writeLocalSpec({
            analysisId: 'analysis-1',
            version: 3,
            formatId: 'ieee830',
            features: [{
                id: 'FEAT-1',
                name: 'Authentication',
                status: 'verified',
                verification_files: ['src/auth.ts'],
                functionalRequirements: ['Users shall sign in.'],
                source: { section: 'systemFeatures', index: 0, kind: 'feature-list' }
            }]
        });

        await push({});

        const feature = lastPayload().systemFeatures[0];
        expect(feature.verification_files).toEqual(['src/auth.ts']);
        expect(feature.status).toBe('verified');
        // Fields the CLI has no view of must survive the round trip.
        expect(feature.priority).toBe('High');
        expect(feature.stimulusResponseSequences).toEqual(['User submits credentials -> session issued']);
        expect(process.exitCode).toBe(0);
    });

    test('never invents a systemFeatures section on a format that has none', async () => {
        get.mockResolvedValue(remote({
            formatId: 'agile-prd',
            userStories: [{ role: 'dev', action: 'sync a spec', benefit: 'traceability' }]
        }));

        await writeLocalSpec({
            analysisId: 'analysis-1',
            version: 1,
            formatId: 'agile-prd',
            formatName: 'Agile PRD',
            features: [{
                id: 'FEAT-1',
                name: 'User Stories',
                status: 'verified',
                verification_files: ['src/sync.ts'],
                functionalRequirements: ['As a dev, I want sync a spec, so that traceability.'],
                source: { section: 'userStories', index: null, kind: 'user-stories' }
            }]
        });

        await push({});

        const payload = lastPayload();
        // The regression this guards: writing IEEE's section into a document that has no
        // such section corrupts the document and renders nowhere.
        expect(payload).not.toHaveProperty('systemFeatures');
        // Nor may the flattened prose overwrite the structured story objects.
        expect(payload).not.toHaveProperty('userStories');
        // Traceability still reaches the platform, via the format-independent record.
        expect(payload.metadata.cliTraceability.groups[0].verification_files).toEqual(['src/sync.ts']);
        expect(payload.metadata.cliTraceability.summary.verified).toBe(1);
    });

    test('matches by name when the remote document has been reordered', async () => {
        get.mockResolvedValue(remote({
            formatId: 'ieee830',
            systemFeatures: [
                { name: 'Billing', functionalRequirements: ['Charge cards.'] },
                { name: 'Authentication', functionalRequirements: ['Users shall sign in.'] }
            ]
        }, 4));

        await writeLocalSpec({
            analysisId: 'analysis-1',
            version: 3,
            formatId: 'ieee830',
            features: [{
                name: 'Authentication',
                status: 'verified',
                verification_files: ['src/auth.ts'],
                functionalRequirements: ['Users shall sign in.'],
                // Stale index: Authentication moved from slot 0 to slot 1 upstream.
                source: { section: 'systemFeatures', index: 0, kind: 'feature-list' }
            }]
        });

        await push({});

        const payload = lastPayload();
        expect(payload.systemFeatures[0].verification_files).toBeUndefined();
        expect(payload.systemFeatures[1].verification_files).toEqual(['src/auth.ts']);
    });

    test('skips a group that no longer exists upstream instead of writing to the wrong one', async () => {
        get.mockResolvedValue(remote({
            formatId: 'ieee830',
            systemFeatures: [{ name: 'Billing', functionalRequirements: ['Charge cards.'] }]
        }, 2));

        await writeLocalSpec({
            analysisId: 'analysis-1',
            version: 2,
            formatId: 'ieee830',
            features: [{
                name: 'Deleted Feature',
                status: 'verified',
                verification_files: ['src/gone.ts'],
                functionalRequirements: [],
                source: { section: 'systemFeatures', index: 0, kind: 'feature-list' }
            }]
        });

        await push({});

        const payload = lastPayload();
        expect(payload.systemFeatures[0].name).toBe('Billing');
        expect(payload.systemFeatures[0].verification_files).toBeUndefined();
    });

    test('updates in place and skips the paid alignment check by default', async () => {
        get.mockResolvedValue(remote({ formatId: 'ieee830', systemFeatures: [] }));
        await writeLocalSpec({ analysisId: 'analysis-1', version: 1, formatId: 'ieee830', features: [] });

        await push({});

        expect(lastPayload().inPlace).toBe(true);
        expect(lastPayload().skipAlignment).toBe(true);
    });

    test('--new-version records the results as a new version instead', async () => {
        get.mockResolvedValue(remote({ formatId: 'ieee830', systemFeatures: [] }));
        await writeLocalSpec({ analysisId: 'analysis-1', version: 1, formatId: 'ieee830', features: [] });

        await push({ newVersion: true });

        expect(lastPayload().inPlace).toBe(false);
    });

    test('fails without pushing when there is no local spec', async () => {
        await push({});

        expect(put).not.toHaveBeenCalled();
        expect(process.exitCode).toBe(1);
    });
});

/**
 * The platform owns requirement content; the CLI owns verification state. Push used to write
 * the whole local array back, so any edit made on the website after the last sync was
 * silently reverted by the next push.
 */
describe('push merges rather than overwrites', () => {
    const localSpec = (functionalRequirements) => ({
        analysisId: 'analysis-1',
        version: 1,
        formatId: 'ieee830',
        features: [{
            name: 'Authentication',
            source: { section: 'systemFeatures', index: 0, kind: 'feature-list' },
            status: 'verified',
            verification_files: ['src/auth.js'],
            functionalRequirements
        }]
    });

    const remoteFeature = (functionalRequirements) => remote({
        formatId: 'ieee830',
        systemFeatures: [{ name: 'Authentication', functionalRequirements }]
    });

    const pushed = () => lastPayload().systemFeatures[0].functionalRequirements;

    test('keeps a requirement edited on the website after the last sync', async () => {
        get.mockResolvedValue(remoteFeature(['The system shall sign users in via SSO.']));
        await writeLocalSpec(localSpec([
            { id: 'R1', description: 'The system shall sign users in.', metadata: { verification_status: 'APPROVED_HUMAN' } }
        ]));

        await push({});

        // The website's wording survives, and the stale approval does not ride along with it.
        expect(pushed()).toEqual(['The system shall sign users in via SSO.']);
    });

    test('records the decision when the wording still matches', async () => {
        get.mockResolvedValue(remoteFeature(['The system shall sign users in.']));
        await writeLocalSpec(localSpec([
            { id: 'R1', description: 'The system shall sign users in.', metadata: { verification_status: 'APPROVED_HUMAN', verifiedBy: 'ada' } }
        ]));

        await push({});

        expect(pushed()[0]).toEqual({
            description: 'The system shall sign users in.',
            metadata: { verification_status: 'APPROVED_HUMAN', verifiedBy: 'ada' }
        });
    });

    test('leaves a requirement added on the website since the sync untouched', async () => {
        get.mockResolvedValue(remoteFeature([
            'The system shall sign users in.',
            'The system shall support passkeys.'
        ]));
        await writeLocalSpec(localSpec([
            { id: 'R1', description: 'The system shall sign users in.', metadata: { verification_status: 'APPROVED_HUMAN' } }
        ]));

        await push({});

        expect(pushed()).toHaveLength(2);
        expect(pushed()[1]).toBe('The system shall support passkeys.');
    });

    test('does not resurrect a requirement deleted on the website', async () => {
        get.mockResolvedValue(remoteFeature(['The system shall sign users in.']));
        await writeLocalSpec(localSpec([
            { id: 'R1', description: 'The system shall sign users in.', metadata: { verification_status: 'APPROVED_HUMAN' } },
            { id: 'R2', description: 'The system shall delete accounts.', metadata: { verification_status: 'APPROVED_HUMAN' } }
        ]));

        await push({});

        expect(pushed()).toHaveLength(1);
    });

    test('preserves the structured attributes of an ISO 29148 requirement', async () => {
        // The shape that push previously flattened to prose.
        get.mockResolvedValue(remoteFeature([{
            id: 'FTP-REQ-001',
            description: 'The system shall lock an account after five failed attempts.',
            rationale: 'Limits credential stuffing.',
            verificationMethod: 'Test',
            source: 'Security review'
        }]));
        await writeLocalSpec(localSpec([{
            id: 'FTP-REQ-001',
            description: 'The system shall lock an account after five failed attempts.',
            metadata: { verification_status: 'APPROVED_HUMAN' }
        }]));

        await push({});

        expect(pushed()[0]).toEqual({
            id: 'FTP-REQ-001',
            description: 'The system shall lock an account after five failed attempts.',
            rationale: 'Limits credential stuffing.',
            verificationMethod: 'Test',
            source: 'Security review',
            metadata: { verification_status: 'APPROVED_HUMAN' }
        });
    });

    test('still writes the CLI-owned verification fields on the feature itself', async () => {
        get.mockResolvedValue(remoteFeature(['The system shall sign users in.']));
        await writeLocalSpec(localSpec([
            { id: 'R1', description: 'The system shall sign users in.', metadata: { verification_status: 'APPROVED_HUMAN' } }
        ]));

        await push({});

        const feature = lastPayload().systemFeatures[0];
        expect(feature.status).toBe('verified');
        expect(feature.verification_files).toEqual(['src/auth.js']);
    });
});
