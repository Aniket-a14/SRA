import { genAI } from "../config/gemini.js";

export async function embedText(text, retries = 3, initialDelay = 2000) {
    let attempt = 0;
    let delay = initialDelay;

    while (attempt < retries) {
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
            const result = await model.embedContent(text);
            return result.embedding.values;
        } catch (error) {
            attempt++;
            const isNetworkError = error.message?.includes("fetch failed") || error.message?.includes("ECONNREFUSED") || error.message?.includes("ETIMEDOUT") || error.message?.includes("UND_ERR_CONNECT_TIMEOUT");

            if (isNetworkError && attempt < retries) {
                console.warn(`[Embedding Service] Network error (${error.message}). Retrying in ${delay}ms... (Attempt ${attempt}/${retries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2;
                continue;
            }

            console.error("[Embedding Service] FATAL: Persistent connectivity issue with Gemini Embedding endpoint.");
            console.error("[Embedding Service] Details:", error.message);
            throw error;
        }
    }
}
