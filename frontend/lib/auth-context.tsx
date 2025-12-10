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
    const [user, setUser] = useState<User | null>(null)
    const [token, setToken] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const router = useRouter()

    const logout = React.useCallback(() => {
        localStorage.removeItem("token")
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
        // Check local storage on mount
        const storedToken = localStorage.getItem("token")
        if (storedToken) {
            setToken(storedToken)
            fetchUser(storedToken)
        } else {
            setIsLoading(false)
        }
    }, [fetchUser])

    const login = React.useCallback((newToken: string, newUser: User) => {
        localStorage.setItem("token", newToken)
        setToken(newToken)
        setUser(newUser)
        router.push("/")
    }, [router])

    const authenticateWithToken = React.useCallback(async (newToken: string) => {
        localStorage.setItem("token", newToken)
        setToken(newToken)
        await fetchUser(newToken)
        router.push("/")
    }, [fetchUser, router])

    return (
        <AuthContext.Provider value={{ user, token, login, authenticateWithToken, logout, isLoading }}>
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
