import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { useEffect } from "react"
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
        // jsdom starts at "/", which the provider treats as a public route and so does not
        // redirect away from. These tests are about signed-in pages.
        window.history.pushState({}, "", "/analysis/abc")
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
            "/auth/refresh": () => json({ message: "Invalid or Expired Refresh Token" }, 401)
        })
        vi.stubGlobal("fetch", fetchMock)

        renderAuth()

        await waitFor(() => expect(localStorage.getItem("token")).toBeNull())
        expect(localStorage.getItem("user")).toBeNull()
        // Somewhere the user can act. Leaving them in place is what produced a signed-in shell
        // that could navigate but could not load anything behind it.
        expect(push).toHaveBeenCalledWith("/auth/login")
        // No /auth/logout round-trip: the server has already rejected the token and cleared
        // the cookie, so asking it to revoke what it just refused achieves nothing.
        expect(fetchMock.mock.calls.some(c => String(c[0]).includes("/auth/logout"))).toBe(false)
    })

    it("signs out on an expiry discovered mid-session, not only at mount", async () => {
        // The dead state: the session ends while the user is working, every request 401s, and
        // the sign-out lived only in the /auth/me path — which does not run again. The user
        // could keep navigating a shell that could no longer open anything.
        const fetchMock = stubFetch({
            "/auth/me": () => json(CACHED_USER),
            "/auth/refresh": () => json({ message: "Invalid or Expired Refresh Token" }, 401)
        })
        vi.stubGlobal("fetch", fetchMock)

        const held: { refresh: () => Promise<unknown> } = { refresh: async () => undefined }
        function Grabber() {
            const { refreshAccessToken } = useAuth()
            // In an effect, not during render — reassigning outer state while rendering is a
            // side effect React is free to run more than once.
            useEffect(() => { held.refresh = refreshAccessToken }, [refreshAccessToken])
            return null
        }
        render(<AuthProvider><Grabber /></AuthProvider>)

        await waitFor(() => expect(localStorage.getItem("token")).toBe("stored-access-token"))
        await held.refresh()

        await waitFor(() => expect(localStorage.getItem("token")).toBeNull())
        expect(push).toHaveBeenCalledWith("/auth/login")
    })
})
