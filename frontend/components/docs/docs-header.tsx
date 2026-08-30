"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, Search, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { DocsSidebar } from "./docs-sidebar"
import { DOCS_CATEGORIES } from "@/lib/docs-data"

interface DocsHeaderProps {
    onSearchClick: () => void
}

export function DocsHeader({ onSearchClick }: DocsHeaderProps) {
    const pathname = usePathname()
    const [mobileOpen, setMobileOpen] = React.useState(false)

    // Compute active breadcrumb
    const currentCategory = React.useMemo(() => {
        const slug = pathname.replace("/docs/", "").replace("/docs", "")
        return DOCS_CATEGORIES.find((c) => c.slug === slug)
    }, [pathname])

    return (
        <header className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 h-13 border-b border-foreground/10 bg-background/80 backdrop-blur-md shrink-0">
            {/* Left: Mobile Drawer Trigger + Breadcrumbs */}
            <div className="flex items-center gap-3 min-w-0">
                {/* Mobile Drawer */}
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="md:hidden h-8 w-8 text-muted-foreground">
                            <Menu className="h-4 w-4" />
                            <span className="sr-only">Toggle navigation menu</span>
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-0 w-72 sm:w-80">
                        <SheetHeader className="sr-only">
                            <SheetTitle>Documentation Navigation</SheetTitle>
                        </SheetHeader>
                        <DocsSidebar
                            onSearchClick={() => {
                                setMobileOpen(false)
                                onSearchClick()
                            }}
                        />
                    </SheetContent>
                </Sheet>

                {/* Breadcrumb Trail */}
                <nav className="flex items-center gap-1.5 text-xs text-muted-foreground truncate font-sans">
                    <Link href="/docs" className="hover:text-foreground font-medium transition-colors">
                        Docs
                    </Link>
                    {currentCategory && (
                        <>
                            <span className="text-foreground/30">/</span>
                            <span className="text-foreground font-semibold truncate">
                                {currentCategory.shortTitle || currentCategory.title}
                            </span>
                        </>
                    )}
                </nav>
            </div>

            {/* Right: Search + Workspace Link */}
            <div className="flex items-center gap-2 shrink-0">
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-2 text-xs border-foreground/10 text-muted-foreground hover:text-foreground bg-muted/20"
                    onClick={onSearchClick}
                >
                    <Search className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Search</span>
                    <kbd className="hidden sm:inline-flex px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground/70 bg-background border border-foreground/10 rounded">
                        ⌘K
                    </kbd>
                </Button>

                {/* Return to Dashboard */}
                <Button
                    variant="default"
                    size="sm"
                    asChild
                    className="h-8 text-xs gap-1.5 rounded-full hidden xs:inline-flex"
                >
                    <Link href="/analysis">
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Workspace</span>
                    </Link>
                </Button>
            </div>
        </header>
    )
}
