import { describe, it, expect, vi } from "vitest"
import { exportSrsToLatex, escapeLatex, formatLatexText } from "./latex-export"
import { exportSrsToMarkdown } from "./markdown-export"
import { exportSrsToTypst } from "./typst-export"
import { openInOverleaf } from "./overleaf"
import type { AnalysisResult } from "@/types/analysis"

describe("Multi-Standard Specification Exporters", () => {
    it("escapes LaTeX reserved characters correctly", () => {
        expect(escapeLatex("User & Admin % 100 $ 50 # 1 _ under {brace} ~ ^ \\")).toBe(
            "User \\& Admin \\% 100 \\$ 50 \\# 1 \\_ under \\{brace\\} \\textasciitilde{} \\textasciicircum{} \\textbackslash{}"
        )
    })

    it("formats markdown bold into LaTeX commands", () => {
        expect(formatLatexText("This is **critical** requirements with `token` logic.")).toBe(
            "This is \\textbf{critical} requirements with \\texttt{token} logic."
        )
    })

    it("triggers form submission targeting Overleaf Snip endpoint", () => {
        const formSubmitSpy = vi.fn()
        const originalCreateElement = document.createElement.bind(document)

        vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
            const el = originalCreateElement(tagName)
            if (tagName === "form") {
                (el as HTMLFormElement).submit = formSubmitSpy
            }
            return el
        })

        openInOverleaf("\\documentclass{article}", "TestDoc")
        expect(formSubmitSpy).toHaveBeenCalled()
    })
    const mockIEEE = {
        projectTitle: "Payment Gateway",
        introduction: {
            purpose: "Provide a secure payment processing infrastructure.",
            documentConventions: "IEEE 830-1998 standard conventions.",
        },
        systemFeatures: [
            {
                name: "Credit Card Processing",
                description: "Processes Visa and Mastercard transactions.",
                functionalRequirements: [
                    "The system shall validate the 16-digit card number using Luhn algorithm."
                ]
            }
        ],
        glossary: [{ term: "PAN", definition: "Primary Account Number" }]
    } as unknown as AnalysisResult

    const mockISO = {
        projectTitle: "Medical Device Controller",
        introduction: {
            purpose: "Control insulin pump delivery rates safely.",
            scope: "Real-time telemetry and pump actuation.",
        },
        systemFunctions: [
            {
                name: "Basal Rate Actuation",
                description: "Delivers continuous basal insulin.",
                functionalRequirements: [
                    {
                        id: "ISO-REQ-001",
                        description: "The pump shall meter 0.05 units/hr with 1% accuracy.",
                        rationale: "Patient metabolic homeostasis.",
                        verificationMethod: "Test",
                        source: "FDA Guidance 4.1"
                    }
                ]
            }
        ],
        glossary: [{ term: "Basal", definition: "Background insulin rate" }]
    } as unknown as AnalysisResult

    const mockVolere = {
        projectTitle: "Fleet Logistics System",
        purpose: {
            businessProblem: "Inefficient vehicle routing costs $2M annually.",
            goals: ["Reduce deadhead miles by 25%"]
        },
        stakeholders: [
            { role: "Fleet Manager", interest: "Real-time dispatch optimization" }
        ],
        functionalRequirements: [
            {
                name: "Dynamic Route Calculation",
                functionalRequirements: [
                    {
                        id: "VOL-REQ-101",
                        description: "The system shall recalculate routes upon traffic delays exceeding 10 minutes.",
                        fitCriterion: "New route presented within 3 seconds of alert."
                    }
                ]
            }
        ]
    } as unknown as AnalysisResult

    const mockAgile = {
        projectTitle: "Developer Collaboration Hub",
        overview: {
            vision: "Unified pull request reviews with inline AI comments.",
            problem: "Context switching slows down code reviews."
        },
        personas: [
            { name: "Dev Lead", description: "Reviews 20 PRs a day", goals: ["Catch regressions early"] }
        ],
        userStories: [
            {
                role: "Code Reviewer",
                action: "see automated test coverage deltas directly in the diff",
                benefit: "I can approve PRs without leaving the browser",
                acceptanceCriteria: ["Coverage badge shows +/-% delta", "Uncovered lines highlighted in red"]
            }
        ]
    } as unknown as AnalysisResult

    it("generates IEEE 830 LaTeX specification", () => {
        const { tex } = exportSrsToLatex(mockIEEE, "Payment Gateway", "ieee830")
        expect(tex).toContain("IEEE 830-1998")
        expect(tex).toContain("Credit Card Processing")
        expect(tex).toContain("The system shall validate the 16-digit card number")
    })

    it("generates ISO 29148 LaTeX specification with verification methods", () => {
        const { tex } = exportSrsToLatex(mockISO, "Medical Device Controller", "iso29148")
        expect(tex).toContain("ISO/IEC/IEEE 29148:2018")
        expect(tex).toContain("Basal Rate Actuation")
        expect(tex).toContain("ISO-REQ-001")
        expect(tex).toContain("Verification:")
        expect(tex).toContain("Test")
    })

    it("generates Volere LaTeX specification with Snow Card shells and fit criteria", () => {
        const { tex } = exportSrsToLatex(mockVolere, "Fleet Logistics System", "volere")
        expect(tex).toContain("Volere")
        expect(tex).toContain("Fleet Manager")
        expect(tex).toContain("VOL-REQ-101")
        expect(tex).toContain("Fit Criterion:")
        expect(tex).toContain("New route presented within 3 seconds")
    })

    it("generates Agile PRD LaTeX specification with user stories and acceptance criteria", () => {
        const { tex } = exportSrsToLatex(mockAgile, "Developer Collaboration Hub", "agile-prd")
        expect(tex).toContain("Agile PRD")
        expect(tex).toContain("Dev Lead")
        expect(tex).toContain("US-1")
        expect(tex).toContain("As a")
        expect(tex).toContain("Code Reviewer")
        expect(tex).toContain("Acceptance Criteria:")
    })

    it("generates Agile PRD Markdown specification", () => {
        const { text } = exportSrsToMarkdown(mockAgile, "Developer Collaboration Hub", "agile-prd")
        expect(text).toContain("# Developer Collaboration Hub")
        expect(text).toContain("Agile PRD")
        expect(text).toContain("Persona: Dev Lead")
        expect(text).toContain("US-1: Code Reviewer")
        expect(text).toContain("Acceptance Criteria:")
    })

    it("generates Volere Typst specification", () => {
        const { typ } = exportSrsToTypst(mockVolere, "Fleet Logistics System", "volere")
        expect(typ).toContain("Volere")
        expect(typ).toContain("Fleet Manager")
        expect(typ).toContain("VOL-REQ-101")
        expect(typ).toContain("New route presented within 3 seconds")
    })
})
