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
     * Drop every trace of the session on this device and send the user somewhere they can
     * actually act. Separate from logout() because an *expired* session needs no round-trip:
     * the server has already said the refresh token is dead and cleared the cookie itself.
     */
    const clearSession = React.useCallback((destination?: string) => {
        localStorage.removeItem("token")
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

    const refreshAccessToken = React.useCallback(async (): Promise<RefreshResult> => {
        // Join the refresh already running rather than starting a competing one.
        if (inFlightRefresh) return inFlightRefresh

        inFlightRefresh = (async () => {
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

                localStorage.setItem("token", data.token)
                setToken(data.token)
                return { token: data.token as string }
            } catch {
                return { token: null, reason: "network" }
            } finally {
                inFlightRefresh = null
            }
        })()

        // Signing out lives here, at the one place every caller funnels through, rather than
        // in each caller. It used to sit only in the /auth/me path, which runs on mount — so a
        // session that expired while the user was working produced 401s on every action and no
        // sign-out at all: navigable, but unable to open anything.
        const result = await inFlightRefresh
        if (result.reason === "expired") {
            // The stale credentials go either way — leaving them is what made the landing page
            // keep offering "Dashboard" for a session that no longer existed. Only the
            // interruption is conditional: somewhere already public needs no announcement.
            if (onAuthRoute()) {
                clearSession()
            } else {
                toast.error("Your session expired. Please sign in again.")
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
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/me`, {
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
                    const retryRes = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/me`, {
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

    useEffect(() => {
        Promise.resolve().then(() => {
            const storedToken = localStorage.getItem("token")
            const storedUser = localStorage.getItem("user")

            if (storedUser) {
                try {
                    setUser(JSON.parse(storedUser))
                } catch (e) {
                    console.error("Failed to parse cached user", e)
                }
            }

            if (storedToken) {
                setToken(storedToken)
            } else {
                setIsLoading(false)
            }
        })
    }, [])

    const login = React.useCallback((newToken: string, newUser: User) => {
        localStorage.setItem("token", newToken)
        localStorage.setItem("user", JSON.stringify(newUser))
        setToken(newToken)
        setUser(newUser)
        router.push("/projects")
    }, [router])

    const authenticateWithToken = React.useCallback(async (newToken: string) => {
        localStorage.setItem("token", newToken)
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
