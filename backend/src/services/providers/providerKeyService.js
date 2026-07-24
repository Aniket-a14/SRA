import { Prisma } from '../../generated/prisma/index.js';
import prisma from '../../config/prisma.js';
import { encryptData, decryptData, maskSensitiveData } from '../../utils/dataEncryption.js';
import { normalizeProvider, DEFAULT_MODELS } from './index.js';

/**
 * Resolves the decrypted API key + model to use for a given user/provider pair
 * for **SRS generation**.
 *
 * BYOK is now mandatory for generation on every provider — including Gemini. The
 * platform's own GEMINI_API_KEY is reserved exclusively for embeddings (see
 * embeddingService, which uses the shared platform client directly) and is never
 * used to fund a user's SRS generation. A user must add their own key in Settings
 * before generating, regardless of which provider they pick.
 *
 * @returns {Promise<{ apiKey: string, modelName: string, provider: string }>}
 * @throws {Error} if the user has no active key configured for the chosen provider
 */
export async function resolveProviderKey(userId, provider, requestedModelName = null) {
    const normalized = normalizeProvider(provider);

    const record = await prisma.userProviderKey.findUnique({
        where: { userId_provider: { userId, provider: normalized } }
    });

    if (record && record.isActive) {
        return {
            provider: normalized,
            apiKey: decryptData(record.encryptedKey),
            modelName: requestedModelName || DEFAULT_MODELS[normalized]
        };
    }

    throw new Error(`No ${normalized} API key configured. Add your own ${normalized} key in Settings before generating — the platform key is reserved for embeddings only.`);
}

export async function listProviderKeys(userId) {
    const records = await prisma.userProviderKey.findMany({
        where: { userId },
        select: { id: true, provider: true, maskedKey: true, label: true, availableModels: true, isActive: true, createdAt: true, updatedAt: true }
    });
    return records;
}

export async function upsertProviderKey(userId, provider, rawKey, label = null, availableModels = null) {
    const normalized = normalizeProvider(provider);
    if (!rawKey || typeof rawKey !== 'string' || rawKey.trim().length === 0) {
        throw new Error('API key is required');
    }

    const encryptedKey = encryptData(rawKey.trim());
    const maskedKey = maskSensitiveData(rawKey.trim());

    return prisma.userProviderKey.upsert({
        where: { userId_provider: { userId, provider: normalized } },
        create: { userId, provider: normalized, encryptedKey, maskedKey, label, availableModels: availableModels ?? undefined, isActive: true },
        update: { encryptedKey, maskedKey, label, availableModels: availableModels ?? undefined, isActive: true },
        select: { id: true, provider: true, maskedKey: true, label: true, availableModels: true, isActive: true, createdAt: true, updatedAt: true }
    });
}

export async function deleteProviderKey(userId, provider) {
    const normalized = normalizeProvider(provider);
    try {
        await prisma.userProviderKey.delete({
            where: { userId_provider: { userId, provider: normalized } }
        });
    } catch (error) {
        // P2025 = record not found — deleting an already-absent key is a no-op, not an error.
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025')) {
            throw error;
        }
    }
}
