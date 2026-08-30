import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { NextActionsPanel } from "./next-actions-panel"

describe("NextActionsPanel Component", () => {
    it("renders key AI action triggers", () => {
        const onOpenDfdDialog = vi.fn()
        const onOpenCliTraceability = vi.fn()

        render(
            <NextActionsPanel
                onOpenDfdDialog={onOpenDfdDialog}
                onOpenCliTraceability={onOpenCliTraceability}
            />
        )

        expect(screen.getByText("Generate DFD")).toBeInTheDocument()
        expect(screen.getByText("Code Traceability")).toBeInTheDocument()

        fireEvent.click(screen.getByText("Generate DFD"))
        expect(onOpenDfdDialog).toHaveBeenCalledTimes(1)

        fireEvent.click(screen.getByText("Code Traceability"))
        expect(onOpenCliTraceability).toHaveBeenCalledTimes(1)
    })
})
