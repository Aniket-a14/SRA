import { listProviderKeys, upsertProviderKey, deleteProviderKey } from '../services/providers/providerKeyService.js';
import { discoverModels, ModelDiscoveryError } from '../services/providers/modelDiscovery.js';
import { successResponse } from '../utils/response.js';

export const getProviderKeys = async (req, res, next) => {
    try {
        const keys = await listProviderKeys(req.user.userId);
        return successResponse(res, keys);
    } catch (error) {
        next(error);
    }
};

/**
 * Verify a pasted key WITHOUT storing it, returning the models it can use.
 * Powers the "paste key → see your models" UX before the user commits to saving.
 */
export const verifyProviderKey = async (req, res, next) => {
    try {
        const { provider, apiKey } = req.body;
        const { models } = await discoverModels(provider, apiKey);
        return successResponse(res, { valid: true, models }, 'Key verified');
    } catch (error) {
        if (error instanceof ModelDiscoveryError) {
            error.statusCode = error.statusCode || 400;
        }
        next(error);
    }
};

export const putProviderKey = async (req, res, next) => {
    try {
        const { provider, apiKey, label } = req.body;

        // Verify the key against the provider before persisting it. An auth failure
        // rejects the save outright; a transient list-endpoint failure still lets a
        // valid key through (with no cached models) rather than blocking the user.
        let availableModels = null;
        try {
            const result = await discoverModels(provider, apiKey);
            availableModels = result.models;
        } catch (error) {
            if (error instanceof ModelDiscoveryError && error.kind === 'auth') {
                error.statusCode = 400;
                throw error;
            }
            // Non-auth (network/5xx): save the key, leave models to be discovered later.
        }

        const saved = await upsertProviderKey(req.user.userId, provider, apiKey, label, availableModels);
        return successResponse(res, saved, 'Provider key saved');
    } catch (error) {
        error.statusCode = error.statusCode || 400;
        next(error);
    }
};

export const removeProviderKey = async (req, res, next) => {
    try {
        const { provider } = req.params;
        await deleteProviderKey(req.user.userId, provider);
        return successResponse(res, {}, 'Provider key removed');
    } catch (error) {
        next(error);
    }
};
