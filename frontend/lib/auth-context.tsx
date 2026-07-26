"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface User {
    id: string
    email: string
    name: string
    image?: string
}

interface AuthContextType {
    user: User | null
    token: string | null
    login: (token: string, user: User) => void
    authenticateWithToken: (token: string) => Promise<void>
    /**
     * Exchange the httpOnly refresh cookie for a fresh access token.
     * Resolves to the new token, or null if the session is genuinely over.
     */
    refreshAccessToken: () => Promise<string | null>
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
let inFlightRefresh: Promise<string | null> | null = null

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [token, setToken] = useState<string | null>(null)
    const [user, setUser] = useState<User | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    const router = useRouter()

    const logout = React.useCallback(async () => {
        try {
            // Refresh token lives only in an httpOnly cookie, sent automatically —
            // no need to read/send it from localStorage.
            await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/logout`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
            })
        } catch (e) {
            console.error("Logout failed", e)
        }
        localStorage.removeItem("token")
        localStorage.removeItem("user")
        setToken(null)
        setUser(null)
        router.push("/")
    }, [router])

    const refreshAccessToken = React.useCallback(async (): Promise<string | null> => {
        // Join the refresh already running rather than starting a competing one.
        if (inFlightRefresh) return inFlightRefresh

        inFlightRefresh = (async () => {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/refresh`, {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                })

                if (!res.ok) return null

                const data = await res.json()
                if (!data?.token) return null

                localStorage.setItem("token", data.token)
                setToken(data.token)
                return data.token as string
            } catch {
                // Network failure is not proof the session ended — the caller surfaces the
                // original error rather than signing the user out on a flaky connection.
                return null
            } finally {
                inFlightRefresh = null
            }
        })()

        return inFlightRefresh
    }, [])

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
            } else if (res.status === 401) {
                // Delegates to the shared refresh so this cannot race useAuthFetch's — the
                // endpoint rotates the token, and two refreshes in flight means one of them
                // presents a cookie the other just invalidated.
                const newToken = await refreshAccessToken()

                if (newToken) {
                    const retryRes = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/me`, {
                        headers: { Authorization: `Bearer ${newToken}` }
                    })
                    if (retryRes.ok) {
                        const retryUser = await retryRes.json()
                        setUser(retryUser)
                    }
                    return
                }
                logout()
            } else {
                logout()
            }
        } catch (error) {
            console.error("Failed to fetch user", error)
            logout()
        } finally {
            setIsLoading(false)
        }
    }, [logout, refreshAccessToken])

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
