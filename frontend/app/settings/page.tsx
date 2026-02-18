"use client"

import { Navbar } from "@/components/navbar"
import { SecuritySettings } from "@/components/security-settings"
import { ApiKeyManager } from "@/components/api-key-manager"
import { useAuth } from "@/lib/auth-context"
import { redirect } from "next/navigation"

export default function SettingsPage() {
    const { user, isLoading } = useAuth()

    if (!isLoading && !user) {
        redirect("/auth/login")
    }

    if (isLoading) return null

    return (
        <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1 container mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold mb-8">Settings</h1>

                <div className="space-y-8 max-w-4xl mx-auto">
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold">Account Security</h2>
                        <SecuritySettings />
                    </div>

                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold">API Access</h2>
                        <ApiKeyManager />
                    </div>
                </div>
            </main>
        </div>
    )
}
