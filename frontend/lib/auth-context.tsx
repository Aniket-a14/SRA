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
    logout: () => void
    isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

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
                // Try refreshing — the refresh token lives in an httpOnly cookie sent
                // automatically with credentials:"include", nothing to read from localStorage.
                const refreshRes = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/refresh`, {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                })

                if (refreshRes.ok) {
                    const data = await refreshRes.json()
                    localStorage.setItem("token", data.token)
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
