"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { authEndpoint } from "./auth-endpoints"

/** Already somewhere the user can sign in — don't redirect or announce an expiry there. */
const onAuthRoute = () =>
    typeof window !== "undefined" &&
    (window.location.pathname === "/" || window.location.pathname.startsWith("/auth"))

interface User {
    id: string
    email: string
    name: string
    image?: string
}

/**
 * Why this is not just `string | null`: a failed refresh has two causes that demand
 * opposite responses. "expired" means the session is genuinely over and the user must sign
 * in again; "network" means we learned nothing. Collapsing them is what made a single cold
 * start or dropped request sign people out of a session with days left on it.
 */
export type RefreshResult =
    | { token: string; reason?: never }
    | { token: null; reason: "expired" | "network" }

interface AuthContextType {
    user: User | null
    token: string | null
    login: (token: string, user: User) => void
    authenticateWithToken: (token: string) => Promise<void>
    /** Exchange the httpOnly refresh cookie for a fresh access token. */
    refreshAccessToken: () => Promise<RefreshResult>
    logout: () => void
    isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * The single in-flight refresh, shared by every caller.
 *
 * Module scope rather than a ref, because the deduplication has to hold across every
 * component that calls useAuthFetch, not per-hook-instance. A page typically fires several
 * requests at once; with a 15-minute access token they expire together, so they all get a
 * 401 within milliseconds of each other. Refreshing independently would be actively
 * harmful, not merely wasteful: /auth/refresh *rotates* the token, so the first response
 * invalidates the cookie the others are still using. One wins, the rest are told their
 * session is invalid, and the user is signed out in the middle of working.
 */
let inFlightRefresh: Promise<RefreshResult> | null = null

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [token, setToken] = useState<string | null>(null)
    const [user, setUser] = useState<User | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    const router = useRouter()

    /**
     * Bumped on every login/authenticateWithToken/clearSession, so the mount-time silent
     * refresh can tell whether it's still resolving for the session it started for. Without
     * this, a slow /auth/refresh that started before login can resolve "expired" after login
     * succeeds and wipe the fresh session it knows nothing about.
     */
    const sessionGenRef = React.useRef(0)

    /**
     * Drop every trace of the session on this device and send the user somewhere they can
     * actually act. Separate from logout() because an *expired* session needs no round-trip:
     * the server has already said the refresh token is dead and cleared the cookie itself.
     */
    const clearSession = React.useCallback((destination?: string) => {
        sessionGenRef.current += 1
        localStorage.removeItem("user")
        setToken(null)
        setUser(null)
        if (destination) router.push(destination)
    }, [router])

    const logout = React.useCallback(async () => {
        try {
            // Refresh token lives only in an httpOnly cookie, sent automatically —
            // no need to read/send it from localStorage.
            await fetch(authEndpoint("logout"), {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
            })
        } catch (e) {
            console.error("Logout failed", e)
        }
        clearSession("/")
    }, [clearSession])

    const refreshAccessToken = React.useCallback(async (opts?: { silent?: boolean; startGen?: number }): Promise<RefreshResult> => {
        // Join the refresh already running rather than starting a competing one. The joiner
        // falls through to the same handling below, so whichever caller happens to arrive
        // second still sees the expiry — returning the bare promise here meant a page whose
        // first 401 lost the race stayed signed in, holding credentials the server had
        // already rejected.
        const shared = inFlightRefresh ?? (inFlightRefresh = (async () => {
            try {
                const res = await fetch(authEndpoint("refresh"), {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                })

                // Only 401 is the server saying this session is over. A 5xx or a gateway
                // timeout is the server saying nothing at all, and must not end a session.
                if (!res.ok) return { token: null, reason: res.status === 401 ? "expired" : "network" }

                const data = await res.json()
                if (!data?.token) return { token: null, reason: "expired" }

                setToken(data.token)
                return { token: data.token as string }
            } catch {
                return { token: null, reason: "network" }
            } finally {
                inFlightRefresh = null
            }
        })())

        // Signing out lives here, at the one place every caller funnels through, rather than
        // in each caller. It used to sit only in the /auth/me path, which runs on mount — so a
        // session that expired while the user was working produced 401s on every action and no
        // sign-out at all: navigable, but unable to open anything.
        const result = await shared
        if (result.reason === "expired") {
            // `silent` is the mount-time exchange of the refresh cookie for an access token: a
            // visitor who was never signed in has no cookie either, and gets the same "expired"
            // verdict as someone whose session just ended — they must not see a sign-in toast
            // for a session they never had. Same for anywhere already public.
            if (opts?.silent) {
                // A login (or another clearSession) that happened after this refresh started
                // owns the session now — this "expired" verdict is stale and about a session
                // that's already gone, not the one currently signed in. Clearing here would
                // sign out someone who logged in while the mount-time refresh was still
                // in flight.
                if (opts.startGen === sessionGenRef.current) {
                    clearSession()
                }
            } else if (onAuthRoute()) {
                clearSession()
            } else {
                // Fixed id: several callers can await the same expiry, and the user should be
                // told once, not once per in-flight request.
                toast.error("Your session expired. Please sign in again.", { id: "session-expired" })
                clearSession("/auth/login")
            }
        }
        return result
    }, [clearSession])

