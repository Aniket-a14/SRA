import { genAI } from "../../config/gemini.js";
import { getEmbeddingModel, getEmbeddingDimensions } from "../../config/models.js";
import { getRedisClient } from "../../config/redis.js";
import { createHash } from "crypto";
import logger from "../../config/logger.js";

/**
 * Serializes float array to compact binary base64 string
 */
function floatsToBase64(floats) {
    const buffer = Buffer.from(new Float32Array(floats).buffer);
    return buffer.toString('base64');
}

/**
 * Deserializes compact binary base64 string back to array of numbers
 */
function base64ToFloats(base64Str) {
    const buffer = Buffer.from(base64Str, 'base64');
    const floatArray = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / Float32Array.BYTES_PER_ELEMENT);
    return Array.from(floatArray);
}

export async function embedText(text, retries = 3, initialDelay = 2000) {
    const redis = getRedisClient();
    let cacheKey = null;

    // 1. Try to fetch from Semantic Cache
    if (redis) {
        try {
            const hash = createHash("sha256").update(text).digest("hex");
            cacheKey = `cache:embed:bin:${hash}`;
            const cachedValue = await redis.get(cacheKey);
            if (cachedValue) {
                return base64ToFloats(cachedValue);
            }
        } catch (cacheError) {
            logger.warn({ msg: "[Embedding Service] Cache read error", error: cacheError.message });
        }
    }

    let attempt = 0;
    let delay = initialDelay;

    while (attempt < retries) {
        try {
            const model = genAI.getGenerativeModel({ model: getEmbeddingModel() });
            const result = await model.embedContent({
                content: { parts: [{ text }] },
                outputDimensionality: getEmbeddingDimensions()
            });

            const embedding = result.embedding.values;

            // 2. Store compact binary representation in Cache (7 Day TTL)
            if (redis && cacheKey) {
                try {
                    await redis.set(cacheKey, floatsToBase64(embedding), "EX", 604800);
                } catch (cacheSetError) {
                    logger.warn({ msg: "[Embedding Service] Cache write error", error: cacheSetError.message });
                }
            }

            return embedding;
        } catch (error) {
            attempt++;
            const isRetryable = error.message?.includes("fetch failed") || error.message?.includes("ECONNREFUSED") || error.message?.includes("ETIMEDOUT") || error.message?.includes("UND_ERR_CONNECT_TIMEOUT") || error.message?.includes("429") || error.message?.includes("503");

            if (isRetryable && attempt < retries) {
                logger.warn({ msg: `[Embedding Service] Retryable error. Retrying in ${delay}ms...`, error: error.message, attempt, retries });
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2;
                continue;
            }

            logger.error({ msg: "[Embedding Service] FATAL: All retries exhausted for Gemini Embedding endpoint.", error: error.message });
            throw error;
        }
    }

    throw new Error("[Embedding Service] All retry attempts exhausted without a successful response.");
}

/**
 * Batch embed multiple texts concurrently using batchEmbedContents
 */
export async function embedBatch(texts, retries = 3) {
    if (!Array.isArray(texts) || texts.length === 0) return [];
    if (texts.length === 1) return [await embedText(texts[0], retries)];

    const results = new Array(texts.length);
    const missingIndices = [];
    const missingTexts = [];
    const redis = getRedisClient();

    // Check cache for each text
    if (redis) {
        for (let i = 0; i < texts.length; i++) {
            try {
                const hash = createHash("sha256").update(texts[i]).digest("hex");
                const cached = await redis.get(`cache:embed:bin:${hash}`);
                if (cached) {
                    results[i] = base64ToFloats(cached);
                } else {
                    missingIndices.push(i);
                    missingTexts.push(texts[i]);
                }
            } catch {
                missingIndices.push(i);
                missingTexts.push(texts[i]);
            }
        }
    } else {
        for (let i = 0; i < texts.length; i++) {
            missingIndices.push(i);
            missingTexts.push(texts[i]);
        }
    }

    if (missingTexts.length === 0) {
        return results;
    }

    try {
        const model = genAI.getGenerativeModel({ model: getEmbeddingModel() });
        const batchResponse = await model.batchEmbedContents({
            requests: missingTexts.map(text => ({
                content: { parts: [{ text }] },
                outputDimensionality: getEmbeddingDimensions()
            }))
        });

        const embeddings = batchResponse.embeddings || [];
        for (let j = 0; j < missingTexts.length; j++) {
            const originalIndex = missingIndices[j];
            const emb = embeddings[j]?.values || [];
            results[originalIndex] = emb;

            if (redis && emb.length > 0) {
                const hash = createHash("sha256").update(missingTexts[j]).digest("hex");
                redis.set(`cache:embed:bin:${hash}`, floatsToBase64(emb), "EX", 604800).catch(() => {});
            }
        }
    } catch (batchErr) {
        logger.warn({ msg: "[Embedding Service] Batch embed failed, falling back to sequential", error: batchErr.message });
        for (let k = 0; k < missingTexts.length; k++) {
            const originalIndex = missingIndices[k];
            results[originalIndex] = await embedText(missingTexts[k], retries);
        }
    }

    return results;
}
