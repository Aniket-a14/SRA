import { describe, it, expect } from "vitest"
import { buildModelOptions, formatModelLabel, parseModelEnv } from "./models"

describe("formatModelLabel", () => {
    it("humanizes raw model ids consistently with the backend formatter", () => {
        expect(formatModelLabel("gpt-5.6")).toBe("GPT 5.6")
        expect(formatModelLabel("gemini-3.5-flash")).toBe("Gemini 3.5 Flash")
        expect(formatModelLabel("models/gemini-3.5-flash-lite")).toBe("Gemini 3.5 Flash Lite")
        expect(formatModelLabel("grok-4.5")).toBe("Grok 4.5")
    })
})

describe("parseModelEnv", () => {
    it("returns nothing when the variable is unset or blank", () => {
        expect(parseModelEnv(undefined)).toEqual([])
        expect(parseModelEnv("   ")).toEqual([])
    })

    it("parses bare ids and derives their labels", () => {
        expect(parseModelEnv("gemini-3.5-flash,gemini-2.5-flash")).toEqual([
            { provider: "GEMINI", value: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
            { provider: "GEMINI", value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
        ])
    })

    it("honours explicit id|Label|Hint entries and tolerates loose spacing", () => {
        expect(parseModelEnv(" gemini-3.5-flash | Flash | Balanced , gemini-3.5-flash-lite|Lite ")).toEqual([
            { provider: "GEMINI", value: "gemini-3.5-flash", label: "Flash", hint: "Balanced" },
            { provider: "GEMINI", value: "gemini-3.5-flash-lite", label: "Lite" },
        ])
    })
})

describe("buildModelOptions", () => {
    it("offers nothing when the user has configured no provider keys", () => {
        // Generation is BYOK for every provider, so an empty picker is the correct,
        // honest state — the UI prompts the user to add a key rather than showing a
        // model they have no way to call.
        expect(buildModelOptions([])).toEqual([])
    })

    it("uses the models discovery returned for a verified Gemini key", () => {
        const options = buildModelOptions([
            { provider: "GEMINI", availableModels: [{ id: "gemini-3.5-flash", label: "Gemini 3.5 Flash" }] },
        ])
        expect(options).toEqual([
            { provider: "GEMINI", value: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
        ])
    })

    it("falls back to the env-configured list for a Gemini key with no discovered models", () => {
        // The fallback is configuration (NEXT_PUBLIC_GEMINI_MODELS), so this asserts the
        // wiring rather than any particular model id.
        const options = buildModelOptions([{ provider: "GEMINI", availableModels: [] }])
        expect(options).toEqual(parseModelEnv(process.env.NEXT_PUBLIC_GEMINI_MODELS))
    })

    it("appends discovered models for each configured non-Gemini key", () => {
        const options = buildModelOptions([
            { provider: "OPENAI", availableModels: [{ id: "gpt-5.6", label: "GPT-5.6" }] },
            { provider: "CLAUDE", availableModels: [{ id: "claude-opus-4-8", label: "Claude Opus 4.8" }] },
        ])
        expect(options.map((o) => o.value)).toEqual(["gpt-5.6", "claude-opus-4-8"])
    })

    it("never surfaces a model the provider didn't return (no hardcoded 404 risk)", () => {
        expect(buildModelOptions([{ provider: "GROK", availableModels: [] }])).toEqual([])
    })

    it("falls back to the formatter when a discovered model has no label", () => {
        const options = buildModelOptions([
            { provider: "OPENAI", availableModels: [{ id: "gpt-5.6", label: "" }] },
        ])
        expect(options.find((o) => o.value === "gpt-5.6")?.label).toBe("GPT 5.6")
    })
})
