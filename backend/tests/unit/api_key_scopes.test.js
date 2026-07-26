import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * API keys carried the full authority of the account that created them, so the token a CI
 * job needs to run `sra check` could equally delete every project that account owns.
 */

const mockApiKeyFindUnique = jest.fn();
const mockApiKeyUpdate = jest.fn().mockResolvedValue({});
const mockApiKeyCreate = jest.fn();

jest.unstable_mockModule('../../src/config/prisma.js', () => ({
    default: {
        apiKey: {
            findUnique: mockApiKeyFindUnique,
            update: mockApiKeyUpdate,
            create: mockApiKeyCreate,
            findMany: jest.fn(),
            deleteMany: jest.fn()
        },
        session: { findUnique: jest.fn() }
    }
}));

jest.unstable_mockModule('../../src/config/jwt.js', () => ({ verifyToken: () => null }));
jest.unstable_mockModule('../../src/services/auth/sessionService.js', () => ({ isSessionActive: jest.fn() }));

const runMiddleware = (mw, req) => new Promise((resolve) => {
    mw(req, {}, (err) => resolve(err));
});

beforeEach(() => {
    jest.clearAllMocks();
    mockApiKeyUpdate.mockResolvedValue({});
});

describe('requireScope', () => {
    it('allows a key holding the scope', async () => {
        const { requireScope } = await import('../../src/middleware/authMiddleware.js');

        const err = await runMiddleware(requireScope('admin'), { user: { scopes: ['read', 'write', 'admin'] } });

        expect(err).toBeUndefined();
    });

    it('rejects a key that lacks it, with 403 rather than 401', async () => {
        const { requireScope } = await import('../../src/middleware/authMiddleware.js');

        // 403, not 401: the credential is valid and known, it simply is not permitted here.
        // A 401 would tell a CLI to go and re-authenticate, which would not help.
        const err = await runMiddleware(requireScope('admin'), { user: { scopes: ['read', 'write'] } });

        expect(err.statusCode).toBe(403);
        expect(err.message).toMatch(/admin/);
    });

    it('rejects when no scopes are present at all', async () => {
        const { requireScope } = await import('../../src/middleware/authMiddleware.js');

        const err = await runMiddleware(requireScope('read'), { user: {} });

        expect(err.statusCode).toBe(403);
    });
});

describe('verifyApiKey', () => {
    const validKey = 'sra_live_' + 'a'.repeat(64);

    it('returns the granted scopes alongside the user', async () => {
        const { verifyApiKey } = await import('../../src/services/auth/apiKeyService.js');
        mockApiKeyFindUnique.mockResolvedValue({
            id: 'k1', expiresAt: null, scopes: ['read'],
            user: { id: 'u1', email: 'a@example.com', deletedAt: null }
        });

        const result = await verifyApiKey(validKey);

        expect(result.scopes).toEqual(['read']);
        expect(result.user.id).toBe('u1');
    });

    it('falls back to read+write for a key predating scopes, never to admin', async () => {
        const { verifyApiKey, DEFAULT_API_KEY_SCOPES } = await import('../../src/services/auth/apiKeyService.js');
        mockApiKeyFindUnique.mockResolvedValue({
            id: 'k1', expiresAt: null, scopes: [],
            user: { id: 'u1', email: 'a@example.com', deletedAt: null }
        });

        const result = await verifyApiKey(validKey);

        expect(result.scopes).toEqual(DEFAULT_API_KEY_SCOPES);
        expect(result.scopes).not.toContain('admin');
    });

    it('refuses a key whose owner is being erased', async () => {
        const { verifyApiKey } = await import('../../src/services/auth/apiKeyService.js');
        mockApiKeyFindUnique.mockResolvedValue({
            id: 'k1', expiresAt: null, scopes: ['read'],
            user: { id: 'u1', email: 'a@example.com', deletedAt: new Date() }
        });

        await expect(verifyApiKey(validKey)).resolves.toBeNull();
    });

    it('refuses an expired key', async () => {
        const { verifyApiKey } = await import('../../src/services/auth/apiKeyService.js');
        mockApiKeyFindUnique.mockResolvedValue({
            id: 'k1', expiresAt: new Date(Date.now() - 1000), scopes: ['read'],
            user: { id: 'u1', deletedAt: null }
        });

        await expect(verifyApiKey(validKey)).resolves.toBeNull();
    });
});

describe('createApiKey', () => {
    it('discards scopes that are not real, rather than storing them', async () => {
        const { createApiKey } = await import('../../src/services/auth/apiKeyService.js');
        mockApiKeyCreate.mockResolvedValue({ id: 'k1', name: 'n', scopes: ['read'], createdAt: new Date(), expiresAt: null });

        await createApiKey('u1', 'ci', 365, ['read', 'superuser']);

        expect(mockApiKeyCreate.mock.calls[0][0].data.scopes).toEqual(['read']);
    });

    it('defaults to read+write when the request names no valid scope', async () => {
        const { createApiKey, DEFAULT_API_KEY_SCOPES } = await import('../../src/services/auth/apiKeyService.js');
        mockApiKeyCreate.mockResolvedValue({ id: 'k1', name: 'n', scopes: DEFAULT_API_KEY_SCOPES, createdAt: new Date(), expiresAt: null });

        await createApiKey('u1', 'ci', 365, ['nonsense']);

        expect(mockApiKeyCreate.mock.calls[0][0].data.scopes).toEqual(DEFAULT_API_KEY_SCOPES);
    });

    it('returns the raw key once but never the stored hash', async () => {
        const { createApiKey } = await import('../../src/services/auth/apiKeyService.js');
        mockApiKeyCreate.mockResolvedValue({
            id: 'k1', name: 'ci', scopes: ['read'], key: 'sha256-hash', createdAt: new Date(), expiresAt: null
        });

        const result = await createApiKey('u1', 'ci');

        expect(result.rawKey).toMatch(/^sra_live_/);
        expect(result).not.toHaveProperty('key');
    });
});
