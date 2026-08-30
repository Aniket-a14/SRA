"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import {
    ListFilter,
    Check,
    ArrowUp,
    ShieldCheck,
    Share2
} from "lucide-react"
import { DocCategory } from "@/lib/docs-data"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"

interface DocsRightSidebarProps {
    category?: DocCategory
    className?: string
}

export function DocsRightSidebar({ category, className }: DocsRightSidebarProps) {
    const [activeId, setActiveId] = React.useState<string>("")
    const [scrollProgress, setScrollProgress] = React.useState<number>(0)
    const [copied, setCopied] = React.useState<boolean>(false)

    // Build all TOC items for this category
    const tocItems = React.useMemo(() => {
        if (!category) return []
        const items: { id: string; title: string; level: number }[] = []
        category.sections.forEach((sec) => {
            items.push({ id: sec.id, title: sec.title, level: 1 })
            sec.subsections?.forEach((sub) => {
                items.push({ id: sub.id, title: sub.title, level: 2 })
            })
        })
        return items
    }, [category])

    // Scrollspy intersection observer
    React.useEffect(() => {
        if (tocItems.length === 0) return

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setActiveId(entry.target.id)
                    }
                })
            },
            {
                rootMargin: "-60px 0% -60% 0%",
                threshold: 0.1
            }
        )

        tocItems.forEach((item) => {
            const el = document.getElementById(item.id)
            if (el) observer.observe(el)
        })

        return () => observer.disconnect()
    }, [tocItems])

    // Scroll progress tracker
    React.useEffect(() => {
        const handleScroll = () => {
            const el = document.documentElement
            const scrollTop = el.scrollTop || document.body.scrollTop
            const scrollHeight = el.scrollHeight - el.clientHeight
            if (scrollHeight > 0) {
                const percent = Math.min(100, Math.max(0, Math.round((scrollTop / scrollHeight) * 100)))
                setScrollProgress(percent)
            }
        }

        window.addEventListener("scroll", handleScroll, { passive: true })
        return () => window.removeEventListener("scroll", handleScroll)
    }, [])

    const scrollTo = (id: string) => {
        const el = document.getElementById(id)
        if (el) {
            el.scrollIntoView({ behavior: "smooth" })
            setActiveId(id)
        }
    }

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: "smooth" })
    }

    const copyPageLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href)
            setCopied(true)
            toast.success("Page link copied to clipboard")
            setTimeout(() => setCopied(false), 2000)
        } catch {
            toast.error("Failed to copy link")
        }
    }

    if (!category) return null

    return (
        <aside className={cn("flex flex-col h-full border-l border-foreground/10 bg-background/50 p-5 space-y-6 text-xs select-none", className)}>
            {/* Reading Progress Indicator */}
            <div className="space-y-1.5 border-b border-foreground/10 pb-4">
                <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                    <span>Reading Progress</span>
                    <span className="font-semibold text-foreground">{scrollProgress}%</span>
                </div>
                <div className="h-1 w-full bg-muted/40 overflow-hidden">
                    <div
                        className="h-full bg-primary transition-all duration-150"
                        style={{ width: `${scrollProgress}%` }}
                    />
                </div>
            </div>

            {/* Document Structure (Scrollspy TOC) */}
            <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                <div className="flex items-center justify-between">
                    <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/70 font-semibold flex items-center gap-1.5">
                        <ListFilter className="h-3.5 w-3.5 text-primary" />
                        Page Structure
                    </p>
                    <span className="text-[10px] font-mono text-muted-foreground/50">
                        {tocItems.length} nodes
                    </span>
                </div>

                <nav className="space-y-0.5 border-l border-foreground/10 pl-2 ml-1">
                    {tocItems.map((item) => {
                        const isActive = activeId === item.id

                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => scrollTo(item.id)}
                                className={cn(
                                    "block w-full text-left py-1 px-1.5 transition-all truncate leading-normal font-sans",
                                    item.level === 2 ? "pl-3 text-[11px] text-muted-foreground/80" : "text-xs font-medium",
                                    isActive
                                        ? "text-primary font-semibold bg-primary/5 border-l-2 border-primary -ml-[9px] pl-2"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/10"
                                )}
                            >
                                {item.level === 2 && <span className="text-primary/40 mr-1">└</span>}
                                {item.title}
                            </button>
                        )
                    })}
                </nav>
            </div>

            {/* Document Metadata Inspector Card */}
            <div className="p-3 border border-foreground/10 bg-muted/5 space-y-2.5">
                <div className="flex items-center justify-between border-b border-foreground/10 pb-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Pillar Specification
                    </span>
                    {category.badge && (
                        <Badge variant="outline" className="text-[9px] font-mono py-0 px-1 uppercase">
                            {category.badge}
                        </Badge>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-muted-foreground">
                    <div>
                        <span className="text-[9px] block text-muted-foreground/60 uppercase">Sections</span>
                        <span className="text-foreground font-semibold">{category.sections.length} Chapters</span>
                    </div>
                    <div>
                        <span className="text-[9px] block text-muted-foreground/60 uppercase">Revision</span>
                        <span className="text-foreground font-semibold">v4.2.2</span>
                    </div>
                </div>

                <div className="pt-1 border-t border-foreground/5 flex items-center gap-1.5 text-[10px] text-emerald-600 font-mono">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                    <span>6Cs Quality Audited</span>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-1.5 pt-2 border-t border-foreground/10">
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2 h-7 text-xs border-foreground/10 text-muted-foreground hover:text-foreground"
                    onClick={copyPageLink}
                >
                    {copied ? (
                        <>
                            <Check className="h-3 w-3 text-emerald-600" />
                            <span>Link Copied</span>
                        </>
                    ) : (
                        <>
                            <Share2 className="h-3 w-3" />
                            <span>Share Document Link</span>
                        </>
                    )}
                </Button>

                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2 h-7 text-xs text-muted-foreground hover:text-foreground"
                    onClick={scrollToTop}
                >
                    <ArrowUp className="h-3 w-3" />
                    <span>Back to Top</span>
                </Button>
            </div>
        </aside>
    )
}
