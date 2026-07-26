import { GoogleGenerativeAI } from '@google/generative-ai';
import { genAI } from '../../config/gemini.js';
import { getDefaultModel } from '../../config/models.js';
import { assertNotTruncated } from '../../utils/truncationError.js';

/** Resolved from GEMINI_MODEL_NAME at call time — no model id is hardcoded here. */
const DEFAULT_MODEL = () => getDefaultModel('GEMINI');

export class GeminiAdapter {
    // Every Gemini call the platform makes on a user's behalf runs on that user's own
    // key (BYOK) — generation, validation, auto-fix, alignment, refinement, diagram
    // repair, graph extraction. The platform's GEMINI_API_KEY funds embeddings only,
    // because the pgvector columns are one shared embedding space that cannot be
    // per-user. The `genAI` fallback below is therefore reached only by the MOCK_AI
    // path, which never actually calls out.
    constructor(apiKey = null) {
        this.client = apiKey ? new GoogleGenerativeAI(apiKey) : genAI;
        /**
         * Always null for Gemini, and deliberately present anyway so every adapter has the
         * same surface. Gemini sends no rate-limit headers and offers no usage endpoint — its
         * 429 points at the AI Studio dashboard — so the only figure available is the one
         * modelQuotaService counts, which is why Gemini rows are recorded as COUNTED.
         */
        this.lastRateLimit = null;
    }

    async generateContent({ prompt, systemInstruction, temperature, maxOutputTokens, jsonMode, responseSchema, modelName }) {
        const model = this.client.getGenerativeModel({
            model: modelName || DEFAULT_MODEL(),
            ...(systemInstruction && { systemInstruction }),
            generationConfig: {
                temperature,
                maxOutputTokens,
                responseMimeType: jsonMode ? 'application/json' : 'text/plain',
                ...(responseSchema && { responseSchema })
            }
        });
        const result = await model.generateContent(prompt);

        // `text()` happily returns the partial payload when generation stopped at the
        // token ceiling, which is how a cut-off SRS section used to reach the JSON
        // repair pipeline and get "fixed" into a valid but shorter document.
        assertNotTruncated(result.response?.candidates?.[0]?.finishReason, {
            provider: 'Gemini',
            modelName: modelName || DEFAULT_MODEL(),
            maxOutputTokens
        });

        return result.response.text();
    }

    /** Plain-text token stream for conversational replies (ChatAgent.chatStream) — jsonMode is never used here. */
    async *generateContentStream({ prompt, systemInstruction, temperature, maxOutputTokens, modelName }) {
        const model = this.client.getGenerativeModel({
            model: modelName || DEFAULT_MODEL(),
            ...(systemInstruction && { systemInstruction }),
            generationConfig: { temperature, maxOutputTokens, responseMimeType: 'text/plain' }
        });
        const { stream } = await model.generateContentStream(prompt);
        for await (const chunk of stream) {
            const text = chunk.text();
            if (text) yield text;
        }
    }

    async countTokens(text, modelName) {
        const model = this.client.getGenerativeModel({ model: modelName || DEFAULT_MODEL() });
        const { totalTokens } = await model.countTokens(text);
        return totalTokens;
    }

    classifyError(error) {
        const status = error.status || error.errorCode || (error.message?.match(/\[(\d+)\]/) || [])[1];
        return {
            isRateLimit: status == 429 || error.message?.includes('429') || error.message?.includes('Quota exceeded'),
            isServerError: status >= 500 && status < 600,
            isAuthError: status == 401 || status == 403 || error.message?.includes('API key')
        };
    }
}
