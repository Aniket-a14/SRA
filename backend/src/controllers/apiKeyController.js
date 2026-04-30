import { createApiKey, listApiKeys, revokeApiKey } from '../services/apiKeyService.js';

export const createKey = async (req, res, next) => {
    try {
        const { name } = req.body;
        if (!name) throw new Error("Key name required");
        const key = await createApiKey(req.user.userId, name);
        res.status(201).json(key);
    } catch (error) {
        next(error);
    }
};

export const listKeys = async (req, res, next) => {
    try {
        const page = Number.parseInt(req.query.page, 10) || 1;
        const limit = Number.parseInt(req.query.limit, 10) || 20;
        const keys = await listApiKeys(req.user.userId, { page, limit });
        res.json(keys);
    } catch (error) {
        next(error);
    }
};

export const revokeKey = async (req, res, next) => {
    try {
        const { id } = req.params;
        await revokeApiKey(id, req.user.userId);
        res.json({ message: "Key revoked" });
    } catch (error) {
        next(error);
    }
};
