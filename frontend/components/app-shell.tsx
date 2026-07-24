"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import { LayerProvider } from "@/lib/layer-context"
import { AppSidebar } from "@/components/app-sidebar"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

export function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()

    return (
        <LayerProvider>
            <div className="min-h-screen bg-background">
                <AppSidebar className="hidden md:flex" />

                {/* Mobile top bar — the only way into navigation on small screens. */}
                <header className="md:hidden sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-foreground/10 bg-background/80 px-4 backdrop-blur">
                    {/* Keyed by pathname so navigating (router.push inside the sidebar)
                        remounts the drawer closed — no setState-in-effect needed. */}
                    <Sheet key={pathname}>
                        <SheetTrigger asChild>
                            <button
                                type="button"
                                aria-label="Open navigation menu"
                                className="-ml-1 flex h-9 w-9 items-center justify-center rounded-md hover:bg-foreground/5"
                            >
                                <Menu className="h-5 w-5" />
                            </button>
                        </SheetTrigger>
                        <SheetContent side="left" className="w-72 max-w-[85vw] p-0">
                            <SheetTitle className="sr-only">Navigation</SheetTitle>
                            <AppSidebar inSheet />
                        </SheetContent>
                    </Sheet>
                    <Link href="/" className="flex items-center gap-2">
                        <span className="text-lg font-display">SRA</span>
                        <span className="mt-0.5 font-mono text-[10px] text-muted-foreground">MULTI-FORMAT</span>
                    </Link>
                </header>

                <main className="md:pl-64">
                    {children}
                </main>
            </div>
        </LayerProvider>
    )
}
