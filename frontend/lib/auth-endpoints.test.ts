import { describe, it, expect, vi, afterEach } from "vitest"
import { oauthStartUrl, startOAuth } from "./auth-endpoints"

describe("oauthStartUrl", () => {
    it.each([
        ["https://sra-backend-six.vercel.app", "https://sra-backend-six.vercel.app/auth/google/start"],
        ["https://api.example.com/", "https://api.example.com/auth/google/start"],
        ["http://localhost:3000//", "http://localhost:3000/auth/google/start"],
        ["  https://api.example.com  ", "https://api.example.com/auth/google/start"],
    ])("builds an absolute start URL from %p", (base, expected) => {
        expect(oauthStartUrl("google", base)).toBe(expected)
    })

    it("uses the provider in the path", () => {
        expect(oauthStartUrl("github", "https://api.example.com")).toBe("https://api.example.com/auth/github/start")
    })

    // The old inline template produced "undefined/auth/google/start" here: a relative URL,
    // so the button navigated inside the app to a 404 instead of failing visibly.
    it.each([undefined, "", "   ", "undefined", "/api", "api.example.com"])("refuses a missing or relative backend URL %p", (base) => {
        expect(() => oauthStartUrl("google", base)).toThrow(/backend URL is not configured/)
    })
})

describe("startOAuth", () => {
    afterEach(() => vi.unstubAllEnvs())

    it("does a full-page navigation to the backend", () => {
        vi.stubEnv("NEXT_PUBLIC_BACKEND_URL", "https://api.example.com")
        const assign = vi.fn()
        vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, assign } as Location)
        startOAuth("github")
        expect(assign).toHaveBeenCalledWith("https://api.example.com/auth/github/start")
    })
})
