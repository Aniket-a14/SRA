import { describe, it, expect } from "vitest"
import { nextShown, MIN_CHARS, MAX_CHARS } from "./paced-text"

const drain = (source: string, ticks: number, from = "") => {
    let shown = from
    for (let i = 0; i < ticks; i++) shown = nextShown(shown, source)
    return shown
}

describe("nextShown", () => {
    it("releases faster when more is waiting", () => {
        const deep = nextShown("", "x".repeat(2000)).length
        const thin = nextShown("", "x".repeat(20)).length

        expect(deep).toBeGreaterThan(thin)
    })

    it("always moves while anything is buffered, so the page never visibly stalls", () => {
        // One character left is still one character released — a rate that rounds to zero would
        // freeze the page for as long as the pipeline's cooldown between model calls.
        expect(nextShown("abc", "abcd").length).toBe(3 + MIN_CHARS)
    })

    it("holds when the buffer is empty rather than inventing text", () => {
        expect(nextShown("abc", "abc")).toBe("abc")
    })

    it("caps the burst so a large backlog still reads as writing", () => {
        expect(nextShown("", "x".repeat(100000)).length).toBe(MAX_CHARS)
    })

    it("never overshoots the source", () => {
        const source = "The system shall accept files up to 50 MB."
        expect(drain(source, 500)).toBe(source)
    })

    it("clears a burst well inside the gap before the next model call", () => {
        // The tail deliberately eases off, but the backlog must not outlive the pipeline's
        // cooldown or the buffer grows without bound across the run.
        const source = "The system shall accept files up to 50 MB. ".repeat(20)

        expect(drain(source, 50).length).toBeGreaterThan(source.length * 0.6)
        expect(drain(source, 250)).toBe(source)
    })

    it("keeps a thin buffer moving at the floor rate rather than emptying it instantly", () => {
        // 25 chars/s reads as writing. Draining the last few characters at once would leave the
        // page frozen for the rest of the cooldown.
        const source = "x".repeat(20)
        expect(drain(source, 5).length).toBe(5)
    })

    it("restarts cleanly when a retry replays the section from the beginning", () => {
        // BaseAgent emits a reset and re-streams on retry, so the source can shrink or diverge.
        expect(nextShown("Draft one is long", "")).toBe("")
        expect(nextShown("Draft one is long", "Draft two")).toBe("Draft two")
    })
})
