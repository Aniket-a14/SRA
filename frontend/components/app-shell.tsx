"use client"

import { LayerProvider } from "@/lib/layer-context"
import { AppSidebar } from "@/components/app-sidebar"

export function AppShell({ children }: { children: React.ReactNode }) {
    return (
        <LayerProvider>
            <div className="min-h-screen bg-background">
                <AppSidebar className="hidden md:flex" />
                <main className="md:pl-64">
                    {children}
                </main>
            </div>
        </LayerProvider>
    )
}
