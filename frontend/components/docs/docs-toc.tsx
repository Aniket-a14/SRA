"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { ListFilter } from "lucide-react"

export interface TocItem {
    id: string
    title: string
    level?: number
}

interface DocsTocProps {
    items: TocItem[]
    className?: string
}

export function DocsToc({ items, className }: DocsTocProps) {
    const [activeId, setActiveId] = React.useState<string>("")

    React.useEffect(() => {
        if (!items || items.length === 0) return

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setActiveId(entry.target.id)
                    }
                })
            },
            {
                rootMargin: "-80px 0% -60% 0%",
                threshold: 0.1
            }
        )

        items.forEach((item) => {
            const el = document.getElementById(item.id)
            if (el) observer.observe(el)
        })

        return () => observer.disconnect()
    }, [items])

    if (!items || items.length === 0) return null

    const scrollTo = (id: string) => {
        const el = document.getElementById(id)
        if (el) {
            el.scrollIntoView({ behavior: "smooth" })
            setActiveId(id)
        }
    }

    return (
        <div className={cn("space-y-3", className)}>
            <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                <ListFilter className="h-3.5 w-3.5" />
                On this page
            </p>
            <nav className="space-y-1 text-xs">
                {items.map((item) => {
                    const isActive = activeId === item.id
                    return (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => scrollTo(item.id)}
                            className={cn(
                                "block w-full text-left py-1 transition-colors leading-snug",
                                item.level === 2 ? "pl-3 text-[11px]" : "font-medium",
                                isActive
                                    ? "text-primary font-semibold translate-x-1"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {item.title}
                        </button>
                    )
                })}
            </nav>
        </div>
    )
}
