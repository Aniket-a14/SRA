import { genAI } from '../config/gemini.js';

export class BaseAgent {
    constructor(name, modelName = "gemini-2.5-flash") {
        this.name = name;
        this.modelName = modelName;
        // Allows switching models dynamically if needed, e.g. for cost/performance
    }

    async callLLM(prompt, temperature = 0.7, jsonMode = true, retries = 3, initialDelay = 5000) {
        console.log(`[${this.name}] Calling LLM (${this.modelName})...`);

        if (process.env.MOCK_AI === 'true') {
            console.log(`[${this.name}] MOCK MODE ACTIVE. Returning dummy response.`);
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
                    score: 0.85,
                    status: "PASS",
                    feedback: [],
                    overallScore: 0.9,
                    criticalIssues: [],
                    suggestions: [],
                    scores: {
                        clarity: 0.9, completeness: 0.8, conciseness: 0.9, consistency: 0.8, correctness: 0.9, context: 0.8
                    },
                    // Eval Service (RAG) specific fields
                    faithfulness: 0.9,
                    contextPrecision: 0.8,
                    answerRelevancy: 0.9,
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
                        maxOutputTokens: 65536,
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
                    // Add Jitter: +/- 20% of the delay
                    const jitter = delay * 0.2 * (Math.random() * 2 - 1);
                    const finalDelay = Math.max(1000, delay + jitter);

                    console.warn(`[${this.name}] ${isTimeout ? 'Timeout' : (isRateLimit ? 'Rate Limit' : 'Server Error')} hit (${status || 'TIMEOUT'}). Retrying in ${Math.round(finalDelay)}ms... (Attempt ${attempt + 1}/${retries})`);

                    await new Promise(resolve => setTimeout(resolve, finalDelay));
                    delay *= 2;
                    attempt++;
                } else {
                    const isFetchFailed = error.message?.includes("fetch failed");
                    console.error(`[${this.name}] LLM Call Failed:`, error.message);
                    if (isFetchFailed) {
                        console.error(`[${this.name}] FATAL: Unable to reach Google AI servers. Check your internet connection or proxy settings.`);
                    }
                    throw new Error(`${this.name} failed to generate content: ${error.message}`);
                }
            }
        }
    }

    parseJSON(text) {
        try {
            // Remove markdown code blocks if present (common with Gemini)
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanText);
        } catch (error) {
            console.error(`[${this.name}] JSON Parsing Failed. Full response follows:`);
            console.error(text);
            throw new Error(`${this.name} failed to parse JSON output. Check terminal logs for the full snippet.`);
        }
    }
}
