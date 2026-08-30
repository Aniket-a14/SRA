"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, Search, Activity } from "lucide-react"
import { LayerProvider } from "@/lib/layer-context"
import { AppSidebar } from "@/components/app-sidebar"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { CommandPalette } from "@/components/command-palette"
import { ActivityCenter } from "@/components/activity-center"
import { NotificationCenter } from "@/components/notification-center"
import { WelcomeBackNotifier } from "@/components/welcome-back-dialog"

export function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false)
    const [activityCenterOpen, setActivityCenterOpen] = React.useState(false)

    return (
        <LayerProvider>
            <div className="min-h-screen bg-background flex flex-col">
                <WelcomeBackNotifier />

                <CommandPalette
                    open={commandPaletteOpen}
                    onOpenChange={setCommandPaletteOpen}
                    onOpenActivityCenter={() => setActivityCenterOpen(true)}
                />

                <ActivityCenter
                    open={activityCenterOpen}
                    onOpenChange={setActivityCenterOpen}
                />

                <AppSidebar
                    className="hidden md:flex"
                    onOpenCommandPalette={() => setCommandPaletteOpen(true)}
                    onOpenActivityCenter={() => setActivityCenterOpen(true)}
                />

                {/* Mobile top bar — navigation and quick tools on small screens */}
                <header className="md:hidden sticky top-0 z-40 flex h-14 items-center justify-between border-b border-foreground/10 bg-background/80 px-4 backdrop-blur">
                    <div className="flex items-center gap-3">
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
                                <AppSidebar
                                    inSheet
                                    onOpenCommandPalette={() => setCommandPaletteOpen(true)}
                                    onOpenActivityCenter={() => setActivityCenterOpen(true)}
                                />
                            </SheetContent>
                        </Sheet>
                        <Link href="/" className="flex items-center gap-2">
                            <span className="text-lg font-display">SRA</span>
                            <span className="mt-0.5 font-mono text-[10px] text-muted-foreground">MULTI-FORMAT</span>
                        </Link>
                    </div>

                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-muted-foreground hover:text-foreground"
                            onClick={() => setCommandPaletteOpen(true)}
                            aria-label="Search"
                        >
                            <Search className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-muted-foreground hover:text-foreground"
                            onClick={() => setActivityCenterOpen(true)}
                            aria-label="Activity center"
                        >
                            <Activity className="h-4 w-4" />
                        </Button>
                        <NotificationCenter />
                    </div>
                </header>

                {/* Desktop top header bar for quick search, activity and notifications */}
                <header className="hidden md:flex sticky top-0 z-20 h-12 items-center justify-between border-b border-foreground/10 bg-background/80 px-6 backdrop-blur ml-64">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-2 px-3 text-xs text-muted-foreground hover:text-foreground border-foreground/10 bg-muted/10 rounded-full"
                            onClick={() => setCommandPaletteOpen(true)}
                        >
                            <Search className="h-3.5 w-3.5" />
                            <span>Quick search workspace...</span>
                            <kbd className="pointer-events-none ml-2 inline-flex h-4 select-none items-center gap-0.5 rounded border border-foreground/10 bg-muted px-1.5 font-mono text-[9px] font-medium text-muted-foreground">
                                ⌘K
                            </kbd>
                        </Button>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => setActivityCenterOpen(true)}
                        >
                            <Activity className="h-3.5 w-3.5" />
                            <span>Activity</span>
                        </Button>
                        <NotificationCenter />
                    </div>
                </header>

                <main className="md:pl-64 flex-1 flex flex-col min-h-0">
                    {children}
                </main>
            </div>
        </LayerProvider>
    )
}
