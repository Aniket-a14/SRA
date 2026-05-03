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
    login: (token: string, refreshToken: string, user: User) => void
    authenticateWithToken: (token: string, refreshToken?: string) => Promise<void>
    logout: () => void
    isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [token, setToken] = useState<string | null>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem("token")
        }
        return null
    })

    const [user, setUser] = useState<User | null>(() => {
        if (typeof window !== 'undefined') {
            const storedUser = localStorage.getItem("user")
            if (storedUser) {
                try {
                    return JSON.parse(storedUser)
                } catch (e) {
                    console.error("Failed to parse cached user", e)
                }
            }
        }
        return null
    })

    const [isLoading, setIsLoading] = useState(() => {
        if (typeof window !== 'undefined') {
            return !!localStorage.getItem("token")
        }
        return true
    })

    const router = useRouter()

    const logout = React.useCallback(async () => {
        const rfToken = localStorage.getItem("refreshToken")
        if (rfToken) {
            try {
                await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/logout`, {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ refreshToken: rfToken })
                })
            } catch (e) {
                console.error("Logout failed", e)
            }
        }
        localStorage.removeItem("token")
        localStorage.removeItem("refreshToken")
        localStorage.removeItem("user")
        setToken(null)
        setUser(null)
        router.push("/")
    }, [router])

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
                // Try refreshing token
                const rfToken = localStorage.getItem("refreshToken")
                if (rfToken) {
                    const refreshRes = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/refresh`, {
                        method: "POST",
                        credentials: "include",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ refreshToken: rfToken })
                    })

                    if (refreshRes.ok) {
                        const data = await refreshRes.json()
                        localStorage.setItem("token", data.token)
                        localStorage.setItem("refreshToken", data.refreshToken) // rotation
                        setToken(data.token)
                        // Retry fetching user with new token
                        const retryRes = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/me`, {
                            headers: { Authorization: `Bearer ${data.token}` }
                        })
                        if (retryRes.ok) {
                            const retryUser = await retryRes.json()
                            setUser(retryUser)
                        }
                        return
                    }
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
    }, [logout])

    useEffect(() => {
        if (token) {
            // Move to next tick to avoid "setState synchronously in effect" warning
            Promise.resolve().then(() => fetchUser(token))
        }
    }, [fetchUser, token])

    const login = React.useCallback((newToken: string, newRefreshToken: string, newUser: User) => {
        localStorage.setItem("token", newToken)
        localStorage.setItem("refreshToken", newRefreshToken)
        localStorage.setItem("user", JSON.stringify(newUser))
        setToken(newToken)
        setUser(newUser)
        // router.push("/") // Optional: Assume login component handles redirect or keep it? Original had it.
        // Let's keep strict API: login function updates state. Redirect might be handled by caller or here. 
        // Original code: router.push("/")
        router.push("/")
    }, [router])

    const authenticateWithToken = React.useCallback(async (newToken: string, newRefreshToken?: string) => {
        localStorage.setItem("token", newToken)
        if (newRefreshToken) {
            localStorage.setItem("refreshToken", newRefreshToken)
        }
        setToken(newToken)
        await fetchUser(newToken)
        router.push("/")
    }, [fetchUser, router])

    const value = React.useMemo(() => ({
        user,
        token,
        login,
        authenticateWithToken,
        logout,
        isLoading
    }), [user, token, login, authenticateWithToken, logout, isLoading]);

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
