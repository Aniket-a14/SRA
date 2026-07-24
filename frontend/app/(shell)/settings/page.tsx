"use client"

import { SecuritySettings } from "@/components/security-settings"
import { ApiKeyManager } from "@/components/api-key-manager"
import { ProviderKeyManager } from "@/components/provider-key-manager"
import { useAuth } from "@/lib/auth-context"
import { redirect } from "next/navigation"

export default function SettingsPage() {
    const { user, isLoading } = useAuth()

    if (!isLoading && !user) {
        redirect("/auth/login")
    }

    if (isLoading) return null

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-12">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-display tracking-tight mb-8 sm:mb-10">Settings</h1>

            <div className="space-y-8 sm:space-y-10">
                <div className="space-y-4">
                    <h2 className="text-xs font-mono uppercase tracking-wide text-muted-foreground">Account security</h2>
                    <SecuritySettings />
                </div>

                <div className="space-y-4">
                    <h2 className="text-xs font-mono uppercase tracking-wide text-muted-foreground">AI providers</h2>
                    <ProviderKeyManager />
                </div>

                <div className="space-y-4">
                    <h2 className="text-xs font-mono uppercase tracking-wide text-muted-foreground">API access</h2>
                    <ApiKeyManager />
                </div>
            </div>
        </div>
    )
}
