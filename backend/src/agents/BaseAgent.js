import logger from '../config/logger.js';
import { repairAndParseJSON } from '../utils/jsonRepair.js';
import { isExhaustedQuota, buildExhaustedQuotaError } from '../utils/quotaErrors.js';
import { parseQuotaFailure, isPerDayQuota } from '../utils/rateLimitHeaders.js';
import { recordUsage, recordExhausted } from '../services/providers/modelQuotaService.js';
import { resolveOutputTokenLimits, clampOutputTokens } from '../utils/llmGenerationConfig.js';
import { getAdapter, DEFAULT_MODELS, normalizeProvider } from '../services/providers/index.js';
import { selectNextFallbackModel } from '../services/providers/modelFallbackService.js';

// One MOCK_AI answer, defined once so the streamed replay and the returned object cannot drift.
const MOCK_JSON_RESPONSE = {
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
    appendices: {
        analysisModels: {
            flowchartDiagram: {
                syntaxExplanation: "Mock workflow",
                code: "flowchart TD\n  A[Start] --> B[Complete]",
                caption: "Mock system workflow"
            },
            sequenceDiagram: {
                syntaxExplanation: "Mock interaction",
                code: "sequenceDiagram\n  User->>System: Request\n  System-->>User: Response",
                caption: "Mock user interaction"
            },
            entityRelationshipDiagram: {
                syntaxExplanation: "Mock data model",
                code: "erDiagram\n  USER ||--o{ PROJECT : owns",
                caption: "Mock data relationships"
            }
        },
        tbdList: []
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

const MOCK_TEXT_RESPONSE = "This is a mocked text response.";

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
        const { provider, modelName, apiKey, inputTokenLimit, outputTokenLimit, userId, allowModelFallback, fallbackModels } = providerConfig;
        // Whose key is being spent. Quota is tracked per user per model, so a run that
        // cannot say who it is for is simply not counted rather than counted against someone.
        this.userId = userId || null;
        this.provider = normalizeProvider(provider);
        this._modelName = modelName || null;
        this._apiKey = apiKey;
        // Real ceilings for the selected model, captured during key discovery. Undefined
        // for older key records — every consumer falls back to the static budgets.
        this.inputTokenLimit = inputTokenLimit;
        this.outputTokenLimit = outputTokenLimit;
        this.tokenLimits = resolveOutputTokenLimits(outputTokenLimit);
        // User-approved ordered fallback chain (see callLLM) — a call that keeps failing
        // against this provider switches to the next approved one instead of exhausting
        // its retry budget against a provider that predictably won't recover in time.
        this.allowModelFallback = allowModelFallback === true;
        this.fallbackModels = fallbackModels;
        this._adapter = null; // lazily constructed — see getAdapter() below, so a missing
        // non-Gemini key only throws when a real (non-mocked) LLM call is actually made
    }

    /**
     * Resolved lazily for the same reason the adapter is: model ids live in the environment
     * (config/models.js), and several services construct agents at module scope. Resolving in
     * the constructor would make merely importing them fail when a variable is unset — even
     * under MOCK_AI, where no model is ever used.
     */
    get modelName() {
        return this._modelName || DEFAULT_MODELS[this.provider];
    }

    set modelName(value) {
        this._modelName = value;
    }

    getAdapter() {
        if (!this._adapter) {
            this._adapter = getAdapter(this.provider, this._apiKey);
        }
        return this._adapter;
    }

    async callLLM(prompt, temperature = 0.7, jsonMode = true, responseSchema = null, retries = 3, initialDelay = 5000, options = {}) {
        // Mock check first: reading this.modelName resolves the env-backed default, which
        // mock runs neither have nor need.
        if (process.env.MOCK_AI === 'true') {
            logger.warn(`[${this.name}] MOCK MODE ACTIVE. Returning dummy response.`);
            await new Promise(resolve => setTimeout(resolve, 100));

            // Replay the canned answer as a stream, so MOCK_AI runs can exercise the live view.
            if (options.onStream) {
                const mockPayload = jsonMode ? JSON.stringify(MOCK_JSON_RESPONSE) : MOCK_TEXT_RESPONSE;
                for (let i = 0; i < mockPayload.length; i += 24) {
                    await new Promise(resolve => setTimeout(resolve, 15));
                    options.onStream({ type: 'delta', text: mockPayload.slice(i, i + 24) });
                }
            }

            // Cloned: agents mutate what they get back, and a shared object would leak edits.
            if (jsonMode) return structuredClone(MOCK_JSON_RESPONSE);
            return MOCK_TEXT_RESPONSE;
        }

        logger.debug({ msg: `[${this.name}] Calling LLM`, model: this.modelName });

        let attempt = 0;
        let delay = initialDelay;
        const TIMEOUT_MS = 360000; // 6 minutes

        const callWithTimeout = (promise, ms) => Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error("AI Request Timeout")), ms))
        ]);

        // Seeded with the starting provider/model so a fallback never re-offers the one
        // that just failed — refetched fresh each loop iteration below, since a fallback
        // mid-call swaps this.provider/this.modelName/this._apiKey in place.
        const attempted = [{ provider: this.provider, modelName: this.modelName }];

        while (true) {
            // Set when the timeout wins the race below, so an abandoned stream stops consuming.
            let streamAbandoned = false;
            const adapter = this.getAdapter();

            try {
                const request = {
                    prompt,
                    modelName: this.modelName,
                    systemInstruction: options.systemInstruction,
                    temperature,
                    // Clamped to the model's real ceiling: a budget above it is rejected by
                    // the provider, and a caller-supplied default sized for a larger model
                    // would otherwise truncate here.
                    maxOutputTokens: clampOutputTokens(
                        options.maxOutputTokens || this.tokenLimits.mediumJson,
                        this.outputTokenLimit
                    ),
                    jsonMode,
                    responseSchema
                };

                // A mode of callLLM, not a separate method: the retry/backoff/quota handling
                // around it is unchanged, so a rate limit mid-draft is still survivable.
                const consumeStream = async () => {
                    let full = '';
                    for await (const chunk of adapter.generateContentStream(request)) {
                        if (streamAbandoned) break;
                        full += chunk;
                        options.onStream({ type: 'delta', text: chunk });
                    }
                    return full;
                };

                const text = await callWithTimeout(
                    options.onStream ? consumeStream() : adapter.generateContent(request),
                    TIMEOUT_MS
                );

                // Observation of the call, never part of it — see modelQuotaService.
                void recordUsage({
                    userId: this.userId,
                    provider: this.provider,
                    modelName: this.modelName,
                    rateLimit: adapter.lastRateLimit
                });

                if (jsonMode) {
                    return this.parseJSON(text);
                }
                return text;

            } catch (error) {
                streamAbandoned = true;
                const isTimeout = error.message === "AI Request Timeout";
                const { isRateLimit, isServerError, isAuthError } = isTimeout ? {} : adapter.classifyError(error);

                // A per-day cap reads as a rate limit but never clears inside one run, so
                // retrying only spends the time budget the pipeline still needs. Fail now
                // and let the caller surface something the user can act on.
                // Provider SDKs do not agree on the HTTP status for exhausted credits: most
                // use 429, while some billing/credit responses use 402 or 400. The quota
                // classifier already distinguishes spent allowances from windowed limits,
                // so do not require the adapter to label every provider's status as 429.
                if (isExhaustedQuota(error)) {
                    logger.error({
                        msg: `[${this.name}] Daily quota exhausted — not retrying`,
                        provider: this.provider,
                        model: this.modelName
                    });
                    const { limit, retryAfterMs } = parseQuotaFailure(error);
                    void recordExhausted({
                        userId: this.userId,
                        provider: this.provider,
                        modelName: this.modelName,
                        limit,
                        retryAfterMs,
                        perDay: isPerDayQuota(error),
                        message: error.message
                    });
                    throw buildExhaustedQuotaError(error, this.modelName);
                }

                // Windowed rate limits and timeouts back off against the same provider
                // first — a per-minute window clears in seconds, and a slow call may
                // already be mid-generation, so switching provider mid-flight buys nothing.
                if ((isRateLimit || isTimeout) && attempt < retries) {
                    const jitter = delay * 0.2 * (Math.random() * 2 - 1);
                    const finalDelay = Math.max(1000, delay + jitter);

                    logger.warn({
                        msg: `[${this.name}] LLM Retry`,
                        reason: isTimeout ? 'Timeout' : 'Rate Limit',
                        provider: this.provider,
                        attempt: attempt + 1,
                        retries,
                        nextRetryIn: Math.round(finalDelay)
                    });

                    // Drop what the abandoned attempt drew; the retry's tokens must not append to it.
                    options.onStream?.({ type: 'reset' });

                    await new Promise(resolve => setTimeout(resolve, finalDelay));
                    delay *= 2;
                    attempt++;
                    continue;
                }

                // Overload/5xx, an auth error, or a rate limit whose same-provider retry
                // budget is spent: prefer the user's next approved model over hammering
                // (or, for auth, uselessly repeating a call against) the same provider —
                // an overloaded provider is unlikely to recover in the next few seconds,
                // and a rejected key never will.
                if ((isServerError || isAuthError || isRateLimit) && this.allowModelFallback) {
                    const candidate = await selectNextFallbackModel(
                        this.userId,
                        { allowModelFallback: true, fallbackModels: this.fallbackModels, modelProvider: this.provider, modelName: this.modelName },
                        attempted
                    ).catch((lookupErr) => {
                        logger.warn({ msg: `[${this.name}] Fallback lookup failed`, error: lookupErr.message });
                        return null;
                    });

                    if (candidate) {
                        logger.warn({
                            msg: `[${this.name}] Falling back to next approved provider`,
                            from: `${this.provider}:${this.modelName}`,
                            to: `${candidate.provider}:${candidate.modelName}`,
                            reason: isServerError ? 'server_error' : isAuthError ? 'auth_error' : 'rate_limit'
                        });
                        attempted.push({ provider: candidate.provider, modelName: candidate.modelName });
                        this.provider = candidate.provider;
                        this.modelName = candidate.modelName;
                        this._apiKey = candidate.apiKey;
                        this.inputTokenLimit = candidate.inputTokenLimit;
                        this.outputTokenLimit = candidate.outputTokenLimit;
                        this.tokenLimits = resolveOutputTokenLimits(candidate.outputTokenLimit);
                        this._adapter = null; // rebuilt by getAdapter() at the top of the next iteration
                        options.onStream?.({ type: 'reset' });
                        attempt = 0;
                        delay = initialDelay;
                        continue;
                    }
                }

                // Last resort for a server error when no fallback is configured/available —
                // preserves today's same-provider retry behavior for single-key users.
                if (isServerError && attempt < retries) {
                    const jitter = delay * 0.2 * (Math.random() * 2 - 1);
                    const finalDelay = Math.max(1000, delay + jitter);

                    logger.warn({
                        msg: `[${this.name}] LLM Retry`,
                        reason: 'Server Error',
                        provider: this.provider,
                        attempt: attempt + 1,
                        retries,
                        nextRetryIn: Math.round(finalDelay)
                    });

                    options.onStream?.({ type: 'reset' });

                    await new Promise(resolve => setTimeout(resolve, finalDelay));
                    delay *= 2;
                    attempt++;
                    continue;
                }

                const isFetchFailed = error.message?.includes("fetch failed");
                logger.error({ msg: `[${this.name}] LLM Call Failed`, provider: this.provider, error: error.message });
                if (isFetchFailed) {
                    logger.fatal(`[${this.name}] FATAL: Unable to reach ${this.provider} servers. Check network/proxy.`);
                }
                throw new Error(`${this.name} failed to generate content: ${error.message}`);
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
        // Mock check before touching this.modelName — see callLLM.
        if (process.env.MOCK_AI === 'true') {
            const mockReply = options.mockText || 'This is a mocked streaming reply.';
            for (const word of mockReply.split(' ')) {
                await new Promise(resolve => setTimeout(resolve, 10));
                yield `${word} `;
            }
            return;
        }

        logger.debug({ msg: `[${this.name}] Streaming LLM`, model: this.modelName });

        const adapter = this.getAdapter();
        try {
            for await (const chunk of adapter.generateContentStream({
                prompt,
                modelName: this.modelName,
                systemInstruction: options.systemInstruction,
                temperature: options.temperature,
                maxOutputTokens: clampOutputTokens(options.maxOutputTokens || this.tokenLimits.mediumJson, this.outputTokenLimit)
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

    /**
     * Recover JSON from model output. The pipeline itself lives in utils/jsonRepair.js so
     * aiService.analyzeText runs the exact same stages — they used to diverge, and output
     * this method recovered from would hard-fail there.
     */
    parseJSON(text) {
        try {
            return repairAndParseJSON(text, { label: this.name });
        } catch (error) {
            throw new Error(`${this.name} failed to parse JSON output. ${error.message}`);
        }
    }
}
