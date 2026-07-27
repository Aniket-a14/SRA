"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useEffect, useMemo, useRef } from "react"
import { usePacedText } from "@/lib/paced-text"

/** How much of the newest text is still wet — rendered progressively out of focus. */
const TAIL_LENGTH = 190
const TAIL_SEGMENTS = 7

// The stages the pipeline actually emits, collapsed to the phases a reader cares about.
const PHASES = [
    { key: "product_owner", label: "Scope", title: "Reading the brief" },
    { key: "rag_retrieval", label: "Precedent", title: "Consulting precedent" },
    { key: "architect", label: "Architecture", title: "Designing the system" },
    { key: "drafting", label: "Drafting", title: "Setting the specification" },
    { key: "diagram_repair", label: "Diagrams", title: "Drawing the diagrams" },
    { key: "reflection", label: "Review", title: "Reading it back" },
    { key: "final_evaluation", label: "Evaluation", title: "Final checks" },
] as const

/** Only the drafting stages emit tokens; everything after them audits what was written. */
const isWritingStage = (stage?: string | null) =>
    !!stage && (stage.startsWith("developer_") || stage === "drafting")

export function phaseIndexFor(stage?: string | null) {
    if (!stage) return 0
    if (isWritingStage(stage)) return 3
    if (stage.startsWith("reflection")) return 5
    if (stage === "completed" || stage === "failed") return PHASES.length - 1
    const found = PHASES.findIndex(p => p.key === stage)
    return found === -1 ? 0 : found
}

export function AnalysisLoading({ liveMessage, liveText, liveStage }: { liveMessage?: string | null, liveText?: string, liveStage?: string | null }) {
    // `started` latches, so returning to the opening state between two model calls — which reads
    // as the run having restarted — cannot happen once the draft is on screen.
    const { shown, started } = usePacedText(liveText ?? "")

    const phase = phaseIndexFor(liveStage)
    const writing = isWritingStage(liveStage)
    const status = liveMessage || "Waiting for the first stage to report…"

    return (
        <div className="flex h-[calc(100vh-64px)] w-full flex-col items-center bg-background">
            <header className="w-full max-w-2xl shrink-0 px-6 pt-8 pb-2 sm:pt-10">
                <div className="flex items-baseline justify-between gap-4">
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        {PHASES[phase].label}
                    </span>
                    <span className="font-mono text-[10px] tabular-nums text-muted-foreground/60">
                        {phase + 1} / {PHASES.length}
                    </span>
                </div>

                {/* The ink rule: fills across the page as the pipeline advances. */}
                <div className="mt-2.5 h-px w-full overflow-hidden bg-foreground/15">
                    <motion.div
                        className="h-full w-full origin-left bg-foreground"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: (phase + 1) / PHASES.length }}
                        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                    />
                </div>

                <div className="mt-7">
                    <AnimatePresence mode="wait">
                        <motion.h1
                            key={PHASES[phase].title}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.45, ease: "easeOut" }}
                            className="font-display text-[1.75rem] leading-[1.15] tracking-tight text-foreground sm:text-[2rem]"
                        >
                            {PHASES[phase].title}
                        </motion.h1>
                    </AnimatePresence>
                </div>

                <div className="mt-2 h-5">
                    <AnimatePresence mode="wait">
                        <motion.p
                            key={status}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.35 }}
                            className="truncate text-sm text-muted-foreground"
                        >
                            {status}
                        </motion.p>
                    </AnimatePresence>
                </div>
            </header>

            <Page text={shown} writing={writing} started={started} />
        </div>
    )
}

// Settled text is sharp; the newest characters grade out of focus toward the caret. Graded in
// segments because a CSS filter cannot be a gradient and a span per character would thrash.
function Page({ text, writing, started }: { text: string, writing: boolean, started: boolean }) {
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        // Jump, never smooth-scroll — the window releases text every 40ms and animations would queue.
        const el = scrollRef.current
        if (el) el.scrollTop = el.scrollHeight
    }, [text])

    const showTail = writing && text.length > TAIL_LENGTH
    const settled = showTail ? text.slice(0, text.length - TAIL_LENGTH) : text
    const tail = showTail ? text.slice(-TAIL_LENGTH) : ""

    const segments = useMemo(() => {
        const size = Math.ceil(tail.length / TAIL_SEGMENTS) || 1
        const out: string[] = []
        for (let i = 0; i < tail.length; i += size) out.push(tail.slice(i, i + size))
        return out
    }, [tail])

    return (
        <div
            ref={scrollRef}
            className="w-full max-w-2xl flex-1 overflow-y-auto px-6 pt-6 pb-14"
            // A fixed fade, not a percentage — on a short viewport a percentage collapses and the
            // scrolled draft crowds the heading.
            style={{
                maskImage: "linear-gradient(to bottom, transparent 0, black 3rem)",
                WebkitMaskImage: "linear-gradient(to bottom, transparent 0, black 3rem)"
            }}
        >
            {started ? (
                <motion.div
                    data-testid="draft-page"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6 }}
                    className="text-[1.0625rem] leading-[1.85] break-words whitespace-pre-wrap text-foreground"
                >
                    {settled}
                    {segments.map((segment, i) => {
                        const t = segments.length === 1 ? 0 : i / (segments.length - 1)
                        return (
                            <span
                                key={i}
                                style={{
                                    filter: `blur(${(t * t * 2.4).toFixed(2)}px)`,
                                    opacity: 1 - t * 0.5
                                }}
                            >
                                {segment}
                            </span>
                        )
                    })}
                    {writing && (
                        <motion.span
                            aria-hidden
                            animate={{ opacity: [1, 0.1, 1] }}
                            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                            className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.18em] bg-foreground"
                        />
                    )}
                    {writing && <RuledLines />}
                </motion.div>
            ) : (
                <RuledLines />
            )}
        </div>
    )
}

/** The shape of the sentences that have not been set yet. */
function RuledLines() {
    return (
        <div className="mt-6 space-y-[0.9rem]" aria-hidden>
            {[92, 100, 84, 96, 61].map((width, i) => (
                <motion.div
                    key={i}
                    className="h-[0.6rem] bg-foreground/[0.07]"
                    style={{ width: `${width}%` }}
                    animate={{ opacity: [0.45, 1, 0.45] }}
                    transition={{ duration: 2.1, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
                />
            ))}
        </div>
    )
}
