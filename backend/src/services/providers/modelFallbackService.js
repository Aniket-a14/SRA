import { normalizeProvider } from './index.js';
import { listProviderKeys, resolveProviderKey } from './providerKeyService.js';
import { isModelExhausted } from './modelQuotaService.js';
import logger from '../../config/logger.js';

const PROVIDER_VALUES = new Set(['GEMINI', 'OPENAI', 'CLAUDE', 'GROK']);

const candidateKey = (provider, modelName) => `${provider}:${modelName}`;

/**
 * Return only well-formed, user-selected fallback candidates.
 *
 * The list is intentionally ordered: the order is the user's cost/quality decision and
 * must be preserved when the pipeline moves from one exhausted model to the next.
 */
export const normalizeFallbackCandidates = (fallbackModels) => {
    if (!Array.isArray(fallbackModels)) return [];

    const seen = new Set();
    return fallbackModels.reduce((result, candidate) => {
        const provider = normalizeProvider(candidate?.modelProvider);
        const modelName = typeof candidate?.modelName === 'string' ? candidate.modelName.trim() : '';
        if (!PROVIDER_VALUES.has(provider) || !modelName) return result;

        const key = candidateKey(provider, modelName);
        if (seen.has(key)) return result;
        seen.add(key);
        result.push({ provider, modelName });
        return result;
    }, []);
};

/**
 * Find the next model that the user explicitly approved for this run.
 *
 * Availability is checked against the user's stored provider-key discovery result and the
 * live quota ledger. A missing/stale key, an exhausted model, or a model already attempted
 * in this fallback chain is skipped. No provider or model is ever invented implicitly.
 */
export const selectNextFallbackModel = async (userId, settings = {}, attempted = []) => {
    if (settings?.allowModelFallback !== true) return null;

    const candidates = normalizeFallbackCandidates(settings.fallbackModels);
    if (candidates.length === 0) return null;

    const currentProvider = normalizeProvider(settings.modelProvider);
    const currentModel = typeof settings.modelName === 'string' ? settings.modelName.trim() : '';
    const attemptedKeys = new Set(
        (Array.isArray(attempted) ? attempted : [])
            .flatMap((entry) => [
                { provider: entry?.provider, modelName: entry?.modelName },
                { provider: entry?.fromProvider, modelName: entry?.fromModel },
                { provider: entry?.toProvider, modelName: entry?.toModel }
            ])
            .filter((entry) => typeof entry.modelName === 'string' && entry.modelName.trim())
            .map((entry) => candidateKey(normalizeProvider(entry.provider), entry.modelName.trim()))
    );
    if (currentModel) attemptedKeys.add(candidateKey(currentProvider, currentModel));

    const providerKeys = await listProviderKeys(userId);

    for (const candidate of candidates) {
        const key = candidateKey(candidate.provider, candidate.modelName);
        if (attemptedKeys.has(key)) continue;

        const providerKey = providerKeys.find((record) => (
            record.provider === candidate.provider && record.isActive
        ));
        if (!providerKey) continue;

        // A discovered list is authoritative for that stored key. Older keys may not have
        // discovery data, so null/empty discovery remains compatible with the existing BYOK
        // behavior and is still checked by resolveProviderKey below.
        const availableModels = providerKey.availableModels;
        if (Array.isArray(availableModels) && availableModels.length > 0
            && !availableModels.some((model) => model?.id === candidate.modelName)) {
            continue;
        }

        if (await isModelExhausted(userId, candidate.provider, candidate.modelName)) continue;

        try {
            const resolved = await resolveProviderKey(userId, candidate.provider, candidate.modelName);
            return {
                provider: resolved.provider,
                modelName: resolved.modelName,
                apiKey: resolved.apiKey,
                inputTokenLimit: resolved.inputTokenLimit,
                outputTokenLimit: resolved.outputTokenLimit
            };
        } catch (error) {
            // The key may have been removed or deactivated while the run was in flight.
            // Continue through the user's ordered list rather than switching implicitly.
            logger.warn({
                msg: '[Model fallback] Could not resolve approved provider key',
                userId,
                provider: candidate.provider,
                modelName: candidate.modelName,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    return null;
};
