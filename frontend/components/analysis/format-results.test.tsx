import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { FormatResults } from "./format-results"
import type { FormatSpec } from "@/lib/formats"

/**
 * Renders through the exported component rather than its internal helpers — the point is to
 * assert what a reader of the document actually sees, which is the only thing tsc cannot tell
 * us. Requirement items are the interesting case: three of the four formats emit objects, and
 * an unhandled shape falls through to a raw JSON dump on screen.
 */

const featureListSpec = (requirementModel: string): FormatSpec => ({
    id: "test-format",
    name: "Test Format",
    description: "Fixture",
    tier: "detailed",
    requirementModel,
    sections: [
        {
            id: "systemFunctions",
            number: "4",
            title: "System Functions",
            kind: "feature-list",
            requirementModel,
        },
    ],
} as unknown as FormatSpec)

const renderFeature = (requirementModel: string, functionalRequirements: unknown[]) =>
    render(
        <FormatResults
            spec={featureListSpec(requirementModel)}
            data={{
                systemFunctions: [
                    { name: "Authentication", description: "Sign in.", functionalRequirements },
                ],
            }}
        />
    )

describe("FormatResults requirement rendering", () => {
    it("renders plain IEEE string requirements", () => {
        renderFeature("ieee", ["The system shall lock an account after five failed attempts."])
        expect(
            screen.getByText(/lock an account after five failed attempts/)
        ).toBeInTheDocument()
    })

    it("renders every ISO 29148 attribute, including the verification method", () => {
        renderFeature("iso-29148", [
            {
                id: "FTP-REQ-001",
                description: "The system shall lock an account after five failed attempts.",
                rationale: "Limits credential stuffing.",
                verificationMethod: "Test",
                source: "Security review",
            },
        ])

        expect(screen.getByText("FTP-REQ-001")).toBeInTheDocument()
        expect(screen.getByText(/lock an account/)).toBeInTheDocument()
        expect(screen.getByText("Rationale:")).toBeInTheDocument()
        expect(screen.getByText("Limits credential stuffing.")).toBeInTheDocument()
        expect(screen.getByText("Verification:")).toBeInTheDocument()
        expect(screen.getByText("Test")).toBeInTheDocument()
        expect(screen.getByText("Security review")).toBeInTheDocument()
    })

    it("marks an unassigned verification method so the gap is visible", () => {
        // The backend normaliser emits TBD rather than inventing a method; the reader has to
        // be able to see that the requirement has no agreed means of verification.
        renderFeature("iso-29148", [
            { description: "The system shall be maintainable.", verificationMethod: "TBD" },
        ])

        const tbd = screen.getByText("TBD")
        expect(tbd).toBeInTheDocument()
        expect(tbd.className).toContain("amber")
    })

    it("renders a Volere shell's fit criterion", () => {
        renderFeature("volere-shell", [
            {
                id: "FR-1",
                description: "The product shall be easy for a new dispatcher to learn.",
                fitCriterion: "A new dispatcher completes the booking task within 15 minutes.",
            },
        ])

        expect(screen.getByText("Fit criterion:")).toBeInTheDocument()
        expect(screen.getByText(/within 15 minutes/)).toBeInTheDocument()
        // Volere carries no verification method; the row must not appear.
        expect(screen.queryByText("Verification:")).not.toBeInTheDocument()
    })

    it("omits attribute rows that are absent rather than rendering empty labels", () => {
        renderFeature("iso-29148", [{ description: "The system shall export a report." }])

        expect(screen.queryByText("Rationale:")).not.toBeInTheDocument()
        expect(screen.queryByText("Verification:")).not.toBeInTheDocument()
        expect(screen.queryByText("Source:")).not.toBeInTheDocument()
    })

    it("says so when a section has no requirements, instead of rendering nothing", () => {
        renderFeature("iso-29148", [])
        expect(screen.getByText(/None specified/i)).toBeInTheDocument()
    })

    it("never leaks a raw JSON object into the document body", () => {
        // The renderer's last resort is JSON.stringify; a shape that reaches it is a bug the
        // reader sees as machine output in the middle of a specification.
        const { container } = renderFeature("iso-29148", [
            { description: "The system shall export a report.", verificationMethod: "Test" },
        ])
        expect(container.textContent).not.toContain('{"')
    })
})
