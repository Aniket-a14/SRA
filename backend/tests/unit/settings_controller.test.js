import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockListProviderKeys = jest.fn();
const mockUpsertProviderKey = jest.fn();
const mockDeleteProviderKey = jest.fn();
const mockRefreshProviderModels = jest.fn();
const mockDiscoverModels = jest.fn();
const mockListQuotaStates = jest.fn();

jest.unstable_mockModule('../../src/services/providers/providerKeyService.js', () => ({
    listProviderKeys: mockListProviderKeys,
    upsertProviderKey: mockUpsertProviderKey,
    deleteProviderKey: mockDeleteProviderKey,
    refreshProviderModels: mockRefreshProviderModels,
}));

class ModelDiscoveryError extends Error {
    constructor(message, kind, statusCode) {
        super(message);
        this.kind = kind;
        this.statusCode = statusCode;
    }
}

jest.unstable_mockModule('../../src/services/providers/modelDiscovery.js', () => ({
    discoverModels: mockDiscoverModels,
    ModelDiscoveryError,
}));

jest.unstable_mockModule('../../src/services/providers/modelQuotaService.js', () => ({
    listQuotaStates: mockListQuotaStates,
}));

const {
    getModelQuota, getProviderKeys, verifyProviderKey, putProviderKey, refreshProviderKeyModels, removeProviderKey,
} = await import('../../src/controllers/settingsController.js');

function makeReq({ body = {}, params = {}, userId = 'user-1' } = {}) {
    return { body, params, user: { userId } };
}

function makeRes() {
    return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

describe('settingsController', () => {
    let next;

    beforeEach(() => {
        mockListProviderKeys.mockReset();
        mockUpsertProviderKey.mockReset();
        mockDeleteProviderKey.mockReset();
        mockRefreshProviderModels.mockReset();
        mockDiscoverModels.mockReset();
        mockListQuotaStates.mockReset();
        next = jest.fn();
    });

    describe('getModelQuota', () => {
        it('returns the caller\'s quota states', async () => {
            mockListQuotaStates.mockResolvedValue([{ provider: 'GEMINI', modelName: 'gemini-x', remaining: 10 }]);
            const res = makeRes();

            await getModelQuota(makeReq({ userId: 'user-1' }), res, next);

            expect(mockListQuotaStates).toHaveBeenCalledWith('user-1');
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                data: [{ provider: 'GEMINI', modelName: 'gemini-x', remaining: 10 }],
            }));
        });
    });

    describe('getProviderKeys', () => {
        it('returns the caller\'s stored keys', async () => {
            mockListProviderKeys.mockResolvedValue([{ provider: 'GEMINI', label: 'Personal' }]);
            const res = makeRes();

            await getProviderKeys(makeReq({ userId: 'user-7' }), res, next);

            expect(mockListProviderKeys).toHaveBeenCalledWith('user-7');
            expect(res.status).toHaveBeenCalledWith(200);
        });
    });

    describe('verifyProviderKey', () => {
        it('verifies without persisting and returns the discovered models', async () => {
            mockDiscoverModels.mockResolvedValue({ models: ['gemini-3-flash', 'gemini-3-pro'] });
            const res = makeRes();

            await verifyProviderKey(makeReq({ body: { provider: 'GEMINI', apiKey: 'test-key' } }), res, next);

            expect(mockDiscoverModels).toHaveBeenCalledWith('GEMINI', 'test-key');
            expect(mockUpsertProviderKey).not.toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                data: { valid: true, models: ['gemini-3-flash', 'gemini-3-pro'] },
            }));
        });

        it('defaults a ModelDiscoveryError to 400 when it carries no statusCode of its own', async () => {
            const err = new ModelDiscoveryError('bad key', 'auth');
            mockDiscoverModels.mockRejectedValue(err);
            const res = makeRes();

            await verifyProviderKey(makeReq({ body: { provider: 'GEMINI', apiKey: 'bad' } }), res, next);

            expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
        });

        it('preserves an explicit statusCode already on the ModelDiscoveryError', async () => {
            const err = new ModelDiscoveryError('rate limited', 'rate_limit', 429);
            mockDiscoverModels.mockRejectedValue(err);
            const res = makeRes();

            await verifyProviderKey(makeReq({ body: { provider: 'GEMINI', apiKey: 'k' } }), res, next);

            expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 429 }));
        });
    });

    describe('putProviderKey', () => {
        it('discovers models then saves the key, returning the saved record', async () => {
            mockDiscoverModels.mockResolvedValue({ models: ['gemini-3-flash'] });
            mockUpsertProviderKey.mockResolvedValue({ provider: 'GEMINI', label: 'Work', modelsAvailable: ['gemini-3-flash'] });
            const res = makeRes();

            await putProviderKey(makeReq({ body: { provider: 'GEMINI', apiKey: 'k', label: 'Work' } }), res, next);

            expect(mockUpsertProviderKey).toHaveBeenCalledWith('user-1', 'GEMINI', 'k', 'Work', ['gemini-3-flash']);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Provider key saved' }));
        });

        it('rejects the save outright on an auth-kind discovery failure — never persists a rejected key', async () => {
            mockDiscoverModels.mockRejectedValue(new ModelDiscoveryError('invalid key', 'auth'));
            const res = makeRes();

            await putProviderKey(makeReq({ body: { provider: 'GEMINI', apiKey: 'wrong' } }), res, next);

            expect(mockUpsertProviderKey).not.toHaveBeenCalled();
            expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
        });

        it('still saves the key on a non-auth discovery failure (network/5xx), with no cached models', async () => {
            mockDiscoverModels.mockRejectedValue(new ModelDiscoveryError('provider unreachable', 'network'));
            mockUpsertProviderKey.mockResolvedValue({ provider: 'GEMINI', label: null, modelsAvailable: null });
            const res = makeRes();

            await putProviderKey(makeReq({ body: { provider: 'GEMINI', apiKey: 'k' } }), res, next);

            expect(mockUpsertProviderKey).toHaveBeenCalledWith('user-1', 'GEMINI', 'k', undefined, null);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Provider key saved' }));
        });

        it('defaults the statusCode to 400 for an unexpected upsert failure', async () => {
            mockDiscoverModels.mockResolvedValue({ models: [] });
            mockUpsertProviderKey.mockRejectedValue(new Error('db write failed'));
            const res = makeRes();

            await putProviderKey(makeReq({ body: { provider: 'GEMINI', apiKey: 'k' } }), res, next);

            expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400, message: 'db write failed' }));
        });
    });

    describe('refreshProviderKeyModels', () => {
        it('re-discovers models for the already-stored key', async () => {
            mockRefreshProviderModels.mockResolvedValue({ provider: 'GEMINI', modelsAvailable: ['gemini-3-flash', 'gemini-3-ultra'] });
            const res = makeRes();

            await refreshProviderKeyModels(makeReq({ params: { provider: 'GEMINI' } }), res, next);

            expect(mockRefreshProviderModels).toHaveBeenCalledWith('user-1', 'GEMINI', mockDiscoverModels);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Models refreshed' }));
        });
    });

    describe('removeProviderKey', () => {
        it('deletes the caller\'s key for the given provider', async () => {
            mockDeleteProviderKey.mockResolvedValue(undefined);
            const res = makeRes();

            await removeProviderKey(makeReq({ params: { provider: 'OPENAI' } }), res, next);

            expect(mockDeleteProviderKey).toHaveBeenCalledWith('user-1', 'OPENAI');
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Provider key removed' }));
        });
    });
});
