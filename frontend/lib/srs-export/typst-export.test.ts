import { describe, it, expect } from "vitest"
import { exportSrsToTypst } from "./typst-export"
import type { AnalysisResult } from "@/types/analysis"

describe("Typst Export Engine", () => {
    it("generates a structured Typst specification document", () => {
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
                        "The system shall validate the 16-digit card number using Luhn algorithm."
                    ]
                }
            ],
            glossary: [
                { term: "PAN", definition: "Primary Account Number" }
            ]
        } as unknown as AnalysisResult

        const { typ, filename } = exportSrsToTypst(mockAnalysis, "Payment Gateway", "ieee830")

        expect(filename).toBe("Payment_Gateway_IEEE830.typ")
        expect(typ).toContain("#set page(")
        expect(typ).toContain("#let requirement(")
        expect(typ).toContain("= Introduction")
        expect(typ).toContain("== Purpose")
        expect(typ).toContain("= System Features")
        expect(typ).toContain("== Credit Card Processing")
        expect(typ).toContain("#requirement(\"PG-FR-1.1\", \"Functional Requirement\"")
        expect(typ).toContain("[*PAN*], [Primary Account Number]")
    })
})
