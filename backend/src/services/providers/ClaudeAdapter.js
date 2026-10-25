import Anthropic from '@anthropic-ai/sdk';
import { getDefaultModel } from '../../config/models.js';
import { assertNotTruncated } from '../../utils/truncationError.js';
import { parseRateLimitHeaders } from '../../utils/rateLimitHeaders.js';
import { claudeRequestFields, assertNotRefused } from './claudeModelRules.js';

/** No platform default — Claude is BYOK-only, so `modelName` must always come from the caller. */
const DEFAULT_MODEL = () => getDefaultModel('CLAUDE');

export class ClaudeAdapter {
    constructor(apiKey) {
        if (!apiKey) {
            throw new Error('Claude API key is required — add one in Settings before selecting Claude as the provider.');
        }
        this.client = new Anthropic({ apiKey });
        /** Rate-limit figures from the last response (anthropic-ratelimit-* headers). */
        this.lastRateLimit = null;
    }

    async generateContent({ prompt, systemInstruction, maxOutputTokens, jsonMode, modelName }) {
        const model = modelName || DEFAULT_MODEL();
        const { data: message, response } = await this.client.messages.create({
            model,
            max_tokens: maxOutputTokens || 4096,
            // Thinking kept off (or as low as the model allows) so it does not compete with
            // the JSON payload for this fixed max_tokens budget. No temperature: API version
            // 2026-10-21 rejects sampling parameters on every model (claudeModelRules.js).
            ...claudeRequestFields(model),
            ...(systemInstruction && { system: systemInstruction }),
            messages: [
                {
                    role: 'user',
                    content: jsonMode
                        ? `${prompt}\n\nRespond with valid JSON only — no markdown code fences, no commentary.`
                        : prompt
                }
            ]
        }).withResponse();

        this.lastRateLimit = parseRateLimitHeaders(response?.headers);

        assertNotRefused(message, model);
        assertNotTruncated(message.stop_reason, {
            provider: 'Claude',
            modelName: modelName || DEFAULT_MODEL(),
            maxOutputTokens: maxOutputTokens || 4096
        });

        return message.content
            .filter(block => block.type === 'text')
            .map(block => block.text)
            .join('');
    }

    /** Token stream: plain text for chat replies, JSON for the live SRS drafting view. */
    async *generateContentStream({ prompt, systemInstruction, maxOutputTokens, jsonMode, modelName, signal }) {
        const model = modelName || DEFAULT_MODEL();
        const stream = this.client.messages.stream({
            model,
            max_tokens: maxOutputTokens || 4096,
            ...claudeRequestFields(model),
            ...(systemInstruction && { system: systemInstruction }),
            messages: [
                {
                    role: 'user',
                    content: jsonMode
                        ? `${prompt}\n\nRespond with valid JSON only — no markdown code fences, no commentary.`
                        : prompt
                }
            ]
        }, { signal });

        this.lastRateLimit = null;

        for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                yield event.delta.text;
            }
        }

        // Read after the loop — MessageStream.response is populated once connected.
        this.lastRateLimit = parseRateLimitHeaders(stream.response?.headers);

        // JSON only — see the note in GeminiAdapter.generateContentStream.
        if (jsonMode) {
            const finished = await stream.finalMessage();
            assertNotRefused(finished, model);
            assertNotTruncated(finished?.stop_reason, {
                provider: 'Claude',
                modelName: modelName || DEFAULT_MODEL(),
                maxOutputTokens: maxOutputTokens || 4096
            });
        }
    }

    async countTokens(text, modelName) {
        const result = await this.client.messages.countTokens({
            model: modelName || DEFAULT_MODEL(),
            messages: [{ role: 'user', content: text }]
        });
        return result.input_tokens;
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
