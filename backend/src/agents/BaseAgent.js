import { genAI } from '../config/gemini.js';
import { jsonrepair } from 'jsonrepair';
import logger from '../config/logger.js';

export class BaseAgent {
    constructor(name, modelName = "gemini-2.5-flash") {
        this.name = name;
        this.modelName = modelName;
        // Allows switching models dynamically if needed, e.g. for cost/performance
    }

    async callLLM(prompt, temperature = 0.7, jsonMode = true, retries = 3, initialDelay = 5000) {
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

        while (true) {
            try {
                const model = genAI.getGenerativeModel({
                    model: this.modelName,
                    generationConfig: {
                        temperature,
                        maxOutputTokens: 65535,
                        responseMimeType: jsonMode ? "application/json" : "text/plain"
                    }
                });

                const result = await callWithTimeout(model.generateContent(prompt), TIMEOUT_MS);
                const response = result.response;
                const text = response.text();

                if (jsonMode) {
                    return this.parseJSON(text);
                }
                return text;

            } catch (error) {
                const status = error.status || error.errorCode || (error.message?.match(/\[(\d+)\]/) || [])[1];
                const isRateLimit = status == 429 || error.message?.includes("429") || error.message?.includes("Quota exceeded");
                const isServerError = status >= 500 && status < 600;
                const isTimeout = error.message === "AI Request Timeout";

                if ((isRateLimit || isServerError || isTimeout) && attempt < retries) {
                    const jitter = delay * 0.2 * (Math.random() * 2 - 1);
                    const finalDelay = Math.max(1000, delay + jitter);

                    logger.warn({
                        msg: `[${this.name}] LLM Retry`,
                        reason: isTimeout ? 'Timeout' : (isRateLimit ? 'Rate Limit' : 'Server Error'),
                        status: status || 'TIMEOUT',
                        attempt: attempt + 1,
                        retries,
                        nextRetryIn: Math.round(finalDelay)
                    });

                    await new Promise(resolve => setTimeout(resolve, finalDelay));
                    delay *= 2;
                    attempt++;
                } else {
                    const isFetchFailed = error.message?.includes("fetch failed");
                    logger.error({ msg: `[${this.name}] LLM Call Failed`, error: error.message });
                    if (isFetchFailed) {
                        logger.fatal(`[${this.name}] FATAL: Unable to reach Google AI servers. Check network/proxy.`);
                    }
                    throw new Error(`${this.name} failed to generate content: ${error.message}`);
                }
            }
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

            // 4. Use professional jsonrepair library for fault-tolerant parsing
            const repaired = jsonrepair(cleanText);
            return JSON.parse(repaired);
        } catch (error) {
            logger.error({ msg: `[${this.name}] JSON Parsing Failed`, error: error.message });

            // Helpful debugging: show where it failed if possible
            if (error.message.includes('at position')) {
                const posStr = error.message.match(/at position (\d+)/);
                if (posStr) {
                    const pos = parseInt(posStr[1]);
                    const start = Math.max(0, pos - 50);
                    const end = Math.min(cleanText.length, pos + 50);
                    logger.debug({ msg: 'JSON Parse Context', context: '...' + cleanText.substring(start, pos) + ' >>> ' + (cleanText[pos] || '') + ' <<< ' + cleanText.substring(pos + 1, end) + '...' });
                }
            }

            throw new Error(`${this.name} failed to parse JSON output. See console for error position.`);
        }
    }
}
