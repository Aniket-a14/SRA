import { genAI } from "../config/gemini.js";

export async function embedText(text) {
    try {
        const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
        const result = await model.embedContent(text);
        return result.embedding.values;
    } catch (error) {
        console.error("Embedding Error:", error);
        throw error;
    }
}
