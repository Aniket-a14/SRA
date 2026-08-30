import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { NextActionsPanel } from "./next-actions-panel"
import type { Analysis } from "@/types/analysis"

const mockAnalysis = {
    id: "test-analysis-id",
    userId: "test-user",
    inputText: "Test Input",
    version: 1,
    title: "Healthcare EHR System",
    isFinalized: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    resultJson: {
        projectTitle: "Healthcare EHR System"
    },
    metadata: {
        promptSettings: {
            format: "ieee830"
        }
    }
} as unknown as Analysis

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
