"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useEffect, useState } from "react"
import { Sparkles, Brain, Cpu, Database, Network } from "lucide-react"

const messages = [
    "Synchronizing requirements...",
    "Applying IEEE standards...",
    "Generating system diagrams...",
    "Architecting data flows...",
    "Finalizing governance checks...",
    "Optimizing project vision...",
]

export function AnalysisLoading() {
    const [msgIndex, setMsgIndex] = useState(0)

    useEffect(() => {
        const interval = setInterval(() => {
            setMsgIndex((prev) => (prev + 1) % messages.length)
        }, 3000)
        return () => clearInterval(interval)
    }, [])

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
                                key={msgIndex}
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
                                {messages[msgIndex]}
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
