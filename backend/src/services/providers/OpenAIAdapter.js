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

    /** Token stream: plain text for chat replies, JSON for the live SRS drafting view. */
    async *generateContentStream({ prompt, systemInstruction, temperature, maxOutputTokens, jsonMode, modelName }) {
        // withResponse() so a streamed call still records rate-limit headers for the quota service.
        this.lastRateLimit = null;
        const { data: stream, response } = await this.client.chat.completions.create({
            model: modelName || DEFAULT_MODEL(),
            messages: [
                ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
                { role: 'user', content: prompt }
            ],
            temperature,
            max_tokens: maxOutputTokens,
            response_format: jsonMode ? { type: 'json_object' } : undefined,
            stream: true
        }).withResponse();

        this.lastRateLimit = parseRateLimitHeaders(response?.headers);

        let finishReason = null;
        for await (const chunk of stream) {
            const choice = chunk.choices?.[0];
            if (choice?.finish_reason) finishReason = choice.finish_reason;
            const delta = choice?.delta?.content;
            if (delta) yield delta;
        }

        // JSON only — see the note in GeminiAdapter.generateContentStream.
        if (jsonMode) {
            assertNotTruncated(finishReason, {
                provider: 'OpenAI',
                modelName: modelName || DEFAULT_MODEL(),
                maxOutputTokens
            });
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
