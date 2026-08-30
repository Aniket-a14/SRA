import { describe, it, expect, vi, beforeAll } from "vitest"
import { render, screen } from "@testing-library/react"
import { CommandPalette } from "./command-palette"

beforeAll(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
})

vi.mock("next/navigation", () => ({
    useRouter: () => ({
        push: vi.fn(),
    }),
}))

vi.mock("@/lib/auth-context", () => ({
    useAuth: () => ({
        token: "fake-jwt-token",
        user: { name: "Architect", email: "architect@example.com" },
    }),
}))

describe("CommandPalette Component", () => {
    it("renders command palette dialog when open", () => {
        render(<CommandPalette open={true} onOpenChange={vi.fn()} />)
        expect(screen.getByPlaceholderText(/Type a command or search/i)).toBeInTheDocument()
        expect(screen.getByText("Start New Requirements Analysis")).toBeInTheDocument()
        expect(screen.getByText("Open Task & Activity Center")).toBeInTheDocument()
        expect(screen.getByText("IEEE 830-1998 Specification")).toBeInTheDocument()
    })
})
