import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { AuthProvider, useAuth } from "./auth-context"

const push = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }))

function Consumer() {
    const { user, token, isLoading } = useAuth()
    return (
        <div>
            <span data-testid="loading">{String(isLoading)}</span>
            <span data-testid="user">{user?.email ?? "none"}</span>
            <span data-testid="token">{token ?? "none"}</span>
        </div>
    )
}

const CACHED_USER = { id: "u1", email: "someone@example.com", name: "Someone" }

/** Routes a stubbed fetch by URL so each test only states the responses it cares about. */
const stubFetch = (routes: Record<string, () => Promise<Response> | Response>) =>
    vi.fn((url: string) => {
        const key = Object.keys(routes).find(k => String(url).includes(k))
        if (!key) throw new Error(`unstubbed fetch: ${url}`)
        return Promise.resolve(routes[key]())
    })

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

const renderAuth = () => render(<AuthProvider><Consumer /></AuthProvider>)

describe("AuthProvider session survival", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.setItem("token", "stored-access-token")
        localStorage.setItem("user", JSON.stringify(CACHED_USER))
    })

    afterEach(() => {
        localStorage.clear()
        vi.unstubAllGlobals()
    })

    it("keeps the session when the profile request fails on a cold backend", async () => {
        // The reported bug: reopening the site hits a cold function, /auth/me 502s, and the
        // app used to call logout() — which revokes the refresh token server-side. A session
        // with days left was destroyed by one slow start.
        const fetchMock = stubFetch({ "/auth/me": () => json({ message: "Bad Gateway" }, 502) })
        vi.stubGlobal("fetch", fetchMock)

        renderAuth()

        await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"))
        expect(fetchMock.mock.calls.some(c => String(c[0]).includes("/auth/logout"))).toBe(false)
        expect(screen.getByTestId("user").textContent).toBe(CACHED_USER.email)
        expect(localStorage.getItem("token")).toBe("stored-access-token")
    })

    it("keeps the session when the network is down entirely", async () => {
        const fetchMock = vi.fn((url: string) => Promise.reject(new TypeError(`Failed to fetch ${url}`)))
        vi.stubGlobal("fetch", fetchMock)

        renderAuth()

        await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"))
        expect(fetchMock.mock.calls.some(c => String(c[0]).includes("/auth/logout"))).toBe(false)
        expect(localStorage.getItem("token")).toBe("stored-access-token")
    })

    it("keeps the session when the token expired but refresh could not be reached", async () => {
        // 401 then an unreachable refresh proves nothing about the refresh token's validity.
        const fetchMock = stubFetch({
            "/auth/me": () => json({ message: "Unauthorized" }, 401),
            "/auth/refresh": () => json({ message: "Service Unavailable" }, 503)
        })
        vi.stubGlobal("fetch", fetchMock)

        renderAuth()

        await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"))
        expect(fetchMock.mock.calls.some(c => String(c[0]).includes("/auth/logout"))).toBe(false)
        expect(localStorage.getItem("token")).toBe("stored-access-token")
    })

    it("recovers silently when refresh succeeds", async () => {
        let meCalls = 0
        const fetchMock = stubFetch({
            "/auth/me": () => (++meCalls === 1 ? json({}, 401) : json(CACHED_USER)),
            "/auth/refresh": () => json({ token: "fresh-access-token" })
        })
        vi.stubGlobal("fetch", fetchMock)

        renderAuth()

        await waitFor(() => expect(localStorage.getItem("token")).toBe("fresh-access-token"))
        expect(screen.getByTestId("user").textContent).toBe(CACHED_USER.email)
        expect(fetchMock.mock.calls.some(c => String(c[0]).includes("/auth/logout"))).toBe(false)
    })

    it("does sign out when the server says the refresh token itself is rejected", async () => {
        // The one case that is genuine proof the session is over.
        const fetchMock = stubFetch({
            "/auth/me": () => json({}, 401),
            "/auth/refresh": () => json({ message: "Invalid or Expired Refresh Token" }, 401),
            "/auth/logout": () => json({ message: "Logged out" })
        })
        vi.stubGlobal("fetch", fetchMock)

        renderAuth()

        await waitFor(() =>
            expect(fetchMock.mock.calls.some(c => String(c[0]).includes("/auth/logout"))).toBe(true)
        )
        await waitFor(() => expect(localStorage.getItem("token")).toBeNull())
    })
})
