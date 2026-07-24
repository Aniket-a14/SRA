import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Regression coverage for the BYOK "verify key → list models → cache on save" flow
// added alongside dynamic model discovery. Mocks the discovery + persistence layers
// so this exercises the controller's branching (auth-fail rejects, transient-fail
// still saves) rather than real provider calls.

const mockDiscover = jest.fn();
class MockModelDiscoveryError extends Error {
    constructor(message, kind = 'unavailable') {
        super(message);
        this.kind = kind;
        this.statusCode = kind === 'auth' ? 400 : 502;
    }
}

jest.unstable_mockModule('../../src/services/providers/modelDiscovery.js', () => ({
    discoverModels: mockDiscover,
    ModelDiscoveryError: MockModelDiscoveryError
}));

const mockUpsert = jest.fn();
const mockList = jest.fn();
const mockDelete = jest.fn();
jest.unstable_mockModule('../../src/services/providers/providerKeyService.js', () => ({
    listProviderKeys: mockList,
    upsertProviderKey: mockUpsert,
    deleteProviderKey: mockDelete
}));

const { verifyProviderKey, putProviderKey } = await import('../../src/controllers/settingsController.js');

function mockRes() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; }
    };
}

describe('settingsController — provider key verify/save (regression)', () => {
    beforeEach(() => {
        mockDiscover.mockReset();
        mockUpsert.mockReset();
        mockList.mockReset();
    });

    it('verifyProviderKey returns discovered models without persisting anything', async () => {
        mockDiscover.mockResolvedValue({ models: [{ id: 'gpt-5.6', label: 'GPT-5.6' }] });
        const req = { user: { userId: 'u1' }, body: { provider: 'OPENAI', apiKey: 'sk-x' } };
        const res = mockRes();

        await verifyProviderKey(req, res, () => {});

        expect(res.body.data.valid).toBe(true);
        expect(res.body.data.models).toHaveLength(1);
        expect(mockUpsert).not.toHaveBeenCalled();
    });

    it('putProviderKey caches the discovered models on the stored key', async () => {
        const models = [{ id: 'claude-opus-4-8', label: 'Claude Opus 4.8' }];
        mockDiscover.mockResolvedValue({ models });
        mockUpsert.mockResolvedValue({ id: 'k1', provider: 'CLAUDE', availableModels: models });
        const req = { user: { userId: 'u1' }, body: { provider: 'CLAUDE', apiKey: 'sk-ant', label: null } };
        const res = mockRes();

        await putProviderKey(req, res, () => {});

        expect(mockUpsert).toHaveBeenCalledWith('u1', 'CLAUDE', 'sk-ant', null, models);
        expect(res.body.data.availableModels).toEqual(models);
    });

    it('putProviderKey rejects an invalid key (auth failure) without saving', async () => {
        mockDiscover.mockRejectedValue(new MockModelDiscoveryError('Invalid API key', 'auth'));
        const req = { user: { userId: 'u1' }, body: { provider: 'OPENAI', apiKey: 'sk-bad' } };
        const res = mockRes();
        let nextErr;

        await putProviderKey(req, res, (e) => { nextErr = e; });

        expect(mockUpsert).not.toHaveBeenCalled();
        expect(nextErr).toBeInstanceOf(MockModelDiscoveryError);
        expect(nextErr.statusCode).toBe(400);
    });

    it('putProviderKey still saves a valid key when discovery is transiently unavailable', async () => {
        mockDiscover.mockRejectedValue(new MockModelDiscoveryError('provider unreachable', 'unavailable'));
        mockUpsert.mockResolvedValue({ id: 'k2', provider: 'GROK', availableModels: null });
        const req = { user: { userId: 'u1' }, body: { provider: 'GROK', apiKey: 'xai-key' } };
        const res = mockRes();

        await putProviderKey(req, res, () => {});

        // Non-auth failure: key persisted, models left null for later discovery.
        expect(mockUpsert).toHaveBeenCalledWith('u1', 'GROK', 'xai-key', undefined, null);
        expect(res.body.data.id).toBe('k2');
    });
});
