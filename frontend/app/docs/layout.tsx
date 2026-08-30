"use client"

import * as React from "react"
import { DocsSidebar } from "@/components/docs/docs-sidebar"
import { DocsHeader } from "@/components/docs/docs-header"
import { DocsSearch } from "@/components/docs/docs-search"

export default function DocsLayout({ children }: { children: React.ReactNode }) {
    const [searchOpen, setSearchOpen] = React.useState(false)

    // Keyboard shortcut for Cmd+K / Ctrl+K
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault()
                setSearchOpen((prev) => !prev)
            }
        }
        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [])

    return (
        <div className="flex h-screen overflow-hidden bg-background text-foreground">
            {/* Desktop Sidebar (hidden on mobile) */}
            <div className="hidden md:block w-64 lg:w-72 shrink-0 h-full">
                <DocsSidebar onSearchClick={() => setSearchOpen(true)} className="h-full" />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                <DocsHeader onSearchClick={() => setSearchOpen(true)} />
                <main className="flex-1 overflow-y-auto">
                    {children}
                </main>
            </div>

            {/* Search Dialog */}
            <DocsSearch open={searchOpen} onOpenChange={setSearchOpen} />
        </div>
    )
}
