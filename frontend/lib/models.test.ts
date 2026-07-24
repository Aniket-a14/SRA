import { describe, it, expect } from "vitest"
import { buildModelOptions, formatModelLabel, GEMINI_PLATFORM_MODELS } from "./models"

describe("formatModelLabel", () => {
    it("humanizes raw model ids consistently with the backend formatter", () => {
        expect(formatModelLabel("gpt-5.6")).toBe("GPT 5.6")
        expect(formatModelLabel("gemini-2.5-flash")).toBe("Gemini 2.5 Flash")
        expect(formatModelLabel("models/gemini-2.5-pro")).toBe("Gemini 2.5 Pro")
        expect(formatModelLabel("grok-4.5")).toBe("Grok 4.5")
    })
})

describe("buildModelOptions", () => {
    it("always offers the Gemini platform models even with no user keys", () => {
        const options = buildModelOptions([])
        expect(options).toEqual(GEMINI_PLATFORM_MODELS)
        expect(options.every((o) => o.provider === "GEMINI")).toBe(true)
    })

    it("appends discovered models for each configured non-Gemini key", () => {
        const options = buildModelOptions([
            { provider: "OPENAI", availableModels: [{ id: "gpt-5.6", label: "GPT-5.6" }] },
            { provider: "CLAUDE", availableModels: [{ id: "claude-opus-4-8", label: "Claude Opus 4.8" }] },
        ])
        const values = options.map((o) => o.value)
        expect(values).toContain("gemini-2.5-flash")
        expect(values).toContain("gpt-5.6")
        expect(values).toContain("claude-opus-4-8")
    })

    it("never surfaces a model that wasn't returned by the provider (no hardcoded 404 risk)", () => {
        // A key with no discovered models contributes nothing — the picker can only
        // ever offer models the provider actually confirmed for that key.
        const options = buildModelOptions([{ provider: "GROK", availableModels: [] }])
        expect(options).toEqual(GEMINI_PLATFORM_MODELS)
    })

    it("ignores a user-supplied Gemini key's models (platform list is authoritative for Gemini)", () => {
        const options = buildModelOptions([
            { provider: "GEMINI", availableModels: [{ id: "gemini-x-experimental", label: "X" }] },
        ])
        expect(options.map((o) => o.value)).not.toContain("gemini-x-experimental")
    })

    it("falls back to the formatter when a discovered model has no label", () => {
        const options = buildModelOptions([
            { provider: "OPENAI", availableModels: [{ id: "gpt-5.6", label: "" }] },
        ])
        const gpt = options.find((o) => o.value === "gpt-5.6")
        expect(gpt?.label).toBe("GPT 5.6")
    })
})
