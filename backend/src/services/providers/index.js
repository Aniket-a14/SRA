import { GeminiAdapter, DEFAULT_MODEL as GEMINI_DEFAULT_MODEL } from './GeminiAdapter.js';
import { OpenAIAdapter, DEFAULT_MODEL as OPENAI_DEFAULT_MODEL } from './OpenAIAdapter.js';
import { ClaudeAdapter, DEFAULT_MODEL as CLAUDE_DEFAULT_MODEL } from './ClaudeAdapter.js';
import { GrokAdapter, DEFAULT_MODEL as GROK_DEFAULT_MODEL } from './GrokAdapter.js';

// Accepts both the Prisma AiProvider enum values (GEMINI/OPENAI/CLAUDE/GROK) and
// the legacy free-text strings already stored in Analysis.metadata.promptSettings
// (e.g. "google" from before this registry existed) so old rows keep resolving.
const PROVIDER_ALIASES = {
    gemini: 'GEMINI',
    google: 'GEMINI',
    openai: 'OPENAI',
    claude: 'CLAUDE',
    anthropic: 'CLAUDE',
    grok: 'GROK',
    xai: 'GROK'
};

export const DEFAULT_MODELS = Object.freeze({
    GEMINI: GEMINI_DEFAULT_MODEL,
    OPENAI: OPENAI_DEFAULT_MODEL,
    CLAUDE: CLAUDE_DEFAULT_MODEL,
    GROK: GROK_DEFAULT_MODEL
});

export function normalizeProvider(provider) {
    if (!provider) return 'GEMINI';
    const key = String(provider).toLowerCase();
    return PROVIDER_ALIASES[key] || 'GEMINI';
}

/**
 * @param {string} provider - GEMINI | OPENAI | CLAUDE | GROK (or a legacy alias)
 * @param {string} [apiKey] - decrypted per-user key. Required for every provider used for
 *   generation, including Gemini. When omitted, Gemini falls back to the shared platform
 *   client (embeddings/internal callers only) — user-facing generation always passes a key.
 */
export function getAdapter(provider, apiKey) {
    switch (normalizeProvider(provider)) {
        case 'OPENAI':
            return new OpenAIAdapter(apiKey);
        case 'CLAUDE':
            return new ClaudeAdapter(apiKey);
        case 'GROK':
            return new GrokAdapter(apiKey);
        case 'GEMINI':
        default:
            return new GeminiAdapter(apiKey);
    }
}
