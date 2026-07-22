import Anthropic from '@anthropic-ai/sdk';

export const DEFAULT_MODEL = process.env.CLAUDE_MODEL_NAME || 'claude-opus-4-8';

export class ClaudeAdapter {
    constructor(apiKey) {
        if (!apiKey) {
            throw new Error('Claude API key is required — add one in Settings before selecting Claude as the provider.');
        }
        this.client = new Anthropic({ apiKey });
    }

    async generateContent({ prompt, systemInstruction, temperature, maxOutputTokens, jsonMode, modelName }) {
        const message = await this.client.messages.create({
            model: modelName || DEFAULT_MODEL,
            max_tokens: maxOutputTokens || 4096,
            // Disabled rather than adaptive: this call is used for structured JSON
            // generation with a fixed max_tokens budget tuned for the JSON payload
            // size — adaptive thinking would compete with the output for that budget.
            thinking: { type: 'disabled' },
            ...(temperature !== undefined && { temperature }),
            ...(systemInstruction && { system: systemInstruction }),
            messages: [
                {
                    role: 'user',
                    content: jsonMode
                        ? `${prompt}\n\nRespond with valid JSON only — no markdown code fences, no commentary.`
                        : prompt
                }
            ]
        });

        return message.content
            .filter(block => block.type === 'text')
            .map(block => block.text)
            .join('');
    }

    /** Plain-text token stream for conversational replies (ChatAgent.chatStream) — jsonMode is never used here. */
    async *generateContentStream({ prompt, systemInstruction, temperature, maxOutputTokens, modelName }) {
        const stream = this.client.messages.stream({
            model: modelName || DEFAULT_MODEL,
            max_tokens: maxOutputTokens || 4096,
            thinking: { type: 'disabled' },
            ...(temperature !== undefined && { temperature }),
            ...(systemInstruction && { system: systemInstruction }),
            messages: [{ role: 'user', content: prompt }]
        });

        for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                yield event.delta.text;
            }
        }
    }

    async countTokens(text, modelName) {
        const result = await this.client.messages.countTokens({
            model: modelName || DEFAULT_MODEL,
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
