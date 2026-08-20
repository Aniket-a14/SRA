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
        // The access token is never persisted; only the (non-sensitive) cached profile is.
        // Session restore on mount goes through /auth/refresh exchanging the httpOnly cookie.
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
        const fetchMock = stubFetch({
            "/auth/refresh": () => json({ token: "fresh-access-token" }),
            "/auth/me": () => json({ message: "Bad Gateway" }, 502)
        })
        vi.stubGlobal("fetch", fetchMock)

        renderAuth()

        await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"))
        expect(fetchMock.mock.calls.some(c => String(c[0]).includes("/auth/logout"))).toBe(false)
        expect(screen.getByTestId("user").textContent).toBe(CACHED_USER.email)
        expect(screen.getByTestId("token").textContent).toBe("fresh-access-token")
    })

    it("keeps the session when the network is down entirely", async () => {
        const fetchMock = vi.fn((url: string) => Promise.reject(new TypeError(`Failed to fetch ${url}`)))
        vi.stubGlobal("fetch", fetchMock)

        renderAuth()

        await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"))
        expect(fetchMock.mock.calls.some(c => String(c[0]).includes("/auth/logout"))).toBe(false)
        // Nothing proved the session invalid — the cached profile stays, even with no fresh token yet.
        expect(screen.getByTestId("user").textContent).toBe(CACHED_USER.email)
        expect(push).not.toHaveBeenCalledWith("/auth/login")
    })

    it("keeps the session when the refresh endpoint could not be reached", async () => {
        // An unreachable refresh proves nothing about the refresh token's validity.
        const fetchMock = stubFetch({
            "/auth/refresh": () => json({ message: "Service Unavailable" }, 503)
        })
        vi.stubGlobal("fetch", fetchMock)

        renderAuth()

        await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"))
        expect(fetchMock.mock.calls.some(c => String(c[0]).includes("/auth/logout"))).toBe(false)
        expect(screen.getByTestId("user").textContent).toBe(CACHED_USER.email)
        expect(push).not.toHaveBeenCalledWith("/auth/login")
    })

    it("recovers silently on mount by exchanging the refresh cookie", async () => {
        const fetchMock = stubFetch({
            "/auth/refresh": () => json({ token: "fresh-access-token" }),
            "/auth/me": () => json(CACHED_USER)
        })
        vi.stubGlobal("fetch", fetchMock)

        renderAuth()

        await waitFor(() => expect(screen.getByTestId("token").textContent).toBe("fresh-access-token"))
        expect(screen.getByTestId("user").textContent).toBe(CACHED_USER.email)
        expect(fetchMock.mock.calls.some(c => String(c[0]).includes("/auth/logout"))).toBe(false)
        // No toast/redirect for a legitimate silent recovery.
        expect(push).not.toHaveBeenCalledWith("/auth/login")
    })

    it("clears the session silently when the mount-time refresh is rejected (no toast, no redirect)", async () => {
        // A first-time or already-logged-out visitor has no valid refresh cookie either, and
        // gets the same verdict — neither should see a "session expired" toast.
        const fetchMock = stubFetch({
            "/auth/refresh": () => json({ message: "No refresh token" }, 401)
        })
        vi.stubGlobal("fetch", fetchMock)

        renderAuth()

        await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"))
        expect(screen.getByTestId("token").textContent).toBe("none")
        expect(localStorage.getItem("user")).toBeNull()
        // Silent: no redirect, no toast-triggering round trip beyond the refresh attempt itself.
        expect(push).not.toHaveBeenCalledWith("/auth/login")
    })

    it("signs out when the server says the refresh token itself is rejected mid-session", async () => {
        // The one case that is genuine proof the session is over.
        const fetchMock = stubFetch({
            "/auth/refresh": () => json({ token: "fresh-access-token" }),
            "/auth/me": () => json(CACHED_USER)
        })
        vi.stubGlobal("fetch", fetchMock)

        const held: { refresh: () => Promise<unknown> } = { refresh: async () => undefined }
        function Grabber() {
            const { refreshAccessToken } = useAuth()
            useEffect(() => { held.refresh = refreshAccessToken }, [refreshAccessToken])
            return null
        }
        render(<AuthProvider><Consumer /><Grabber /></AuthProvider>)

        await waitFor(() => expect(screen.getByTestId("token").textContent).toBe("fresh-access-token"))

        fetchMock.mockImplementation((url: string) => {
            if (String(url).includes("/auth/refresh")) return Promise.resolve(json({ message: "Invalid or Expired Refresh Token" }, 401))
            throw new Error(`unstubbed fetch: ${url}`)
        })
        await held.refresh()

        await waitFor(() => expect(screen.getByTestId("token").textContent).toBe("none"))
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
            "/auth/refresh": () => json({ token: "fresh-access-token" }),
            "/auth/me": () => json(CACHED_USER)
        })
        vi.stubGlobal("fetch", fetchMock)

        const held: { refresh: () => Promise<unknown> } = { refresh: async () => undefined }
        function Grabber() {
            const { refreshAccessToken } = useAuth()
            useEffect(() => { held.refresh = refreshAccessToken }, [refreshAccessToken])
            return null
        }
        render(<AuthProvider><Consumer /><Grabber /></AuthProvider>)

        await waitFor(() => expect(screen.getByTestId("token").textContent).toBe("fresh-access-token"))

        fetchMock.mockImplementation((url: string) => {
            if (String(url).includes("/auth/refresh")) return Promise.resolve(json({ message: "Invalid or Expired Refresh Token" }, 401))
            throw new Error(`unstubbed fetch: ${url}`)
        })
        await held.refresh()

        await waitFor(() => expect(screen.getByTestId("token").textContent).toBe("none"))
        expect(push).toHaveBeenCalledWith("/auth/login")
    })

    it("signs out the caller that joined a refresh already in flight", async () => {
        // A page fires several requests at once and they expire together, so the refresh is
        // deduplicated. The joiner used to be handed the shared promise and returned straight
        // away, skipping the sign-out entirely — so whether the app noticed its session had
        // ended came down to which request happened to lose the race.
        const fetchMock = stubFetch({
            "/auth/refresh": () => json({ token: "fresh-access-token" }),
            "/auth/me": () => json(CACHED_USER)
        })
        vi.stubGlobal("fetch", fetchMock)

        const held: { refresh: () => Promise<unknown> } = { refresh: async () => undefined }
        function Grabber() {
            const { refreshAccessToken } = useAuth()
            useEffect(() => { held.refresh = refreshAccessToken }, [refreshAccessToken])
            return null
        }
        render(<AuthProvider><Consumer /><Grabber /></AuthProvider>)

        await waitFor(() => expect(screen.getByTestId("token").textContent).toBe("fresh-access-token"))
        // Mount already made its own (successful) refresh call — count only what the
        // concurrent pair below triggers.
        const refreshCallsBeforePair = fetchMock.mock.calls.filter(c => String(c[0]).includes("/auth/refresh")).length

        let releaseRefresh: (() => void) | undefined
        const gate = new Promise<void>(resolve => { releaseRefresh = resolve })
        fetchMock.mockImplementation(async (url: string) => {
            if (String(url).includes("/auth/refresh")) {
                await gate
                return json({ message: "Invalid or Expired Refresh Token" }, 401)
            }
            throw new Error(`unstubbed fetch: ${url}`)
        })

        const first = held.refresh()
        const joiner = held.refresh()
        releaseRefresh?.()
        const [, joined] = await Promise.all([first, joiner])

        // The joiner sees the same verdict as the caller that started the request...
        expect(joined).toMatchObject({ token: null, reason: "expired" })
        // ...and one refresh was made, not two — a second would present a rotated-away cookie.
        const refreshCallsAfterPair = fetchMock.mock.calls.filter(c => String(c[0]).includes("/auth/refresh")).length
        expect(refreshCallsAfterPair - refreshCallsBeforePair).toBe(1)
        await waitFor(() => expect(screen.getByTestId("token").textContent).toBe("none"))
        expect(push).toHaveBeenCalledWith("/auth/login")
    })
})
