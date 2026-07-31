import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockListProviderKeys = jest.fn();
const mockResolveProviderKey = jest.fn();
const mockIsModelExhausted = jest.fn();

jest.unstable_mockModule('../../src/services/providers/providerKeyService.js', () => ({
    listProviderKeys: mockListProviderKeys,
    resolveProviderKey: mockResolveProviderKey
}));
jest.unstable_mockModule('../../src/services/providers/modelQuotaService.js', () => ({
    isModelExhausted: mockIsModelExhausted
}));

const { normalizeFallbackCandidates, selectNextFallbackModel } =
    await import('../../src/services/providers/modelFallbackService.js');

beforeEach(() => {
    jest.clearAllMocks();
    mockListProviderKeys.mockResolvedValue([
        {
            provider: 'GEMINI',
            isActive: true,
            availableModels: [{ id: 'gemini-primary' }, { id: 'gemini-backup' }]
        },
        {
            provider: 'OPENAI',
            isActive: true,
            availableModels: [{ id: 'gpt-backup' }]
        }
    ]);
    mockIsModelExhausted.mockResolvedValue(false);
    mockResolveProviderKey.mockImplementation(async (_userId, provider, modelName) => ({
        provider,
        modelName,
        inputTokenLimit: 1000,
        outputTokenLimit: 500
    }));
});

describe('normalizeFallbackCandidates', () => {
    it('normalizes aliases, preserves order, and removes duplicates', () => {
        expect(normalizeFallbackCandidates([
            { modelProvider: 'google', modelName: 'gemini-backup' },
            { modelProvider: 'OPENAI', modelName: 'gpt-backup' },
            { modelProvider: 'GEMINI', modelName: 'gemini-backup' },
            { modelProvider: 'GEMINI', modelName: ' ' }
        ])).toEqual([
            { provider: 'GEMINI', modelName: 'gemini-backup' },
            { provider: 'OPENAI', modelName: 'gpt-backup' }
        ]);
    });
});

describe('selectNextFallbackModel', () => {
    it('requires explicit permission and chooses the first available approved model', async () => {
        const settings = {
            modelProvider: 'GEMINI',
            modelName: 'gemini-primary',
            allowModelFallback: true,
            fallbackModels: [
                { modelProvider: 'GEMINI', modelName: 'gemini-backup' },
                { modelProvider: 'OPENAI', modelName: 'gpt-backup' }
            ]
        };

        await expect(selectNextFallbackModel('u1', settings, [])).resolves.toEqual({
            provider: 'GEMINI',
            modelName: 'gemini-backup',
            inputTokenLimit: 1000,
            outputTokenLimit: 500
        });
    });

    it('skips exhausted, unavailable, and already attempted models', async () => {
        mockIsModelExhausted.mockImplementation(async (_userId, _provider, modelName) => (
            modelName === 'gemini-backup'
        ));

        await expect(selectNextFallbackModel('u1', {
            modelProvider: 'GEMINI',
            modelName: 'gemini-primary',
            allowModelFallback: true,
            fallbackModels: [
                { modelProvider: 'GEMINI', modelName: 'gemini-backup' },
                { modelProvider: 'OPENAI', modelName: 'not-discovered' },
                { modelProvider: 'OPENAI', modelName: 'gpt-backup' }
            ]
        }, [{ provider: 'OPENAI', modelName: 'gpt-backup' }])).resolves.toBeNull();
    });

    it('skips a fallback backed only by an inactive provider key', async () => {
        mockListProviderKeys.mockResolvedValueOnce([
            { provider: 'OPENAI', isActive: false, availableModels: [{ id: 'gpt-backup' }] }
        ]);

        await expect(selectNextFallbackModel('u1', {
            modelProvider: 'GEMINI',
            modelName: 'gemini-primary',
            allowModelFallback: true,
            fallbackModels: [{ modelProvider: 'OPENAI', modelName: 'gpt-backup' }]
        })).resolves.toBeNull();
        expect(mockResolveProviderKey).not.toHaveBeenCalled();
    });

    it('continues to the next approved model when key resolution fails', async () => {
        mockResolveProviderKey.mockRejectedValueOnce(new Error('key removed'));

        await expect(selectNextFallbackModel('u1', {
            modelProvider: 'GEMINI',
            modelName: 'gemini-primary',
            allowModelFallback: true,
            fallbackModels: [
                { modelProvider: 'GEMINI', modelName: 'gemini-backup' },
                { modelProvider: 'OPENAI', modelName: 'gpt-backup' }
            ]
        })).resolves.toMatchObject({
            provider: 'OPENAI',
            modelName: 'gpt-backup'
        });
        expect(mockResolveProviderKey).toHaveBeenCalledTimes(2);
    });

    it('does not revisit a model recorded as a prior fallback destination', async () => {
        await expect(selectNextFallbackModel('u1', {
            modelProvider: 'GEMINI',
            modelName: 'gemini-primary',
            allowModelFallback: true,
            fallbackModels: [
                { modelProvider: 'GEMINI', modelName: 'gemini-backup' },
                { modelProvider: 'OPENAI', modelName: 'gpt-backup' }
            ]
        }, [{
            fromProvider: 'GEMINI',
            fromModel: 'gemini-primary',
            toProvider: 'GEMINI',
            toModel: 'gemini-backup'
        }])).resolves.toMatchObject({
            provider: 'OPENAI',
            modelName: 'gpt-backup'
        });
    });

    it('never selects a model when permission was not granted', async () => {
        await expect(selectNextFallbackModel('u1', {
            modelProvider: 'GEMINI',
            modelName: 'gemini-primary',
            fallbackModels: [{ modelProvider: 'OPENAI', modelName: 'gpt-backup' }]
        })).resolves.toBeNull();
        expect(mockListProviderKeys).not.toHaveBeenCalled();
    });
});
