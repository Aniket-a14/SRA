import { genAI } from '../../config/gemini.js';

// Platform-hosted default — the only provider allowed to fall back to the
// platform's own key (see providerKeyService.js). Every other adapter
// requires the user's own key.
export const DEFAULT_MODEL = process.env.GEMINI_MODEL_NAME || 'gemini-2.5-flash';

export class GeminiAdapter {
    // No apiKey param: genAI is constructed once at boot from the platform's
    // own GEMINI_API_KEY — per-user Gemini keys aren't supported, since Gemini
    // is the fixed embedding provider and platform fallback.
    constructor() {
        this.client = genAI;
    }

    async generateContent({ prompt, systemInstruction, temperature, maxOutputTokens, jsonMode, responseSchema, modelName }) {
        const model = this.client.getGenerativeModel({
            model: modelName || DEFAULT_MODEL,
            ...(systemInstruction && { systemInstruction }),
            generationConfig: {
                temperature,
                maxOutputTokens,
                responseMimeType: jsonMode ? 'application/json' : 'text/plain',
                ...(responseSchema && { responseSchema })
            }
        });
        const result = await model.generateContent(prompt);
        return result.response.text();
    }

    /** Plain-text token stream for conversational replies (ChatAgent.chatStream) — jsonMode is never used here. */
    async *generateContentStream({ prompt, systemInstruction, temperature, maxOutputTokens, modelName }) {
        const model = this.client.getGenerativeModel({
            model: modelName || DEFAULT_MODEL,
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
        const model = this.client.getGenerativeModel({ model: modelName || DEFAULT_MODEL });
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
