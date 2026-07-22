import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Prisma } from '../../src/generated/prisma/index.js';

const mockFindUnique = jest.fn();
const mockFindMany = jest.fn();
const mockUpsert = jest.fn();
const mockDelete = jest.fn();

jest.unstable_mockModule('../../src/config/prisma.js', () => ({
    default: {
        userProviderKey: {
            findUnique: mockFindUnique,
            findMany: mockFindMany,
            upsert: mockUpsert,
            delete: mockDelete
        }
    }
}));

// Mocked so this test verifies providerKeyService's own logic (which record wins,
// what gets thrown, what gets selected) independent of the real AES-256-GCM
// round-trip, which is already covered by dataEncryption.js's own concerns.
jest.unstable_mockModule('../../src/utils/dataEncryption.js', () => ({
    encryptData: jest.fn((plaintext) => `ENC(${plaintext})`),
    decryptData: jest.fn((ciphertext) => ciphertext.replace(/^ENC\(/, '').replace(/\)$/, '')),
    maskSensitiveData: jest.fn(() => '****masked****')
}));

const { resolveProviderKey, listProviderKeys, upsertProviderKey, deleteProviderKey } = await import('../../src/services/providerKeyService.js');

describe('providerKeyService', () => {
    const originalGeminiKey = process.env.GEMINI_API_KEY;

    beforeEach(() => {
        mockFindUnique.mockReset();
        mockFindMany.mockReset();
        mockUpsert.mockReset();
        mockDelete.mockReset();
        process.env.GEMINI_API_KEY = 'platform-gemini-key';
    });

    afterEach(() => {
        process.env.GEMINI_API_KEY = originalGeminiKey;
    });

    describe('resolveProviderKey', () => {
        it('falls back to the platform Gemini key when the user has no key configured', async () => {
            mockFindUnique.mockResolvedValue(null);

            const result = await resolveProviderKey('user-1', 'gemini');

            expect(result.provider).toBe('GEMINI');
            expect(result.apiKey).toBeNull(); // GeminiAdapter uses the shared genAI client, not a per-call key
            expect(result.modelName).toBeTruthy();
        });

        it('throws for a non-Gemini provider with no configured key', async () => {
            mockFindUnique.mockResolvedValue(null);

            await expect(resolveProviderKey('user-1', 'openai')).rejects.toThrow(/No OPENAI API key configured/);
        });

        it('decrypts and returns the stored key when one is configured and active', async () => {
            mockFindUnique.mockResolvedValue({
                userId: 'user-1',
                provider: 'CLAUDE',
                encryptedKey: 'ENC(sk-ant-real-key)',
                isActive: true
            });

            const result = await resolveProviderKey('user-1', 'claude');

            expect(result.provider).toBe('CLAUDE');
            expect(result.apiKey).toBe('sk-ant-real-key');
        });

        it('ignores a deactivated key and falls through to the no-key error for non-Gemini providers', async () => {
            mockFindUnique.mockResolvedValue({
                userId: 'user-1',
                provider: 'OPENAI',
                encryptedKey: 'ENC(sk-inactive)',
                isActive: false
            });

            await expect(resolveProviderKey('user-1', 'openai')).rejects.toThrow(/No OPENAI API key configured/);
        });

        it('never silently substitutes Gemini for a requested non-Gemini provider', async () => {
            mockFindUnique.mockResolvedValue(null);

            const error = await resolveProviderKey('user-1', 'grok').catch(e => e);
            expect(error).toBeInstanceOf(Error);
            expect(error.message).not.toMatch(/gemini/i);
        });
    });

    describe('upsertProviderKey / listProviderKeys / deleteProviderKey', () => {
        it('rejects an empty key before touching the database', async () => {
            await expect(upsertProviderKey('user-1', 'openai', '   ')).rejects.toThrow('API key is required');
            expect(mockUpsert).not.toHaveBeenCalled();
        });

        it('normalizes the provider and masks the key on upsert', async () => {
            mockUpsert.mockImplementation(({ create }) => Promise.resolve({ ...create, id: 'key-1' }));

            const result = await upsertProviderKey('user-1', 'openai', 'sk-abcdefghijklmnop');

            expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
                where: { userId_provider: { userId: 'user-1', provider: 'OPENAI' } }
            }));
            expect(result.maskedKey).toBe('****masked****');
        });

        it('lists keys scoped to the user without ever selecting the encrypted key', async () => {
            mockFindMany.mockResolvedValue([]);
            await listProviderKeys('user-1');

            const call = mockFindMany.mock.calls[0][0];
            expect(call.where).toEqual({ userId: 'user-1' });
            expect(call.select.encryptedKey).toBeUndefined();
        });

        it('treats deleting an already-absent key as a no-op', async () => {
            const notFound = new Prisma.PrismaClientKnownRequestError('Record not found', {
                code: 'P2025',
                clientVersion: 'test'
            });
            mockDelete.mockRejectedValue(notFound);

            await expect(deleteProviderKey('user-1', 'openai')).resolves.toBeUndefined();
        });

        it('rethrows a non-P2025 delete error instead of swallowing it', async () => {
            mockDelete.mockRejectedValue(new Error('connection reset'));

            await expect(deleteProviderKey('user-1', 'openai')).rejects.toThrow('connection reset');
        });
    });
});
