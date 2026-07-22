import { jsonrepair } from 'jsonrepair';
import logger from '../config/logger.js';
import { OUTPUT_TOKEN_LIMITS } from '../utils/llmGenerationConfig.js';
import { getAdapter, DEFAULT_MODELS, normalizeProvider } from '../services/providers/index.js';

export class BaseAgent {
    /**
     * @param {string} name - agent display name, used only for logging
     * @param {object} [providerConfig]
     * @param {string} [providerConfig.provider] - GEMINI | OPENAI | CLAUDE | GROK; defaults to GEMINI
     * @param {string} [providerConfig.modelName] - defaults to the provider's DEFAULT_MODELS entry
     * @param {string} [providerConfig.apiKey] - decrypted user key; unused for GEMINI (shared platform client)
     */
    constructor(name, providerConfig = {}) {
        this.name = name;
        const { provider, modelName, apiKey } = providerConfig;
        this.provider = normalizeProvider(provider);
        this.modelName = modelName || DEFAULT_MODELS[this.provider];
        this._apiKey = apiKey;
        this._adapter = null; // lazily constructed — see getAdapter() below, so a missing
        // non-Gemini key only throws when a real (non-mocked) LLM call is actually made
    }

    getAdapter() {
        if (!this._adapter) {
            this._adapter = getAdapter(this.provider, this._apiKey);
        }
        return this._adapter;
    }

