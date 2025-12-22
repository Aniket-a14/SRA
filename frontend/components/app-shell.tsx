"use client"

import { LayerProvider } from "@/lib/layer-context"
import { AppSidebar } from "@/components/app-sidebar"
import { Navbar } from "@/components/navbar"

export function AppShell({ children }: { children: React.ReactNode }) {
    return (
        <LayerProvider>
            <div className="min-h-screen bg-background flex flex-col">
                <Navbar /> {/* Keep top navbar for now, or replace specific parts */}
                <div className="flex flex-1 pt-[64px]"> {/* pt-16 for navbar height */}
                    <AppSidebar className="mt-[64px] h-[calc(100vh-64px)] hidden md:flex" />
                    <main className="flex-1 md:pl-64">
                        {children}
                    </main>
                </div>
            </div>
        </LayerProvider>
    )
}
