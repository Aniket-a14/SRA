"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    Search,
    ChevronDown,
    ChevronRight,
    Folder,
    FolderOpen,
    FileCode2,
    ArrowLeft,
    Layers,
    GitFork
} from "lucide-react"
import { DOCS_CATEGORIES, DocCategory } from "@/lib/docs-data"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"

interface DocsSidebarProps {
    onSearchClick: () => void
    className?: string
}

export function DocsSidebar({ onSearchClick, className }: DocsSidebarProps) {
    const pathname = usePathname()
    const currentSlug = pathname.replace("/docs/", "").replace("/docs", "")

    const [manuallyToggled, setManuallyToggled] = React.useState<Record<string, boolean>>({})

    const isFolderOpen = (slug: string) => {
        if (manuallyToggled[slug] !== undefined) {
            return manuallyToggled[slug]
        }
        return slug === currentSlug || slug === "getting-started"
    }

    const toggleFolder = (slug: string, e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        const currentState = isFolderOpen(slug)
        setManuallyToggled((prev) => ({
            ...prev,
            [slug]: !currentState
        }))
    }

    const expandAll = () => {
        const all: Record<string, boolean> = {}
        DOCS_CATEGORIES.forEach((c) => {
            all[c.slug] = true
        })
        setManuallyToggled(all)
    }

    const collapseAll = () => {
        const all: Record<string, boolean> = {}
        DOCS_CATEGORIES.forEach((c) => {
            all[c.slug] = false
        })
        setManuallyToggled(all)
    }

    return (
        <aside className={cn("flex flex-col h-full border-r border-foreground/10 bg-background select-none", className)}>
            {/* Top Branding & Search */}
            <div className="p-4 border-b border-foreground/10 shrink-0 space-y-3">
                <div className="flex items-center justify-between">
                    <Link href="/docs" className="flex items-center gap-2 group">
                        <span className="text-xl font-display font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
                            SRA
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono mt-1 px-1.5 py-0.2 border border-foreground/10">
                            DOCS TREE
                        </span>
                    </Link>
                    <Badge variant="outline" className="text-[10px] font-mono py-0 px-1.5 border-foreground/20">
                        v4.2.2
                    </Badge>
                </div>

                {/* Quick Search Button */}
                <button
                    type="button"
                    onClick={onSearchClick}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 border border-foreground/10 bg-muted/5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors group"
                >
                    <div className="flex items-center gap-2">
                        <Search className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                        <span className="font-mono text-[11px]">Search docs tree...</span>
                    </div>
                    <kbd className="hidden sm:inline-flex px-1 py-0.5 text-[9px] font-mono text-muted-foreground bg-background border border-foreground/10">
                        ⌘K
                    </kbd>
                </button>

                {/* Tree Controls */}
                <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground pt-1 border-t border-foreground/5">
                    <span className="flex items-center gap-1">
                        <GitFork className="h-3 w-3 text-primary" />
                        <span>Tree Navigator</span>
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={expandAll}
                            className="hover:text-foreground hover:underline"
                        >
                            expand
                        </button>
                        <span>/</span>
                        <button
                            type="button"
                            onClick={collapseAll}
                            className="hover:text-foreground hover:underline"
                        >
                            collapse
                        </button>
                    </div>
                </div>
            </div>

            {/* Tree Navigation Area */}
            <ScrollArea className="flex-1 px-3 py-4">
                <div className="space-y-1 font-mono text-xs">
                    {/* Root Node */}
                    <div className="mb-3">
                        <Link
                            href="/docs"
                            className={cn(
                                "flex items-center gap-2 px-2 py-1.5 transition-colors group border-l-2",
                                pathname === "/docs"
                                    ? "border-primary bg-foreground/5 text-foreground font-semibold"
                                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                            )}
                        >
                            <Layers className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="font-sans text-xs">00. Executive Architecture</span>
                        </Link>
                    </div>

                    {/* Directory Tree Pillars */}
                    <div className="relative pl-1">
                        {DOCS_CATEGORIES.map((cat, catIdx) => (
                            <CategoryTreeNode
                                key={cat.id}
                                category={cat}
                                index={catIdx + 1}
                                isOpen={isFolderOpen(cat.slug)}
                                onToggle={(e) => toggleFolder(cat.slug, e)}
                                currentPathname={pathname}
                            />
                        ))}
                    </div>
                </div>
            </ScrollArea>

            {/* Back to Workspace Footer */}
            <div className="p-3 border-t border-foreground/10 shrink-0">
                <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="w-full justify-start gap-2 text-xs text-muted-foreground hover:text-foreground h-8 font-sans"
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

interface CategoryTreeNodeProps {
    category: DocCategory
    index: number
    isOpen: boolean
    onToggle: (e: React.MouseEvent) => void
    currentPathname: string
}

function CategoryTreeNode({
    category,
    index,
    isOpen,
    onToggle,
    currentPathname
}: CategoryTreeNodeProps) {
    const isCategoryActive = currentPathname === `/docs/${category.slug}`

    return (
        <div className="mb-2">
            {/* Folder Header Node */}
            <div
                className={cn(
                    "flex items-center justify-between py-1 px-2 transition-colors group cursor-pointer border-l-2",
                    isCategoryActive
                        ? "border-primary bg-foreground/5 text-foreground font-semibold"
                        : "border-transparent text-foreground/80 hover:bg-foreground/5 hover:text-foreground"
                )}
            >
                <Link
                    href={`/docs/${category.slug}`}
                    className="flex items-center gap-1.5 min-w-0 flex-1 py-0.5"
                >
                    <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                        {index < 10 ? `0${index}` : index}.
                    </span>
                    {isOpen ? (
                        <FolderOpen className="h-3.5 w-3.5 text-primary shrink-0" />
                    ) : (
                        <Folder className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0" />
                    )}
                    <span className="font-sans text-xs truncate">
                        {category.shortTitle || category.title}
                    </span>
                </Link>

                <button
                    type="button"
                    onClick={onToggle}
                    className="p-1 text-muted-foreground hover:text-foreground shrink-0 rounded transition-colors"
                    aria-label={isOpen ? "Collapse category" : "Expand category"}
                >
                    {isOpen ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                    )}
                </button>
            </div>

            {/* Tree Branch Children */}
            {isOpen && (
                <div className="relative ml-3.5 pl-3 border-l border-foreground/15 my-1 space-y-0.5">
                    {category.sections.map((section) => (
                        <div key={section.id} className="relative group">
                            {/* Tree branch connector line ├── */}
                            <span className="absolute -left-3 top-2.5 w-2.5 h-px bg-foreground/20 group-hover:bg-foreground/40 transition-colors" />

                            <a
                                href={`/docs/${category.slug}#${section.id}`}
                                className="flex items-center gap-1.5 py-1 px-2 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/10 transition-colors rounded-xs truncate font-sans block"
                            >
                                <FileCode2 className="h-3 w-3 shrink-0 text-muted-foreground/70 group-hover:text-primary transition-colors" />
                                <span className="truncate">{section.title}</span>
                            </a>

                            {/* Level 2 Subsections (if present) */}
                            {section.subsections && section.subsections.length > 0 && (
                                <div className="ml-3 pl-2.5 border-l border-foreground/10 my-0.5 space-y-0.5">
                                    {section.subsections.map((sub) => (
                                        <a
                                            key={sub.id}
                                            href={`/docs/${category.slug}#${sub.id}`}
                                            className="block py-0.5 px-1.5 text-[10px] text-muted-foreground/70 hover:text-foreground hover:bg-muted/10 transition-colors truncate font-sans"
                                        >
                                            <span className="text-primary/50 mr-1">└</span>
                                            {sub.title}
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
