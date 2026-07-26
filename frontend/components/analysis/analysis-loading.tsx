"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useEffect, useMemo, useRef, useState } from "react"
import { Sparkles, Brain, Cpu, Database, Network } from "lucide-react"

const messages = [
    "Synchronizing requirements...",
    "Applying IEEE standards...",
    "Generating system diagrams...",
    "Architecting data flows...",
    "Finalizing governance checks...",
    "Optimizing project vision...",
]

/** How much of the newest text is still "wet" — rendered progressively out of focus. */
const TAIL_LENGTH = 190
const TAIL_SEGMENTS = 7

/** Only the drafting stages emit tokens; everything after them audits what was written. */
const isWritingStage = (stage?: string | null) =>
    !!stage && (stage.startsWith("developer_") || stage === "drafting")

export function AnalysisLoading({ liveMessage, liveText, liveStage }: { liveMessage?: string | null, liveText?: string, liveStage?: string | null }) {
    const [msgIndex, setMsgIndex] = useState(0)

    useEffect(() => {
        // Once real stage-by-stage progress is streaming in, stop cycling the generic
        // placeholder copy — the live message replaces it below.
        if (liveMessage) return

        const interval = setInterval(() => {
            setMsgIndex((prev) => (prev + 1) % messages.length)
        }, 3000)
        return () => clearInterval(interval)
    }, [liveMessage])

    const status = liveMessage || messages[msgIndex]

    // The orb covers the stages before drafting, which have nothing to show.
    if (liveText) {
        return <StreamingDraft text={liveText} status={status} writing={isWritingStage(liveStage)} />
    }

    return (
        <div className="flex h-[calc(100vh-64px)] w-full items-center justify-center bg-background overflow-hidden relative">
            {/* Background Decorative Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.1, 0.2, 0.1],
                    }}
                    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-primary/20 rounded-full blur-[120px]"
                />
                <motion.div
                    animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.1, 0.15, 0.1],
                    }}
                    transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                    className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-blue-500/10 rounded-full blur-[120px]"
                />
            </div>

            <div className="relative flex flex-col items-center max-w-md w-full px-6">
                {/* Animated Core */}
                <div className="relative mb-12">
                    {/* Pulsing rings */}
                    {[1, 1.5, 2].map((scale, i) => (
                        <motion.div
                            key={i}
                            className="absolute inset-0 rounded-full border border-primary/20"
                            initial={{ scale: 1, opacity: 0.5 }}
                            animate={{
                                scale: scale * 1.5,
                                opacity: 0,
                            }}
                            transition={{
                                duration: 3,
                                repeat: Infinity,
                                delay: i * 0.8,
                                ease: "easeOut",
                            }}
                        />
                    ))}

                    {/* Main Icon Orb */}
                    <motion.div
                        className="relative h-24 w-24 rounded-full bg-gradient-to-br from-primary via-primary/80 to-blue-600 flex items-center justify-center shadow-[0_0_40px_rgba(var(--primary),0.3)]"
                        animate={{
                            y: [0, -10, 0],
                            boxShadow: [
                                "0 0 20px rgba(59, 130, 246, 0.5)",
                                "0 0 50px rgba(59, 130, 246, 0.8)",
                                "0 0 20px rgba(59, 130, 246, 0.5)",
                            ],
                        }}
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    >
                        <Brain className="h-12 w-12 text-white" />

                        {/* Orbits */}
                        <motion.div
                            className="absolute inset-0 rounded-full border border-white/30"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                        >
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-white shadow-sm" />
                        </motion.div>
                    </motion.div>

                    {/* Floating Icons */}
                    <FloatingIcon icon={<Cpu className="h-4 w-4" />} delay={0} x={-60} y={-40} />
                    <FloatingIcon icon={<Database className="h-4 w-4" />} delay={1.5} x={60} y={40} />
                    <FloatingIcon icon={<Network className="h-4 w-4" />} delay={0.7} x={50} y={-60} />
                    <FloatingIcon icon={<Sparkles className="h-4 w-4" />} delay={2.2} x={-50} y={60} />
                </div>

                {/* Text Content */}
                <div className="text-center space-y-4">
                    <motion.h2
                        className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        Performing Deep Analysis
                    </motion.h2>

                    <div className="h-6 flex items-center justify-center">
                        <AnimatePresence mode="wait">
                            <motion.p
                                key={liveMessage || msgIndex}
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -5 }}
                                transition={{ duration: 0.5 }}
                                className="text-sm text-muted-foreground font-medium flex items-center gap-2"
                            >
                                <motion.span
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                    className="inline-block"
                                >
                                    <Sparkles className="h-3 w-3 text-primary" />
                                </motion.span>
                                {liveMessage || messages[msgIndex]}
                            </motion.p>
                        </AnimatePresence>
                    </div>
                </div>

                {/* Progress bar line */}
                <div className="mt-12 w-full h-1 bg-muted rounded-full overflow-hidden relative">
                    <motion.div
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary to-blue-500"
                        animate={{
                            x: ["-100%", "100%"],
                        }}
                        transition={{
                            duration: 2.5,
                            repeat: Infinity,
                            ease: "easeInOut",
                        }}
                        style={{ width: "50%" }}
                    />
                </div>
            </div>
        </div>
    )
}

