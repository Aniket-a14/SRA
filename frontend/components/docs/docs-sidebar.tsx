"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    Sparkles,
    Cpu,
    FileText,
    Terminal,
    Code,
    ShieldCheck,
    Server,
    BookOpen,
    Search,
    ArrowLeft
} from "lucide-react"
import { DOCS_CATEGORIES } from "@/lib/docs-data"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"

const ICON_MAP: Record<string, React.ElementType> = {
    Sparkles,
    Cpu,
    FileText,
    Terminal,
    Code,
    ShieldCheck,
    Server,
    BookOpen
}

interface DocsSidebarProps {
    onSearchClick: () => void
    className?: string
}

export function DocsSidebar({ onSearchClick, className }: DocsSidebarProps) {
    const pathname = usePathname()

    return (
        <aside className={cn("flex flex-col h-full border-r border-foreground/10 bg-background", className)}>
            {/* Top Branding & Search */}
            <div className="p-4 border-b border-foreground/10 shrink-0 space-y-3">
                <div className="flex items-center justify-between">
                    <Link href="/docs" className="flex items-center gap-2">
                        <span className="text-xl font-display">SRA</span>
                        <span className="text-[10px] text-muted-foreground font-mono mt-1">DOCS</span>
                    </Link>
                    <Badge variant="outline" className="text-[10px] font-mono py-0 px-1.5 border-foreground/20">
                        v4.2.2
                    </Badge>
                </div>

                {/* Quick Search Button */}
                <button
                    type="button"
                    onClick={onSearchClick}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 border border-foreground/10 bg-muted/10 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors group"
                >
                    <div className="flex items-center gap-2">
                        <Search className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                        <span>Search docs...</span>
                    </div>
                    <kbd className="hidden sm:inline-flex px-1 py-0.5 text-[9px] font-mono text-muted-foreground bg-background border border-foreground/10">
                        ⌘K
                    </kbd>
                </button>
            </div>

            {/* Navigation Sections */}
            <ScrollArea className="flex-1 px-2 py-4">
                <div className="space-y-6">
                    {/* Overview Link */}
                    <div className="space-y-1">
                        <Link
                            href="/docs"
                            className={cn(
                                "flex items-center gap-2.5 px-2.5 py-1.5 text-xs transition-colors",
                                pathname === "/docs"
                                    ? "bg-foreground/5 text-foreground font-semibold border-l-2 border-primary pl-2"
                                    : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                            )}
                        >
                            <BookOpen className="h-3.5 w-3.5 shrink-0" />
                            <span>Executive Overview</span>
                        </Link>
                    </div>

                    {/* Category Sections */}
                    <div className="space-y-1">
                        <p className="px-2.5 text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/70 mb-2">
                            Documentation Pillars
                        </p>

                        {DOCS_CATEGORIES.map((cat, idx) => {
                            const Icon = ICON_MAP[cat.icon] || FileText
                            const isActive = pathname === `/docs/${cat.slug}`

                            return (
                                <div key={cat.id} className="space-y-0.5">
                                    <Link
                                        href={`/docs/${cat.slug}`}
                                        className={cn(
                                            "flex items-center justify-between px-2.5 py-1.5 text-xs transition-all group",
                                            isActive
                                                ? "bg-foreground/5 text-foreground font-semibold border-l-2 border-primary pl-2"
                                                : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                                        )}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="font-mono text-[10px] text-muted-foreground/50 shrink-0">
                                                0{idx + 1}
                                            </span>
                                            <Icon className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                                            <span className="truncate">{cat.shortTitle || cat.title}</span>
                                        </div>
                                    </Link>

                                    {/* If active, show nested section jump links */}
                                    {isActive && (
                                        <div className="pl-6 pr-2 py-1 space-y-1 border-l border-foreground/10 ml-4 my-1">
                                            {cat.sections.map((sec) => (
                                                <a
                                                    key={sec.id}
                                                    href={`#${sec.id}`}
                                                    className="block text-[11px] text-muted-foreground hover:text-foreground py-0.5 truncate transition-colors font-sans"
                                                >
                                                    {sec.title}
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </ScrollArea>

            {/* Back to Workspace Footer */}
            <div className="p-3 border-t border-foreground/10 shrink-0">
                <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="w-full justify-start gap-2 text-xs text-muted-foreground hover:text-foreground h-8"
                >
                    <Link href="/analysis">
                        <ArrowLeft className="h-3.5 w-3.5" />
                        <span>Return to Workspace</span>
                    </Link>
                </Button>
            </div>
        </aside>
    )
}