    /**
     * Sign out ONLY when the server has actually said the session is over.
     *
     * This used to call logout() on any non-OK response and on any thrown fetch — and
     * logout() posts to /auth/logout, which revokes the session server-side. So a cold
     * start, a 502, or a dropped connection on page load did not merely fail to load the
     * profile: it destroyed a refresh token with days of life left, and the user had to sign
     * in again. Reopening the site after closing it is exactly when that request is most
     * likely to hit a cold backend, which is why it looked like "closing the tab logs me out".
     */
    const fetchUser = React.useCallback(async (authToken: string) => {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || ""
        try {
            const res = await fetch(`${backendUrl}/auth/me`, {
                headers: {
                    Authorization: `Bearer ${authToken}`
                }
            })

            if (res.ok) {
                const userData = await res.json()
                setUser(userData)
                localStorage.setItem("user", JSON.stringify(userData))
                return
            }

            if (res.status === 401) {
                // Delegates to the shared refresh so this cannot race useAuthFetch's — the
                // endpoint rotates the token, and two refreshes in flight means one of them
                // presents a cookie the other just invalidated.
                const refreshed = await refreshAccessToken()

                if (refreshed.token) {
                    const retryRes = await fetch(`${backendUrl}/auth/me`, {
                        headers: { Authorization: `Bearer ${refreshed.token}` }
                    })
                    if (retryRes.ok) {
                        const retryUser = await retryRes.json()
                        setUser(retryUser)
                        localStorage.setItem("user", JSON.stringify(retryUser))
                    }
                    return
                }

                // An expired session has already been cleared by refreshAccessToken. Anything
                // else means the refresh could not reach the server — keep the cached session
                // and let the next request try again, rather than revoking one that may be fine.
                return
            }

            // 5xx, 502 from a cold function, anything else: the server has not said the
            // session is invalid, so it stays.
            console.warn(`Could not load profile (HTTP ${res.status}) — keeping the session.`)
        } catch (error) {
            console.warn("Could not reach the server to load the profile — keeping the session.", error)
        } finally {
            setIsLoading(false)
        }
    }, [refreshAccessToken])

    useEffect(() => {
        if (token) {
            // Move to next tick to avoid "setState synchronously in effect" warning
            Promise.resolve().then(() => fetchUser(token))
        }
    }, [fetchUser, token])

    const restoreCachedUser = React.useCallback(() => {
        // Pre-refresh-cookie builds kept the access token in localStorage too. Purge any
        // leftover from before this device upgraded — otherwise it sits there, readable by
        // any injected script, for the rest of its JWT lifetime even though nothing writes
        // to this key anymore.
        localStorage.removeItem("token")
        const storedUser = localStorage.getItem("user")
        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser))
            } catch (e) {
                console.error("Failed to parse cached user", e)
            }
        }
    }, [])

    const bootstrapSession = React.useCallback(async () => {
        // Regain the session by exchanging the httpOnly refresh cookie for a fresh access
        // token, same mechanism as a mid-session refresh but silent. Captures the generation
        // before the request goes out so a login that lands before this resolves isn't
        // clobbered by a stale "expired" verdict — see the startGen check in refreshAccessToken.
        const startGen = sessionGenRef.current
        const result = await refreshAccessToken({ silent: true, startGen })
        if (!result.token) setIsLoading(false)
    }, [refreshAccessToken])

    useEffect(() => {
        // The access token is never persisted — only the (non-sensitive) profile is, so a
        // returning visitor sees their name immediately instead of a loading flash.
        // Both calls are named functions, not inline setState, and deferred to the next tick
        // to avoid "setState synchronously in effect" — same pattern as the effect above.
        Promise.resolve().then(restoreCachedUser)
        Promise.resolve().then(bootstrapSession)
        // Mount-only by design: bootstrapSession is not a stable reference (it closes over
        // the router transitively), and re-running this on every render would re-issue the
        // refresh-cookie exchange each time.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const login = React.useCallback((newToken: string, newUser: User) => {
        sessionGenRef.current += 1
        localStorage.setItem("user", JSON.stringify(newUser))
        setToken(newToken)
        setUser(newUser)
        router.push("/projects")
    }, [router])

    const authenticateWithToken = React.useCallback(async (newToken: string) => {
        sessionGenRef.current += 1
        setToken(newToken)
        await fetchUser(newToken)
        router.push("/projects")
    }, [fetchUser, router])

    const value = React.useMemo(() => ({
        user,
        token,
        login,
        authenticateWithToken,
        refreshAccessToken,
        logout,
        isLoading
    }), [user, token, login, authenticateWithToken, refreshAccessToken, logout, isLoading]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider")
    }
    return context
}
