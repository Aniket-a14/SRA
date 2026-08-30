"use client"

import * as React from "react"
import { Search, FileText, Sparkles, ArrowRight } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { DOCS_CATEGORIES } from "@/lib/docs-data"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"

interface DocsSearchProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

interface SearchResult {
    categorySlug: string
    categoryTitle: string
    sectionId: string
    sectionTitle: string
    summary: string
    badge?: string
}

export function DocsSearch({ open, onOpenChange }: DocsSearchProps) {
    const [query, setQuery] = React.useState("")
    const router = useRouter()

    // Build searchable index
    const allResults = React.useMemo(() => {
        const results: SearchResult[] = []
        DOCS_CATEGORIES.forEach((cat) => {
            cat.sections.forEach((sec) => {
                results.push({
                    categorySlug: cat.slug,
                    categoryTitle: cat.shortTitle || cat.title,
                    sectionId: sec.id,
                    sectionTitle: sec.title,
                    summary: sec.summary,
                    badge: cat.badge
                })
                sec.subsections?.forEach((sub) => {
                    results.push({
                        categorySlug: cat.slug,
                        categoryTitle: cat.shortTitle || cat.title,
                        sectionId: sub.id,
                        sectionTitle: sub.title,
                        summary: `${sec.title} > ${sub.title}`,
                        badge: cat.badge
                    })
                })
            })
        })
        return results
    }, [])

    const filteredResults = React.useMemo(() => {
        if (!query.trim()) return allResults.slice(0, 8)
        const q = query.toLowerCase()
        return allResults.filter(
            (r) =>
                r.sectionTitle.toLowerCase().includes(q) ||
                r.categoryTitle.toLowerCase().includes(q) ||
                r.summary.toLowerCase().includes(q)
        ).slice(0, 10)
    }, [query, allResults])

    const handleSelect = (categorySlug: string, sectionId: string) => {
        onOpenChange(false)
        router.push(`/docs/${categorySlug}#${sectionId}`)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-4 border-b border-foreground/10">
                    <DialogTitle className="sr-only">Search Documentation</DialogTitle>
                    <div className="flex items-center gap-3">
                        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                        <Input
                            placeholder="Search docs, APIs, CLI commands, standards..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-8 text-sm placeholder:text-muted-foreground/60"
                            autoFocus
                        />
                        <kbd className="hidden sm:inline-flex px-2 py-0.5 text-[10px] font-mono text-muted-foreground bg-muted/40 border border-foreground/10 rounded">
                            ESC
                        </kbd>
                    </div>
                </DialogHeader>

                <div className="max-h-[350px] overflow-y-auto p-2 divide-y divide-foreground/5">
                    {filteredResults.length === 0 ? (
                        <div className="p-8 text-center text-sm text-muted-foreground space-y-1">
                            <p>No documentation results found for &ldquo;{query}&rdquo;</p>
                            <p className="text-xs text-muted-foreground/60">Try searching for keywords like &ldquo;CLI&rdquo;, &ldquo;BYOK&rdquo;, &ldquo;IEEE 830&rdquo;, or &ldquo;REST API&rdquo;.</p>
                        </div>
                    ) : (
                        filteredResults.map((item, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => handleSelect(item.categorySlug, item.sectionId)}
                                className="w-full p-3 text-left transition-colors flex items-start gap-3 rounded-lg hover:bg-muted/40 group"
                            >
                                <div className="p-1.5 rounded-md bg-foreground/5 text-muted-foreground group-hover:text-primary shrink-0 mt-0.5">
                                    <FileText className="h-4 w-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary">
                                            {item.sectionTitle}
                                        </p>
                                        {item.badge && (
                                            <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono uppercase tracking-wider">
                                                {item.badge}
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                                        {item.summary}
                                    </p>
                                    <p className="text-[10px] text-primary/70 font-mono mt-1 flex items-center gap-1">
                                        <span>{item.categoryTitle}</span>
                                        <ArrowRight className="h-2.5 w-2.5" />
                                    </p>
                                </div>
                            </button>
                        ))
                    )}
                </div>

                <div className="px-4 py-2 bg-muted/20 border-t border-foreground/10 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                    <span className="flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-primary" />
                        SRA Enterprise Documentation Index
                    </span>
                    <span>v4.2.2</span>
                </div>
            </DialogContent>
        </Dialog>
    )
}