    async callLLM(prompt, temperature = 0.7, jsonMode = true, responseSchema = null, retries = 3, initialDelay = 5000, options = {}) {
        logger.debug({ msg: `[${this.name}] Calling LLM`, model: this.modelName });

        if (process.env.MOCK_AI === 'true') {
            logger.warn(`[${this.name}] MOCK MODE ACTIVE. Returning dummy response.`);
            await new Promise(resolve => setTimeout(resolve, 100));
            if (jsonMode) {
                // Return a generic valid JSON structure that hopefully satisfies most agents
                return {
                    projectTitle: "Mocked Project",
                    scopeSummary: "This is a mocked scope summary for testing purposes.",
                    features: [
                        { name: "Mock Feature", description: "This is a mock description.", priority: "High" }
                    ],
                    userStories: [
                        { role: "As a user", action: "I want to test", benefit: "the system works", acceptanceCriteria: ["Test 1", "Test 2"] }
                    ],
                    // Lead Developer / Architect specific fields
                    systemArchitecture: { tier: "3-tier", components: ["Frontend", "Backend", "DB"] },
                    introduction: { purpose: "Mocked purpose", scope: "Mocked scope" },
                    systemFeatures: [],
                    nonFunctionalRequirements: {
                        performance: ["Fast"],
                        security: ["Secure"]
                    },
                    // Reviewer / Critic specific fields
                    score: 85,
                    status: "APPROVED",
                    feedback: [],
                    overallScore: 90,
                    criticalIssues: [],
                    suggestions: [],
                    scores: {
                        clarity: 90, completeness: 80, conciseness: 90, consistency: 80, correctness: 90, context: 80
                    },
                    // Eval Service (RAG) specific fields
                    faithfulness: 90,
                    contextPrecision: 80,
                    answerRelevancy: 90,
                    reasoning: "Mocked reasoning"
                };
            }
            return "This is a mocked text response.";
        }

        let attempt = 0;
        let delay = initialDelay;
        const TIMEOUT_MS = 360000; // 6 minutes

        const callWithTimeout = (promise, ms) => Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error("AI Request Timeout")), ms))
        ]);

        const adapter = this.getAdapter();

        while (true) {
            try {
                const text = await callWithTimeout(adapter.generateContent({
                    prompt,
                    modelName: this.modelName,
                    systemInstruction: options.systemInstruction,
                    temperature,
                    maxOutputTokens: options.maxOutputTokens || OUTPUT_TOKEN_LIMITS.mediumJson,
                    jsonMode,
                    responseSchema
                }), TIMEOUT_MS);

                if (jsonMode) {
                    return this.parseJSON(text);
                }
                return text;

            } catch (error) {
                const isTimeout = error.message === "AI Request Timeout";
                const { isRateLimit, isServerError } = isTimeout ? {} : adapter.classifyError(error);

                if ((isRateLimit || isServerError || isTimeout) && attempt < retries) {
                    const jitter = delay * 0.2 * (Math.random() * 2 - 1);
                    const finalDelay = Math.max(1000, delay + jitter);

                    logger.warn({
                        msg: `[${this.name}] LLM Retry`,
                        reason: isTimeout ? 'Timeout' : (isRateLimit ? 'Rate Limit' : 'Server Error'),
                        provider: this.provider,
                        attempt: attempt + 1,
                        retries,
                        nextRetryIn: Math.round(finalDelay)
                    });

                    await new Promise(resolve => setTimeout(resolve, finalDelay));
                    delay *= 2;
                    attempt++;
                } else {
                    const isFetchFailed = error.message?.includes("fetch failed");
                    logger.error({ msg: `[${this.name}] LLM Call Failed`, provider: this.provider, error: error.message });
                    if (isFetchFailed) {
                        logger.fatal(`[${this.name}] FATAL: Unable to reach ${this.provider} servers. Check network/proxy.`);
                    }
                    throw new Error(`${this.name} failed to generate content: ${error.message}`);
                }
            }
        }
    }

    /**
     * Plain-text token stream — used by ChatAgent.chatStream for the conversational
     * reply half of a chat turn. Deliberately no retry/backoff here (unlike callLLM):
     * once tokens have started reaching the client, transparently retrying the whole
     * call isn't meaningful — a mid-stream failure just ends the stream with an error.
     */
    async *streamText(prompt, options = {}) {
        logger.debug({ msg: `[${this.name}] Streaming LLM`, model: this.modelName });

        if (process.env.MOCK_AI === 'true') {
            const mockReply = options.mockText || 'This is a mocked streaming reply.';
            for (const word of mockReply.split(' ')) {
                await new Promise(resolve => setTimeout(resolve, 10));
                yield `${word} `;
            }
            return;
        }

        const adapter = this.getAdapter();
        try {
            for await (const chunk of adapter.generateContentStream({
                prompt,
                modelName: this.modelName,
                systemInstruction: options.systemInstruction,
                temperature: options.temperature,
                maxOutputTokens: options.maxOutputTokens || OUTPUT_TOKEN_LIMITS.mediumJson
            })) {
                yield chunk;
            }
        } catch (error) {
            logger.error({ msg: `[${this.name}] Streaming LLM Call Failed`, provider: this.provider, error: error.message });
            throw new Error(`${this.name} failed to stream content: ${error.message}`);
        }
    }

    async countTokens(text) {
        try {
            return await this.getAdapter().countTokens(text, this.modelName);
        } catch (error) {
            logger.error({ msg: `[${this.name}] countTokens failed`, error: error.message });
            return 0; // Fallback
        }
    }

    parseJSON(text) {
        let cleanText = text;
        try {
            // 1. Remove markdown code blocks if present
            cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();

            // 2. Robust Extraction: Find the first '{' and the last '}'
            const firstBrace = cleanText.indexOf('{');
            const lastBrace = cleanText.lastIndexOf('}');

            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                cleanText = cleanText.substring(firstBrace, lastBrace + 1);
            }

            // 3. Pre-fix common LLM JSON hallucinations before repair
            // a) Remove accidentally doubled close braces or brackets followed by a comma
            cleanText = cleanText.replace(/\}\s*\}\s*,\s*\{/g, '}, {');
            cleanText = cleanText.replace(/\]\s*\]\s*,\s*\[/g, '], [');
            // b) Remove trailing commas before a closing brace/bracket
            cleanText = cleanText.replace(/,\s*\}/g, '}').replace(/,\s*\]/g, ']');
            // c) Fix missing colons in key-value pairs (very common in large Flash outputs)
            // Pattern: "key" "value" -> "key": "value"
            cleanText = cleanText.replace(/"([^"]+)"\s+"([^"]*)"/g, '"$1": "$2"');
            cleanText = cleanText.replace(/"([^"]+)"\s+([0-9.]+)/g, '"$1": $2');
            cleanText = cleanText.replace(/"([^"]+)"\s+(true|false|null)/g, '"$1": $2');

            // 4. Handle Truncation: If the JSON is obviously truncated (unbalanced braces)
            let openBraces = (cleanText.match(/\{/g) || []).length;
            let closeBraces = (cleanText.match(/\}/g) || []).length;
            if (openBraces > closeBraces) {
                const truncationSnippet = cleanText.substring(cleanText.length - 100);
                logger.warn({
                    msg: `[${this.name}] Detected truncated JSON. Attempting to auto-balance.`,
                    open: openBraces,
                    close: closeBraces,
                    missing: openBraces - closeBraces,
                    tailContent: `...${truncationSnippet}`
                });
                cleanText += '}'.repeat(openBraces - closeBraces);
            }

            // 5. Use professional jsonrepair library for fault-tolerant parsing
            try {
                const repaired = jsonrepair(cleanText);
                return JSON.parse(repaired);
            } catch (repairError) {
                // If repair fails, try one last time with primitive JSON.parse
                return JSON.parse(cleanText);
            }
        } catch (error) {
            logger.error({ msg: `[${this.name}] JSON Parsing Failed`, error: error.message });

            // Helpful debugging: show where it failed if possible
            if (error.message.includes('at position')) {
                const posStr = error.message.match(/at position (\d+)/);
                if (posStr) {
                    const pos = parseInt(posStr[1]);
                    const start = Math.max(0, pos - 50);
                    const end = Math.min(cleanText.length, pos + 50);
                    logger.debug({
                        msg: 'JSON Parse Context',
                        position: pos,
                        contextSnippet: '...' + cleanText.substring(start, pos) + ' >>> ' + (cleanText[pos] || '') + ' <<< ' + cleanText.substring(pos + 1, end) + '...'
                    });
                }
            }

            throw new Error(`${this.name} failed to parse JSON output. ${error.message}`);
        }
    }
}
