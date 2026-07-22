import { Prisma } from '../generated/prisma/index.js';
import prisma from '../config/prisma.js';
import { encryptData, decryptData, maskSensitiveData } from '../utils/dataEncryption.js';
import { normalizeProvider, DEFAULT_MODELS } from './providers/index.js';

/**
 * Resolves the decrypted API key + model to use for a given user/provider pair.
 *
 * Gemini is the only provider allowed to fall back to the platform's own key
 * (GEMINI_API_KEY) — every other provider requires the user's own stored key,
 * per the explicit product decision to never silently mis-route a paid
 * third-party call onto the platform's Gemini key.
 *
 * @returns {Promise<{ apiKey: string|null, modelName: string, provider: string }>}
 * @throws {Error} if a non-Gemini provider has no key configured for this user
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

    if (normalized === 'GEMINI') {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('Gemini is not configured on this platform and you have not added your own Gemini key.');
        }
        return {
            provider: normalized,
            apiKey: null, // GeminiAdapter uses the shared genAI client, not a per-call key
            modelName: requestedModelName || DEFAULT_MODELS[normalized]
        };
    }

    throw new Error(`No ${normalized} API key configured. Add one in Settings before selecting ${normalized} as the provider.`);
}

export async function listProviderKeys(userId) {
    const records = await prisma.userProviderKey.findMany({
        where: { userId },
        select: { id: true, provider: true, maskedKey: true, label: true, isActive: true, createdAt: true, updatedAt: true }
    });
    return records;
}

export async function upsertProviderKey(userId, provider, rawKey, label = null) {
    const normalized = normalizeProvider(provider);
    if (!rawKey || typeof rawKey !== 'string' || rawKey.trim().length === 0) {
        throw new Error('API key is required');
    }

    const encryptedKey = encryptData(rawKey.trim());
    const maskedKey = maskSensitiveData(rawKey.trim());

    return prisma.userProviderKey.upsert({
        where: { userId_provider: { userId, provider: normalized } },
        create: { userId, provider: normalized, encryptedKey, maskedKey, label, isActive: true },
        update: { encryptedKey, maskedKey, label, isActive: true },
        select: { id: true, provider: true, maskedKey: true, label: true, isActive: true, createdAt: true, updatedAt: true }
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
