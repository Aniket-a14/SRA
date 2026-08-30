import { describe, it, expect } from "vitest"
import { exportSrsToMarkdown } from "./markdown-export"
import type { AnalysisResult } from "@/types/analysis"

describe("exportSrsToMarkdown", () => {
    it("generates markdown with IEEE format headers and requirements", () => {
        const mockAnalysis = {
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
                        "The system shall validate the 16-digit card number using Luhn algorithm.",
                        "The system shall verify CVV with the card issuing network."
                    ]
                }
            ],
            appendices: {
                analysisModels: {
                    flowchartDiagram: "graph TD\n  A[Start] --> B[Process]"
                }
            }
        } as unknown as AnalysisResult

        const { text, filename } = exportSrsToMarkdown(mockAnalysis, "Payment Gateway", "ieee830")

        expect(filename).toBe("Payment_Gateway_IEEE830.md")
        expect(text).toContain("# Payment Gateway")
        expect(text).toContain("## 1. Introduction")
        expect(text).toContain("### 1.1 Purpose")
        expect(text).toContain("Provide a secure payment processing infrastructure.")
        expect(text).toContain("## 3. System Features & Functional Requirements")
        expect(text).toContain("### 3.1 Credit Card Processing")
        expect(text).toContain("- **FR-1:** The system shall validate the 16-digit card number")
        expect(text).toContain("```mermaid\ngraph TD\n  A[Start] --> B[Process]\n```")
    })
})

