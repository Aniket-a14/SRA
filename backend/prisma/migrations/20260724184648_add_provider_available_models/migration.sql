-- Cache of generation-capable models discovered when a provider key is verified
-- (see backend/src/services/modelDiscovery.js). Nullable + additive: safe on existing rows.
ALTER TABLE "UserProviderKey" ADD COLUMN "availableModels" JSONB;
