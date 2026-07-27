import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, render, screen } from "@testing-library/react"
import { AnalysisLoading, phaseIndexFor } from "./analysis-loading"

/** The blur gradient is applied per segment, so the text is spread over several nodes. */
const visibleText = (container: HTMLElement) => container.textContent ?? ""

/** Text is released on a 40ms window rather than as it arrives. */
const settle = (ms = 30000) => act(() => { vi.advanceTimersByTime(ms) })

describe("AnalysisLoading", () => {
    beforeEach(() => { vi.useFakeTimers() })
    afterEach(() => { vi.useRealTimers() })

    it("shows the phase and the stage message before any text has streamed", () => {
        render(<AnalysisLoading liveStage="architect" liveMessage="Designing system architecture..." />)

        expect(screen.getByText("Designing the system")).toBeTruthy()
        expect(screen.getByText("Designing system architecture...")).toBeTruthy()
        expect(screen.queryByTestId("draft-page")).toBeNull()
    })

    it("says what it is waiting for rather than cycling invented progress copy", () => {
        render(<AnalysisLoading />)
        expect(screen.getByText("Waiting for the first stage to report…")).toBeTruthy()
    })

    it("releases the draft gradually instead of dumping each model call at once", () => {
        const body = "The system shall accept files up to 50 MB. ".repeat(30)
        const { container } = render(<AnalysisLoading liveText={body} liveStage="developer_features" />)

        settle(200)
        const early = visibleText(container).length

        expect(early).toBeGreaterThan(0)
        expect(visibleText(container)).not.toContain(body)

        settle()
        expect(visibleText(container)).toContain(body)
    })

    it("keeps every character when the text is split across blur segments", () => {
        // A long draft is rendered as a sharp head plus graded tail spans; dropping or
        // duplicating a slice at that boundary would corrupt the document on screen.
        const body = "The system shall accept files up to 50 MB. ".repeat(12)
        const { container } = render(<AnalysisLoading liveText={body} liveStage="developer_features" />)

        settle()
        expect(visibleText(container)).toContain(body)
    })

    it("renders a short draft that is shorter than the tail window", () => {
        const { container } = render(<AnalysisLoading liveText="Upload" liveStage="developer_shell" />)

        settle()
        expect(visibleText(container)).toContain("Upload")
    })

    it("keeps the full text once drafting is over and the audit stages run", () => {
        // Post-drafting stages emit no tokens; the document must read as finished, not writing.
        const body = "The system shall accept files up to 50 MB. ".repeat(12)
        const { container } = render(<AnalysisLoading liveText={body} liveStage="reflection" liveMessage="Auditing quality..." />)

        settle()
        expect(visibleText(container)).toContain(body)
        expect(screen.getByText("Auditing quality...")).toBeTruthy()
    })

    it("never returns to the opening state once the draft is on screen", () => {
        // Sections are streamed by separate model calls and a retry resets the buffer. Falling back
        // to the pre-draft page between two calls would read as the run having started over.
        const { rerender } = render(<AnalysisLoading liveText="Secure Upload" liveStage="developer_shell" />)
        settle()
        expect(screen.getByTestId("draft-page")).toBeTruthy()

        rerender(<AnalysisLoading liveText="" liveStage="developer_features" />)
        settle()

        expect(screen.getByTestId("draft-page")).toBeTruthy()
    })
})

describe("phaseIndexFor", () => {
    it("advances monotonically through the pipeline's real stage names", () => {
        const order = ["product_owner", "rag_retrieval", "architect", "developer_shell", "diagram_repair", "reflection", "final_evaluation"]
        const indices = order.map(phaseIndexFor)

        expect(indices).toEqual([...indices].sort((a, b) => a - b))
        expect(new Set(indices).size).toBe(order.length)
    })

    it("groups every drafting and reflection stage under one phase", () => {
        for (const stage of ["developer_shell", "developer_features", "developer_requirements", "developer_appendices", "developer_format", "drafting"]) {
            expect(phaseIndexFor(stage)).toBe(phaseIndexFor("developer_shell"))
        }
        expect(phaseIndexFor("reflection_refine")).toBe(phaseIndexFor("reflection"))
    })

    it("falls back to the first phase for an unknown or absent stage", () => {
        expect(phaseIndexFor(undefined)).toBe(0)
        expect(phaseIndexFor("something_new")).toBe(0)
    })
})
