import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { AnalysisLoading } from "./analysis-loading"

/** The blur gradient is applied per segment, so the text is spread over several nodes. */
const visibleText = (container: HTMLElement) => container.textContent ?? ""

describe("AnalysisLoading", () => {
    it("shows the orb and the stage message before any text has streamed", () => {
        render(<AnalysisLoading liveMessage="Designing system architecture..." />)

        expect(screen.getByText("Performing Deep Analysis")).toBeTruthy()
        expect(screen.getByText("Designing system architecture...")).toBeTruthy()
    })

    it("switches to the document once the first tokens arrive", () => {
        const { container } = render(
            <AnalysisLoading
                liveMessage="Drafting the SRS shell..."
                liveStage="developer_shell"
                liveText={"Secure Upload\nAccepts files."}
            />
        )

        expect(screen.queryByText("Performing Deep Analysis")).toBeNull()
        expect(visibleText(container)).toContain("Secure Upload")
        expect(screen.getByText("Drafting the SRS shell...")).toBeTruthy()
    })

    it("keeps every character when the text is split across blur segments", () => {
        // A long draft is rendered as a sharp head plus graded tail spans; dropping or
        // duplicating a slice at that boundary would corrupt the document on screen.
        const body = "The system shall accept files up to 50 MB. ".repeat(12)
        const { container } = render(<AnalysisLoading liveText={body} liveStage="developer_features" />)

        expect(visibleText(container)).toContain(body)
    })

    it("renders a short draft that is shorter than the tail window", () => {
        const { container } = render(<AnalysisLoading liveText="Upload" liveStage="developer_shell" />)
        expect(visibleText(container)).toContain("Upload")
    })

    it("keeps the full text once drafting is over and the audit stages run", () => {
        // Post-drafting stages emit no tokens; the document must read as finished, not writing.
        const body ="The system shall accept files up to 50 MB. ".repeat(12)
        const { container } = render(<AnalysisLoading liveText={body} liveStage="reflection" liveMessage="Auditing quality..." />)

        expect(visibleText(container)).toContain(body)
        expect(screen.getByText("Auditing quality...")).toBeTruthy()
    })

    it("falls back to placeholder copy when no stage message has arrived", () => {
        render(<AnalysisLoading />)
        expect(screen.getByText("Synchronizing requirements...")).toBeTruthy()
    })
})