// Settled text is sharp; the newest characters grade out of focus toward the caret. Graded in
// segments because a CSS filter cannot be a gradient and a span per character would thrash.
// `writing` is false for the audit stages after drafting, which emit no tokens.
function StreamingDraft({ text, status, writing }: { text: string, status: string, writing: boolean }) {
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        // Jump, never smooth-scroll — chunks land every ~180ms and animations would queue up.
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
        <div className="flex h-[calc(100vh-64px)] w-full flex-col items-center bg-background overflow-hidden relative">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    animate={{ scale: [1, 1.15, 1], opacity: [0.06, 0.14, 0.06] }}
                    transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute -top-1/3 left-1/2 -translate-x-1/2 w-2/3 h-1/2 bg-primary/20 rounded-full blur-[140px]"
                />
            </div>

            <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="relative z-10 w-full max-w-2xl px-6 pt-8 pb-4 shrink-0"
            >
                <div className="flex items-center gap-2.5">
                    <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="inline-block shrink-0"
                    >
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                    </motion.span>
                    <AnimatePresence mode="wait">
                        <motion.p
                            key={status}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.35 }}
                            className="text-xs font-medium text-muted-foreground truncate"
                        >
                            {status}
                        </motion.p>
                    </AnimatePresence>
                </div>

                <div className="mt-3 h-px w-full bg-foreground/10 overflow-hidden relative">
                    <motion.div
                        className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-primary to-transparent"
                        animate={{ x: ["-100%", "300%"] }}
                        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                    />
                </div>
            </motion.div>

            <div
                ref={scrollRef}
                className="relative z-10 w-full max-w-2xl flex-1 overflow-y-auto px-6 pb-10"
                style={{
                    maskImage: "linear-gradient(to bottom, transparent 0%, black 8%)",
                    WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 8%)"
                }}
            >
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5 }}
                    className="whitespace-pre-wrap break-words text-[0.9375rem] leading-7 text-foreground/90"
                >
                    {settled}
                    {segments.map((segment, i) => {
                        const t = segments.length === 1 ? 0 : i / (segments.length - 1)
                        return (
                            <span
                                key={i}
                                style={{
                                    filter: `blur(${(t * t * 2.4).toFixed(2)}px)`,
                                    opacity: 1 - t * 0.55
                                }}
                            >
                                {segment}
                            </span>
                        )
                    })}
                    {writing && (
                        <motion.span
                            aria-hidden
                            animate={{ opacity: [1, 0.15, 1] }}
                            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                            className="inline-block w-[2px] h-[1.1em] translate-y-[0.2em] ml-0.5 rounded-full bg-primary"
                        />
                    )}
                </motion.div>

                {/* The shape of the sentences that have not arrived yet. */}
                {writing && (
                    <div className="mt-4 space-y-2.5" aria-hidden>
                        {[88, 96, 62].map((width, i) => (
                            <motion.div
                                key={i}
                                className="h-2.5 rounded-full bg-foreground/10"
                                style={{ width: `${width}%` }}
                                animate={{ opacity: [0.3, 0.65, 0.3] }}
                                transition={{ duration: 1.9, repeat: Infinity, delay: i * 0.22, ease: "easeInOut" }}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

function FloatingIcon({ icon, delay, x, y }: { icon: React.ReactNode, delay: number, x: number, y: number }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{
                opacity: [0, 1, 1, 0],
                scale: [0.5, 1, 1, 0.5],
                x: [x * 0.8, x, x * 1.1],
                y: [y * 0.8, y, y * 1.1]
            }}
            transition={{
                duration: 4,
                repeat: Infinity,
                delay,
                ease: "easeInOut"
            }}
            className="absolute h-8 w-8 rounded-lg bg-background/80 backdrop-blur-sm border shadow-sm flex items-center justify-center text-primary"
        >
            {icon}
        </motion.div>
    )
}
