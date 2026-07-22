import { listProviderKeys, upsertProviderKey, deleteProviderKey } from '../services/providerKeyService.js';
import { successResponse } from '../utils/response.js';

export const getProviderKeys = async (req, res, next) => {
    try {
        const keys = await listProviderKeys(req.user.userId);
        return successResponse(res, keys);
    } catch (error) {
        next(error);
    }
};

export const putProviderKey = async (req, res, next) => {
    try {
        const { provider, apiKey, label } = req.body;
        const saved = await upsertProviderKey(req.user.userId, provider, apiKey, label);
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
