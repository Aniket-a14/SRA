import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { normalizeProvider } from './index.js';
import logger from '../../config/logger.js';

const XAI_BASE_URL = 'https://api.x.ai/v1';

/**
 * A verification error the caller can map to an HTTP status. `kind: 'auth'` means the
 * key itself is bad (reject the save); `kind: 'unavailable'` means the provider's
 * list endpoint failed for another reason (network/5xx) — the key may still be valid.
 */
export class ModelDiscoveryError extends Error {
    constructor(message, kind = 'unavailable') {
        super(message);
        this.name = 'ModelDiscoveryError';
        this.kind = kind;
        this.statusCode = kind === 'auth' ? 400 : 502;
    }
}

/** Derive a short, human-friendly label from a raw model id. */
export function formatModelLabel(id) {
    return String(id)
        .replace(/^models\//, '')
        .replace(/^gpt-/, 'GPT-')
        .replace(/^o([0-9])/, 'O$1')
        .replace(/^chatgpt-/, 'ChatGPT-')
        .replace(/^gemini-/, 'Gemini ')
        .replace(/^claude-/, 'Claude ')
        .replace(/^grok-/, 'Grok ')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim();
}

// OpenAI's /models returns every model incl. embeddings/audio/image/moderation.
// Keep only text-generation chat models so the UI never offers a model that 404s
// (or 400s "not a chat model") when the analysis pipeline actually calls it.
const OPENAI_INCLUDE = /^(gpt-|o[1-9]|chatgpt-)/i;
const OPENAI_EXCLUDE = /(embedding|whisper|tts|audio|realtime|dall-e|image|moderation|transcribe|search|codex|instruct|davinci|babbage|-o1-mini-2)/i;

function isAuthError(error) {
    const status = error?.status ?? error?.statusCode;
    return status === 401 || status === 403 || /invalid.*api.*key|incorrect api key|unauthor/i.test(error?.message || '');
}

async function listOpenAICompatible(apiKey, { baseURL, includeRe, excludeRe }) {
    const client = new OpenAI(baseURL ? { apiKey, baseURL } : { apiKey });
    const res = await client.models.list();
    const ids = (res?.data || [])
        .map((m) => m.id)
        .filter((id) => (includeRe ? includeRe.test(id) : true) && !(excludeRe && excludeRe.test(id)));
    // Newest-looking ids first (rough: longer version numbers / reverse-alpha), de-duped.
    return [...new Set(ids)].sort().reverse();
}

async function discoverOpenAI(apiKey) {
    const ids = await listOpenAICompatible(apiKey, { includeRe: OPENAI_INCLUDE, excludeRe: OPENAI_EXCLUDE });
    return ids.map((id) => ({ id, label: formatModelLabel(id) }));
}

async function discoverGrok(apiKey) {
    // xAI is OpenAI-compatible; its /models only returns grok* models already.
    const ids = await listOpenAICompatible(apiKey, { baseURL: XAI_BASE_URL, excludeRe: /(embedding|image|vision-beta)/i });
    return ids.map((id) => ({ id, label: formatModelLabel(id) }));
}

async function discoverClaude(apiKey) {
    const client = new Anthropic({ apiKey });
    const res = await client.models.list();
    return (res?.data || [])
        .map((m) => ({ id: m.id, label: m.display_name || formatModelLabel(m.id) }));
}

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// `supportedGenerationMethods: ['generateContent']` is necessary but nowhere near
// sufficient — image, speech, music, robotics, computer-use and deep-research models all
// advertise it while being useless (or outright erroring) for structured SRS text. Probed
// live 2026-07-25: deep-research/antigravity return 400 "only supports Interactions API".
// Gemma is excluded too: open models on this endpoint don't reliably honour system
// instructions or JSON response mime types, which the whole pipeline depends on.
const GEMINI_EXCLUDE = /(embedding|aqa|-tts|tts-|image|nano-banana|lyria|robotics|computer-use|deep-research|antigravity|^gemma|veo|imagen|audio|-live)/i;

/**
 * Ask the model to emit one token. This is the only reliable availability signal: the
 * list endpoint advertises models the key's tier cannot actually call — on a free-tier key
 * every *-pro model returns 429 "exceeded your current quota" and gemini-2.5-flash-lite
 * returns 404 "no longer available to new users", yet all of them appear in the list.
 *
 * @returns {Promise<boolean>} true when the model is genuinely callable with this key
 */
async function isGeminiModelCallable(apiKey, id, timeoutMs = 12000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(`${GEMINI_BASE}/models/${id}:generateContent?key=${encodeURIComponent(apiKey)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: 'hi' }] }],
                generationConfig: { maxOutputTokens: 1, temperature: 0 }
            }),
            signal: controller.signal
        });
        return res.ok;
    } catch {
        // Network failure/abort is not evidence the model is unusable — keep it and let the
        // pipeline surface a real error rather than silently hiding a working model.
        return true;
    } finally {
        clearTimeout(timer);
    }
}

async function discoverGemini(apiKey) {
    // The @google/generative-ai JS SDK has no list-models call, so hit REST directly.
    const res = await fetch(`${GEMINI_BASE}/models?pageSize=1000&key=${encodeURIComponent(apiKey)}`);
    if (!res.ok) {
        const err = new Error(`Gemini models list failed (${res.status})`);
        err.status = res.status;
        throw err;
    }
    const json = await res.json();

    // inputTokenLimit/outputTokenLimit come free with the list response and vary widely
    // across models (8k to 65k output). Capturing them here is what lets the pipeline size
    // each generation against the model actually selected instead of a fixed guess.
    const candidates = (json?.models || [])
        .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map((m) => ({
            id: String(m.name).replace(/^models\//, ''),
            displayName: m.displayName,
            inputTokenLimit: m.inputTokenLimit,
            outputTokenLimit: m.outputTokenLimit
        }))
        .filter((m) => !GEMINI_EXCLUDE.test(m.id));

    // Verify what this specific key can actually run. Bounded concurrency keeps the
    // one-time key-verification latency reasonable; per-model quota means parallel probes
    // of *different* models don't contend with each other.
    const usable = [];
    const CONCURRENCY = 5;
    for (let i = 0; i < candidates.length; i += CONCURRENCY) {
        const batch = candidates.slice(i, i + CONCURRENCY);
        const results = await Promise.all(batch.map((m) => isGeminiModelCallable(apiKey, m.id)));
        batch.forEach((m, idx) => { if (results[idx]) usable.push(m); });
    }

    const rejected = candidates.length - usable.length;
    if (rejected > 0) {
        logger.info({ msg: '[modelDiscovery] Gemini models rejected by live probe (tier/availability)', rejected, kept: usable.length });
    }

    // Fail open: if every probe rejected (e.g. the whole key is throttled right now),
    // fall back to the capability-filtered list rather than showing an empty picker.
    const chosen = usable.length > 0 ? usable : candidates;
    return chosen.map((m) => ({
        id: m.id,
        label: m.displayName || formatModelLabel(m.id),
        ...(m.inputTokenLimit && { inputTokenLimit: m.inputTokenLimit }),
        ...(m.outputTokenLimit && { outputTokenLimit: m.outputTokenLimit })
    }));
}

const DISCOVERERS = {
    OPENAI: discoverOpenAI,
    GROK: discoverGrok,
    CLAUDE: discoverClaude,
    GEMINI: discoverGemini
};

/**
 * Verifies an API key by making a real list-models call to the provider and returns
 * the generation-capable models available to that key. Throws {@link ModelDiscoveryError}
 * (`kind: 'auth'`) if the key is rejected, or (`kind: 'unavailable'`) on other failures.
 *
 * @returns {Promise<{ provider: string, models: Array<{id: string, label: string}> }>}
 */
export async function discoverModels(provider, apiKey) {
    const normalized = normalizeProvider(provider);
    const discover = DISCOVERERS[normalized];
    if (!discover) throw new ModelDiscoveryError(`Unknown provider: ${provider}`, 'auth');
    if (!apiKey || !apiKey.trim()) throw new ModelDiscoveryError('API key is required', 'auth');

    try {
        const models = await discover(apiKey.trim());
        if (!models.length) {
            throw new ModelDiscoveryError('Key verified but no generation models are available for it.', 'unavailable');
        }
        return { provider: normalized, models };
    } catch (error) {
        if (error instanceof ModelDiscoveryError) throw error;
        logger.warn({ msg: '[modelDiscovery] verification failed', provider: normalized, error: error.message });
        if (isAuthError(error)) {
            throw new ModelDiscoveryError('Invalid API key — the provider rejected it. Double-check the key and try again.', 'auth');
        }
        throw new ModelDiscoveryError(`Could not reach ${normalized} to verify the key. Try again in a moment.`, 'unavailable');
    }
}
