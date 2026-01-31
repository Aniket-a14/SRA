"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Network, RefreshCw, Sparkles, Binary, Shapes } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { generateDFD } from "@/lib/analysis-api"
import { useAuth } from "@/lib/auth-context"
// import DFDViewer, { DFDInput } from "@/components/DFDViewer" // STATIC
import dynamic from 'next/dynamic'
import { DFDInput } from "@/components/DFDViewer" // Type only
import { Diagram } from "@/types/analysis"

const DFDViewer = dynamic(() => import('@/components/DFDViewer'), {
    loading: () => <div className="h-[400px] w-full flex items-center justify-center bg-muted/5 animate-pulse">Loading Diagram...</div>,
    ssr: false // React Flow is client-side only
})

interface DFDDiagramSectionProps {
    data?: { level0: string; level1: string; caption: string } | Diagram | string | Record<string, unknown> | null
    projectId?: string
    projectTitle: string
    description: string
    srsContent?: string
    onUpdate?: (newData: DFDInput) => void
}

export function DFDDiagramSection({ data, projectTitle, description, srsContent, onUpdate }: DFDDiagramSectionProps) {
    const { token, csrfToken } = useAuth()
    const [isLoading, setIsLoading] = useState(false)
    const [localData, setLocalData] = useState<DFDInput | null>(null)
    const [loadingPhase, setLoadingPhase] = useState(0)

    const loadingPhases = [
        { icon: <Sparkles className="h-5 w-5" />, text: "Contextualizing Requirements..." },
        { icon: <Binary className="h-5 w-5" />, text: "Extracting Data Entities..." },
        { icon: <Network className="h-5 w-5" />, text: "Architecting Data Flow Levels..." },
        { icon: <Shapes className="h-5 w-5" />, text: "Compiling Visual Model..." }
    ]

    // Detect if we have new structured data
    const isStructured = data && typeof data === 'object' && 'dfd_level_0' in data;
    const structuredData = localData || (isStructured ? (data as unknown as DFDInput) : null);

    // Detect if empty
    const isEmpty = !structuredData && (!data || (typeof data === 'string' && data.length < 10) || (typeof data === 'object' && Object.keys(data).length === 0));

    const handleGenerate = async () => {
        if (!token) return
        setIsLoading(true)
        setLoadingPhase(0)

        // Cycle through phases
        const phaseInterval = setInterval(() => {
            setLoadingPhase(prev => (prev + 1) % loadingPhases.length)
        }, 2500)

        try {
            const result = await generateDFD(token, {
                projectName: projectTitle,
                description,
                srsContent
            }, csrfToken)

            // Optimistic Update
            setLocalData(result);

            // Call parent update to save to DB
            if (onUpdate) {
                onUpdate(result);
            }
            toast.success("DFD Generated Successfully")
        } catch (err) {
            console.error("[DFD] Generation failed:", err)
            toast.error("Failed to generate DFD")
        } finally {
            clearInterval(phaseInterval)
            setIsLoading(false)
        }
    }

    if (isLoading) {
        return (
            <Card className="bg-slate-900 border-slate-800 w-full min-h-[400px] flex items-center justify-center relative overflow-hidden shadow-2xl">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent)]" />

                <div className="flex flex-col items-center gap-6 relative z-10">
                    <div className="relative h-20 w-20">
                        <motion.div
                            className="absolute inset-0 border-4 border-blue-500/20 rounded-full"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        />
                        <motion.div
                            className="absolute inset-0 border-t-4 border-blue-500 rounded-full"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={loadingPhase}
                                    initial={{ opacity: 0, scale: 0.5 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.5 }}
                                    className="text-blue-400"
                                >
                                    {loadingPhases[loadingPhase].icon}
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </div>

                    <div className="text-center space-y-1">
                        <AnimatePresence mode="wait">
                            <motion.p
                                key={loadingPhase}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="text-lg font-medium text-white tracking-tight"
                            >
                                {loadingPhases[loadingPhase].text}
                            </motion.p>
                        </AnimatePresence>
                        <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">
                            AI Engine Engaged
                        </p>
                    </div>
                </div>

                <motion.div
                    className="absolute bottom-0 left-0 h-1 bg-blue-500"
                    animate={{ width: "100%" }}
                    transition={{ duration: 10, ease: "easeInOut" }}
                />
            </Card>
        )
    }

    if (isEmpty && !structuredData) {
        return (
            <Card className="bg-card border-dashed">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Network className="h-5 w-5 text-primary" />
                        Data Flow Diagram
                    </CardTitle>
                </CardHeader>
                <CardContent className="h-[200px] flex flex-col items-center justify-center gap-4">
                    <p className="text-sm text-muted-foreground">No DFD generated yet.</p>
                    <Button onClick={handleGenerate} variant="outline" className="gap-2">
                        <Network className="h-4 w-4" />
                        Generate DFD
                    </Button>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="bg-card border-border overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Network className="h-5 w-5 text-primary" />
                    Data Flow Diagram
                </CardTitle>
                <Button size="sm" variant="ghost" onClick={handleGenerate} title="Regenerate">
                    <RefreshCw className="h-4 w-4 text-muted-foreground hover:text-primary" />
                </Button>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 bg-muted/5 min-h-[400px]">
                {structuredData ? (
                    <DFDViewer data={structuredData} />
                ) : (
                    <div className="p-8 text-center text-muted-foreground">
                        <p>Legacy format detected. Please regenerate to view in React Flow.</p>
                        <Button onClick={handleGenerate} variant="outline" className="mt-4 gap-2">
                            <RefreshCw className="h-4 w-4" />
                            Regenerate as React Flow
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
