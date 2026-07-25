// Shared model catalogue + helpers for the BYOK model picker.
//
// The authoritative source of models for OpenAI/Claude/Grok is the live
// discovery call made when a user verifies their key (see backend
// modelDiscovery.js) — those come back on each provider key as `availableModels`.
// Generation is BYOK for every provider now (the platform key is embeddings-only),
// so Gemini models are only offered once the user has configured their own Gemini
// key; the curated list below is the fallback label set for a saved (unverified) key.

export type AiProviderEnum = "GEMINI" | "OPENAI" | "CLAUDE" | "GROK"

export interface ModelOption {
    provider: AiProviderEnum
    value: string
    label: string
    hint?: string
}

export interface DiscoveredModel {
    id: string
    label: string
}

/**
 * Fallback Gemini model list, offered when the user has a Gemini key saved but live
 * discovery hasn't run for it. Model ids are configuration, not code: they come from
 * NEXT_PUBLIC_GEMINI_MODELS (comma-separated ids, optionally `id|Label|Hint`) so a model
 * that a provider retires can be swapped without a code change. Empty when unset —
 * better an empty picker that tells the user to verify their key than a hardcoded id
 * that 404s or has no free-tier quota at generation time.
 */
export const GEMINI_PLATFORM_MODELS: ModelOption[] = parseModelEnv(
    process.env.NEXT_PUBLIC_GEMINI_MODELS
)

/** Parse `id|Label|Hint, id2|Label2` into ModelOptions. Label/hint are optional. */
export function parseModelEnv(raw: string | undefined): ModelOption[] {
    if (!raw?.trim()) return []
    return raw
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
            const [value, label, hint] = entry.split("|").map((p) => p.trim())
            return {
                provider: "GEMINI" as const,
                value,
                label: label || formatModelLabel(value),
                ...(hint ? { hint } : {}),
            }
        })
        .filter((m) => m.value.length > 0)
}

/** Turn a raw model id into a short human label (fallback when the API gives none). */
export function formatModelLabel(id: string): string {
    return id
        .replace(/^models\//, "")
        .replace(/^gpt-/, "GPT-")
        .replace(/^o([0-9])/, "O$1")
        .replace(/^chatgpt-/, "ChatGPT-")
        .replace(/^gemini-/, "Gemini ")
        .replace(/^claude-/, "Claude ")
        .replace(/^grok-/, "Grok ")
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim()
}

interface ProviderKeyLike {
    provider: AiProviderEnum
    availableModels?: DiscoveredModel[] | null
}

/**
 * Build the list of models the user can actually generate with — driven entirely by
 * the provider keys they've configured (generation is BYOK for every provider). Gemini
 * contributes its discovered models, or the curated fallback list if the key was saved
 * without discovery; the others contribute only the models discovery returned, so the
 * picker can never surface a model that 404s (or lacks a key) when the pipeline calls it.
 */
export function buildModelOptions(providerKeys: ProviderKeyLike[]): ModelOption[] {
    const options: ModelOption[] = []

    for (const key of providerKeys) {
        const discovered = Array.isArray(key.availableModels) ? key.availableModels : []
        if (key.provider === "GEMINI") {
            if (discovered.length > 0) {
                for (const m of discovered) {
                    options.push({ provider: "GEMINI", value: m.id, label: m.label || formatModelLabel(m.id) })
                }
            } else {
                options.push(...GEMINI_PLATFORM_MODELS)
            }
            continue
        }
        for (const m of discovered) {
            options.push({
                provider: key.provider,
                value: m.id,
                label: m.label || formatModelLabel(m.id),
            })
        }
    }

    return options
}
