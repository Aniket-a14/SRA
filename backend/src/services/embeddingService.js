import { genAI } from "../config/gemini.js";
import { getRedisClient } from "../config/redis.js";
import { createHash } from "crypto";
import logger from "../config/logger.js";

export async function embedText(text, retries = 3, initialDelay = 2000) {
    const redis = getRedisClient();
    let cacheKey = null;

    // 1. Try to fetch from Semantic Cache
    if (redis) {
        try {
            const hash = createHash("sha256").update(text).digest("hex");
            cacheKey = `cache:embed:${hash}`;
            const cachedValue = await redis.get(cacheKey);
            if (cachedValue) {
                return JSON.parse(cachedValue);
            }
        } catch (cacheError) {
            logger.warn({ msg: "[Embedding Service] Cache read error", error: cacheError.message });
        }
    }

    let attempt = 0;
    let delay = initialDelay;

    while (attempt < retries) {
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
            const result = await model.embedContent({
                content: { parts: [{ text }] },
                outputDimensionality: 768
            });
            
            const embedding = result.embedding.values;

            // 2. Store in Cache for future use (7 Day TTL)
            if (redis && cacheKey) {
                try {
                    await redis.set(cacheKey, JSON.stringify(embedding), "EX", 604800);
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

    // Safety net: if while loop exits without returning (all retries hit network errors)
    throw new Error("[Embedding Service] All retry attempts exhausted without a successful response.");
}
