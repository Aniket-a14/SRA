import OpenAI from 'openai';

export const DEFAULT_MODEL = process.env.OPENAI_MODEL_NAME || 'gpt-5.6';

export class OpenAIAdapter {
    constructor(apiKey) {
        if (!apiKey) {
            throw new Error('OpenAI API key is required — add one in Settings before selecting OpenAI as the provider.');
        }
        this.client = new OpenAI({ apiKey });
    }

    async generateContent({ prompt, systemInstruction, temperature, maxOutputTokens, jsonMode, modelName }) {
        const completion = await this.client.chat.completions.create({
            model: modelName || DEFAULT_MODEL,
            messages: [
                ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
                { role: 'user', content: prompt }
            ],
            temperature,
            max_tokens: maxOutputTokens,
            response_format: jsonMode ? { type: 'json_object' } : undefined
        });
        return completion.choices[0].message.content;
    }

    /** Plain-text token stream for conversational replies (ChatAgent.chatStream) — jsonMode is never used here. */
    async *generateContentStream({ prompt, systemInstruction, temperature, maxOutputTokens, modelName }) {
        const stream = await this.client.chat.completions.create({
            model: modelName || DEFAULT_MODEL,
            messages: [
                ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
                { role: 'user', content: prompt }
            ],
            temperature,
            max_tokens: maxOutputTokens,
            stream: true
        });

        for await (const chunk of stream) {
            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) yield delta;
        }
    }

    async countTokens(text) {
        // No first-class token-count endpoint on the Chat Completions API — use the
        // same length/4 heuristic ragService.js already uses elsewhere in this codebase.
        return Math.ceil((text?.length || 0) / 4);
    }

    classifyError(error) {
        const status = error.status;
        return {
            isRateLimit: status === 429,
            isServerError: status >= 500 && status < 600,
            isAuthError: status === 401 || status === 403
        };
    }
}
