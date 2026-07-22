import { BaseAgent } from './BaseAgent.js';
import { CHAT_PROMPT, CHAT_REPLY_PROMPT, CHAT_EDIT_PROMPT } from '../utils/prompts.js';
import { OUTPUT_TOKEN_LIMITS, TEMPERATURES } from '../utils/llmGenerationConfig.js';

/**
 * ChatAgent — handles conversational Q&A and targeted SRS edits.
 *
 * Uses BaseAgent.callLLM() to inherit:
 *  - Structured retry/back-off logic (429, 503, timeout)
 *  - Automatic JSON repair via jsonrepair
 *  - Centralised logging and mock-mode support
 *  - systemInstruction separation for Gemini prompt caching
 */
export class ChatAgent extends BaseAgent {
    constructor(providerConfig = {}) {
        super('Chat Agent', providerConfig);
    }

    /**
     * Process a single chat turn given the compact SRS snapshot and conversation history.
     *
     * @param {object}   srsSnapshot  — Compact SRS from createChatSnapshot() (NOT the full resultJson)
     * @param {string}   historyText  — Serialised prior messages (role: content\n...)
     * @param {string}   userMessage  — Latest user message
     * @returns {Promise<{reply: string, updatedAnalysis: object|null}>}
     */
    async chat(srsSnapshot, historyText, userMessage) {
        const prompt = `
<current_analysis_json>
${JSON.stringify(srsSnapshot)}
</current_analysis_json>

<chat_history>
${historyText}
</chat_history>

<user_message>
User: ${userMessage}
</user_message>
`;

        return this.callLLM(
            prompt,
            TEMPERATURES.critic,   // 0.3 — deterministic edits, accurate answers
            true,                  // jsonMode
            null,                  // no responseSchema (flexible chat output)
            3,                     // retries
            2000,                  // initialDelay
            {
                systemInstruction: CHAT_PROMPT,
                maxOutputTokens: OUTPUT_TOKEN_LIMITS.srsRefinement
            }
        );
    }

    /**
     * Streaming conversational half of a chat turn — plain text, no JSON envelope.
     * @returns {AsyncGenerator<string>} text chunks as they arrive
     */
    chatStream(srsSnapshot, historyText, userMessage) {
        const prompt = `
<current_analysis_json>
${JSON.stringify(srsSnapshot)}
</current_analysis_json>

<chat_history>
${historyText}
</chat_history>

<user_message>
User: ${userMessage}
</user_message>
`;

        return this.streamText(prompt, {
            systemInstruction: CHAT_REPLY_PROMPT,
            temperature: TEMPERATURES.critic,
            maxOutputTokens: OUTPUT_TOKEN_LIMITS.srsRefinement,
            mockText: 'Mocked AI Reply'
        });
    }

    /**
     * Non-streamed JSON follow-up — only called when chatService's heuristic flags
     * the message as a likely edit request. Kept as a plain callLLM (full retry/backoff/
     * JSON-repair) since it's not shown to the user token-by-token.
     * @returns {Promise<{updatedAnalysis: object|null}>}
     */
    async proposeEdit(srsSnapshot, historyText, userMessage) {
        const prompt = `
<current_analysis_json>
${JSON.stringify(srsSnapshot)}
</current_analysis_json>

<chat_history>
${historyText}
</chat_history>

<user_message>
User: ${userMessage}
</user_message>
`;

        return this.callLLM(
            prompt,
            TEMPERATURES.critic,
            true,
            null,
            3,
            2000,
            {
                systemInstruction: CHAT_EDIT_PROMPT,
                maxOutputTokens: OUTPUT_TOKEN_LIMITS.srsRefinement
            }
        );
    }
}
