import OpenAI from 'openai';
import { getDefaultModel } from '../../config/models.js';
import { assertNotTruncated } from '../../utils/truncationError.js';
import { parseRateLimitHeaders } from '../../utils/rateLimitHeaders.js';

/** Resolved from OPENAI_MODEL_NAME at call time — no model id is hardcoded here. */
const DEFAULT_MODEL = () => getDefaultModel('OPENAI');

export class OpenAIAdapter {
    constructor(apiKey) {
        if (!apiKey) {
            throw new Error('OpenAI API key is required — add one in Settings before selecting OpenAI as the provider.');
        }
        this.client = new OpenAI({ apiKey });
        /**
         * Rate-limit figures from the last response, for modelQuotaService to record.
         * Exposed as a property rather than folded into the return value because every caller
         * expects `generateContent` to resolve to the completion text; a fresh adapter is
         * constructed per call (see providers/index.js getAdapter), so there is no request
         * interleaving to worry about.
         */
        this.lastRateLimit = null;
    }

    async generateContent({ prompt, systemInstruction, temperature, maxOutputTokens, jsonMode, modelName }) {
        const { data: completion, response } = await this.client.chat.completions.create({
            model: modelName || DEFAULT_MODEL(),
            messages: [
                ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
                { role: 'user', content: prompt }
            ],
            temperature,
            max_tokens: maxOutputTokens,
            response_format: jsonMode ? { type: 'json_object' } : undefined
        }).withResponse();

        this.lastRateLimit = parseRateLimitHeaders(response?.headers);

        assertNotTruncated(completion.choices[0]?.finish_reason, {
            provider: 'OpenAI',
            modelName: modelName || DEFAULT_MODEL(),
            maxOutputTokens
        });

        return completion.choices[0].message.content;
    }

    /** Plain-text token stream for conversational replies (ChatAgent.chatStream) — jsonMode is never used here. */
    async *generateContentStream({ prompt, systemInstruction, temperature, maxOutputTokens, modelName }) {
        const stream = await this.client.chat.completions.create({
            model: modelName || DEFAULT_MODEL(),
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
