"use client"

import { AuthProvider } from "@/lib/auth-context"
// Import other providers here if needed (e.g. ThemeProvider)

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            {children}
        </AuthProvider>
    )
}
