"use client"

import { cn } from "@/lib/utils"

/**
 * Shared editorial primitives that carry the landing page's award-style visual
 * language (Instrument Serif display type, mono eyebrows with a dash, faint grid
 * backdrops, warm monochrome) into the authenticated app surfaces so Projects /
 * Results / Chat stop looking like a generic dashboard.
 */

/** Mono, uppercase, tracked eyebrow with the signature leading dash from the hero. */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <span className={cn("inline-flex items-center gap-3 text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground", className)}>
            <span className="w-8 h-px bg-foreground/30" />
            {children}
        </span>
    )
}

/**
 * Faint ruled-grid backdrop (matches the hero). Purely decorative and
 * pointer-events-none, so it never interferes with the content above it.
 */
export function GridBackdrop({ rows = 6, cols = 10, className }: { rows?: number; cols?: number; className?: string }) {
    return (
        <div className={cn("absolute inset-0 overflow-hidden pointer-events-none opacity-[0.35]", className)} aria-hidden>
            {Array.from({ length: rows }).map((_, i) => (
                <div key={`h-${i}`} className="absolute h-px bg-foreground/10 left-0 right-0" style={{ top: `${(100 / (rows + 1)) * (i + 1)}%` }} />
            ))}
            {Array.from({ length: cols }).map((_, i) => (
                <div key={`v-${i}`} className="absolute w-px bg-foreground/10 top-0 bottom-0" style={{ left: `${(100 / (cols + 1)) * (i + 1)}%` }} />
            ))}
        </div>
    )
}

/**
 * Big editorial masthead: eyebrow + oversized serif title + optional lede and
 * trailing actions, over a grid backdrop. Used at the top of Projects and the
 * document/results view.
 */
export function Masthead({
    eyebrow,
    title,
    lede,
    actions,
    index,
    className,
}: {
    eyebrow?: React.ReactNode
    title: React.ReactNode
    lede?: React.ReactNode
    actions?: React.ReactNode
    index?: string
    className?: string
}) {
    return (
        <header className={cn("relative", className)}>
            <GridBackdrop />
            <div className="relative z-10">
                <div className="flex items-start justify-between gap-6 flex-wrap">
                    <div className="min-w-0 animate-fade-up">
                        {eyebrow && <div className="mb-3.5">{eyebrow}</div>}
                        <h1 className="font-display leading-[0.9] tracking-tight text-[clamp(2.25rem,6vw,4.5rem)]">
                            {index && <span className="align-top text-[0.28em] font-mono text-muted-foreground mr-3 tracking-normal">{index}</span>}
                            {title}
                        </h1>
                        {lede && (
                            <p className="mt-4 max-w-xl text-base sm:text-lg text-muted-foreground leading-relaxed animate-fade-up delay-100">
                                {lede}
                            </p>
                        )}
                    </div>
                    {actions && <div className="flex items-center gap-2 shrink-0 animate-fade-up delay-200">{actions}</div>}
                </div>
            </div>
        </header>
    )
}
