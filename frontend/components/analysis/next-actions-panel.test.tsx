import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { NextActionsPanel } from "./next-actions-panel"
import type { Analysis, AnalysisResult } from "@/types/analysis"

const mockResultJson: AnalysisResult = {
    projectTitle: "Healthcare EHR System",
    introduction: {
        purpose: "EHR system purpose",
        documentConventions: "IEEE standard",
        productScope: "Enterprise health records",
        intendedAudience: "Clinicians",
        references: []
    },
    overallDescription: {
        productPerspective: "Standalone EHR",
        productFunctions: ["Patient records", "Billing"],
        userClassesAndCharacteristics: [],
        operatingEnvironment: "Cloud",
        designAndImplementationConstraints: [],
        userDocumentation: [],
        assumptionsAndDependencies: []
    },
    externalInterfaceRequirements: {
        userInterfaces: "Web dashboard",
        hardwareInterfaces: "Standard PC/Tablet",
        softwareInterfaces: "HL7 FHIR API",
        communicationsInterfaces: "HTTPS/TLS"
    },
    systemFeatures: [
        {
            name: "Patient Intake",
            description: "Intake portal",
            stimulusResponseSequences: ["Patient arrives -> Intake initiated"],
            functionalRequirements: ["The system shall capture patient identity."]
        }
    ],
    nonFunctionalRequirements: {
        performanceRequirements: [],
        safetyRequirements: [],
        securityRequirements: [],
        softwareQualityAttributes: [],
        businessRules: []
    },
    otherRequirements: [],
    glossary: [],
    appendices: {
        analysisModels: {},
        tbdList: []
    }
}

function createMockAnalysis(overrides: Partial<Analysis> = {}): Analysis {
    return {
        ...mockResultJson,
        id: "test-analysis-id",
        userId: "test-user",
        inputText: "Test Input",
        version: 1,
        title: "Healthcare EHR System",
        isFinalized: false,
        createdAt: new Date().toISOString(),
        rootId: null,
        parentId: null,
        resultJson: mockResultJson,
        metadata: {
            promptSettings: {
                format: "ieee830"
            }
        },
        ...overrides
    }
}

const mockAnalysis = createMockAnalysis()

describe("NextActionsPanel Component", () => {
    it("renders all key action triggers", () => {
        const onOpenChat = vi.fn()
        const onOpenDfdDialog = vi.fn()
        const onOpenCliTraceability = vi.fn()
        const onFinalize = vi.fn()

        render(
            <NextActionsPanel
                analysis={mockAnalysis}
                onOpenChat={onOpenChat}
                onOpenDfdDialog={onOpenDfdDialog}
                onOpenCliTraceability={onOpenCliTraceability}
                onFinalize={onFinalize}
            />
        )

        expect(screen.getByText("Export DOCX")).toBeInTheDocument()
        expect(screen.getByText("Generate DFD")).toBeInTheDocument()
        expect(screen.getByText("Code Traceability")).toBeInTheDocument()
        expect(screen.getByText("Refine via Chat")).toBeInTheDocument()
        expect(screen.getByText("Finalize & Index")).toBeInTheDocument()

        fireEvent.click(screen.getByText("Generate DFD"))
        expect(onOpenDfdDialog).toHaveBeenCalledTimes(1)

        fireEvent.click(screen.getByText("Refine via Chat"))
        expect(onOpenChat).toHaveBeenCalledTimes(1)

        fireEvent.click(screen.getByText("Code Traceability"))
        expect(onOpenCliTraceability).toHaveBeenCalledTimes(1)

        fireEvent.click(screen.getByText("Finalize & Index"))
        expect(onFinalize).toHaveBeenCalledTimes(1)
    })
})
