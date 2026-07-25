import { Prisma } from '../../generated/prisma/index.js';
import prisma from '../../config/prisma.js';
import { encryptData, decryptData, maskSensitiveData } from '../../utils/dataEncryption.js';
import { normalizeProvider, DEFAULT_MODELS } from './index.js';

/**
 * Resolves the decrypted API key + model to use for a given user/provider pair for
 * **every AI call the platform makes on that user's behalf**.
 *
 * BYOK is mandatory on every provider, including Gemini. The platform's own
 * GEMINI_API_KEY funds exactly one thing — embeddings (see embeddingService, which uses
 * the shared platform client directly) — because the pgvector columns are a single shared
 * embedding space that cannot be per-user. Generation, the validation gate, auto-fix,
 * alignment checks, surgical refinement, feature expansion, diagram repair and graph
 * extraction all run on the user's own key.
 *
 * @returns {Promise<{ apiKey: string, modelName: string, provider: string }>}
 * @throws {Error} (statusCode 400) if the user has no active key for the chosen provider
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

    const error = new Error(`No ${normalized} API key configured. Add your own ${normalized} key in Settings — the platform key funds embeddings only.`);
    // A missing user key is a client-fixable condition, not a server fault; without this
    // it surfaces as an opaque 500 instead of a message the UI can act on.
    error.statusCode = 400;
    throw error;
}

/**
 * Resolve the provider config for a user from an analysis's stored prompt settings.
 * Returns `{}` under MOCK_AI so mocked runs never need a key or a model.
 *
 * The returned object is spread into `analyzeText`-style settings via `asAiSettings`.
 *
 * @param {string} userId
 * @param {{ modelProvider?: string, modelName?: string }} [settings]
 */
export async function resolveProviderForUser(userId, settings = {}) {
    if (process.env.MOCK_AI === 'true') return {};
    return resolveProviderKey(userId, settings?.modelProvider, settings?.modelName);
}

/**
 * Adapt a resolved provider config to the shape `aiService.analyzeText`/`repairDiagram`
 * expect. Undefined fields fall through to those functions' own defaults, which is what
 * makes the MOCK_AI `{}` case work unchanged.
 *
 * @param {{ provider?: string, apiKey?: string, modelName?: string }} [providerConfig]
 */
export function asAiSettings(providerConfig = {}) {
    return {
        apiKey: providerConfig?.apiKey,
        modelProvider: providerConfig?.provider,
        modelName: providerConfig?.modelName
    };
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

    // The model list belongs to the KEY, not the provider. Writing DbNull (rather than
    // skipping the field with `?? undefined`) is deliberate: a replaced key must never
    // inherit the previous key's models. Two keys for the same provider can differ
    // completely — a free-tier Gemini key cannot call any *-pro model that a paid key
    // can — so a stale list would offer models that 429 at generation time.
    const models = availableModels ?? Prisma.DbNull;

    return prisma.userProviderKey.upsert({
        where: { userId_provider: { userId, provider: normalized } },
        create: { userId, provider: normalized, encryptedKey, maskedKey, label, availableModels: models, isActive: true },
        update: { encryptedKey, maskedKey, label, availableModels: models, isActive: true },
        select: { id: true, provider: true, maskedKey: true, label: true, availableModels: true, isActive: true, createdAt: true, updatedAt: true }
    });
}

/**
 * Re-run discovery against the key already stored for this user/provider and refresh the
 * cached model list. Model availability is a property of the key over time, not just at
 * save: a tier upgrade adds models and a retired model disappears, neither of which the
 * cached list would ever reflect otherwise.
 *
 * @param {(provider: string, apiKey: string) => Promise<{models: Array<{id:string,label:string}>}>} discover
 * @returns {Promise<{ provider: string, availableModels: Array }>}
 */
export async function refreshProviderModels(userId, provider, discover) {
    const normalized = normalizeProvider(provider);
    const record = await prisma.userProviderKey.findUnique({
        where: { userId_provider: { userId, provider: normalized } }
    });

    if (!record || !record.isActive) {
        const error = new Error(`No active ${normalized} key to refresh. Add one in Settings first.`);
        error.statusCode = 404;
        throw error;
    }

    const { models } = await discover(normalized, decryptData(record.encryptedKey));

    const updated = await prisma.userProviderKey.update({
        where: { userId_provider: { userId, provider: normalized } },
        data: { availableModels: models },
        select: { id: true, provider: true, maskedKey: true, label: true, availableModels: true, isActive: true, createdAt: true, updatedAt: true }
    });
    return updated;
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
