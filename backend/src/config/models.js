/**
 * Single source of truth for every model id the backend sends to a provider.
 *
 * Nothing here is hardcoded on purpose. Providers retire and rename models on their own
 * schedule — a live probe of a free-tier Gemini key found `gemini-2.5-flash-lite` already
 * 404-ing for new keys and every `*-pro` model returning 429 with no free quota — so
 * swapping a model must be an environment edit plus a restart, never a code change.
 *
 * Resolution is lazy (functions, not module-scope constants) so importing this file never
 * throws; a missing variable surfaces at the moment a model is actually needed, naming the
 * exact variable to set.
 */

/**
 * Read a model id from the environment, or fail with a message that says exactly what to set.
 * @param {string} varName
 * @param {string} purpose - human description used in the error
 */
const requireModelEnv = (varName, purpose) => {
    const value = process.env[varName]?.trim();
    if (!value) {
        throw new Error(
            `[models] ${varName} is not set — it is required for ${purpose}. ` +
            `Model ids are configuration, not code: add ${varName} to the backend environment (see backend/.env.example).`
        );
    }
    return value;
};

/**
 * Default generation model for a provider. SRA is BYOK: the platform never picks a model on
 * a user's behalf, so only GEMINI has a server-side default here, and only because the
 * platform runs its own Gemini calls (embeddings, utility work) with its own key. OpenAI,
 * Claude and Grok have no platform key and no platform default — a request against one of
 * them must always name its model, or it is rejected before it ever reaches this function
 * (see `clientAiSettingsSchema` in `utils/validationSchemas.js`). Reaching this function for
 * a non-Gemini provider means that guard was bypassed, so it fails loud rather than guessing.
 * @param {'GEMINI'|'OPENAI'|'CLAUDE'|'GROK'} provider
 */
export const getDefaultModel = (provider) => {
    if (provider !== 'GEMINI') {
        throw new Error(
            `[models] ${provider} has no server-side default model — SRA is BYOK for ${provider}. ` +
            `The caller must supply modelName from the user's own settings.`
        );
    }
    return requireModelEnv('GEMINI_MODEL_NAME', 'GEMINI generation');
};

/**
 * Cheap/fast Gemini model for internal utility work (knowledge-graph extraction and
 * similar non-user-facing calls). Falls back to the main Gemini model when unset so a
 * deployment only has to configure it if it wants the split.
 */
export const getUtilityModel = () =>
    process.env.GEMINI_UTILITY_MODEL_NAME?.trim() || getDefaultModel('GEMINI');

/**
 * Embedding model. Always Gemini and always the platform key — the pgvector column is a
 * fixed width, so mixing embedding models across rows silently corrupts cosine similarity.
 */
export const getEmbeddingModel = () => requireModelEnv('GEMINI_EMBEDDING_MODEL', 'RAG embeddings');

/**
 * Output width requested from the embedding model. MUST match the `vector(N)` width of
 * KnowledgeChunk.embedding / Analysis.vectorSignature in prisma/schema.prisma — changing
 * it requires a migration plus a re-embed of every stored row.
 */
export const getEmbeddingDimensions = () => {
    const raw = requireModelEnv('GEMINI_EMBEDDING_DIMENSIONS', 'RAG embeddings');
    const dimensions = Number.parseInt(raw, 10);
    if (!Number.isInteger(dimensions) || dimensions <= 0) {
        throw new Error(`[models] GEMINI_EMBEDDING_DIMENSIONS must be a positive integer (got "${raw}")`);
    }
    return dimensions;
};
