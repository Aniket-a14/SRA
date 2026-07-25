import { GeminiAdapter } from './GeminiAdapter.js';
import { OpenAIAdapter } from './OpenAIAdapter.js';
import { ClaudeAdapter } from './ClaudeAdapter.js';
import { GrokAdapter } from './GrokAdapter.js';
import { getDefaultModel } from '../../config/models.js';

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

/**
 * Per-provider default model. Lazy getters, not values: model ids live in the environment
 * (see config/models.js), so reading one must happen at call time — a module-scope snapshot
 * would both freeze the value at import and throw during import when a variable is unset.
 */
export const DEFAULT_MODELS = Object.freeze({
    get GEMINI() { return getDefaultModel('GEMINI'); },
    get OPENAI() { return getDefaultModel('OPENAI'); },
    get CLAUDE() { return getDefaultModel('CLAUDE'); },
    get GROK() { return getDefaultModel('GROK'); }
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
