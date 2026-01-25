"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Network, RefreshCw } from "lucide-react"
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
    const { token } = useAuth()
    const [isLoading, setIsLoading] = useState(false)
    const [localData, setLocalData] = useState<DFDInput | null>(null)

    // Detect if we have new structured data
    const isStructured = data && typeof data === 'object' && 'dfd_level_0' in data;
    const structuredData = localData || (isStructured ? (data as unknown as DFDInput) : null);

    // Detect if empty
    const isEmpty = !structuredData && (!data || (typeof data === 'string' && data.length < 10) || (typeof data === 'object' && Object.keys(data).length === 0));

    const handleGenerate = async () => {
        if (!token) return
        setIsLoading(true)
        try {
            const result = await generateDFD(token, {
                projectName: projectTitle,
                description,
                srsContent
            })

            // Optimistic Update
            setLocalData(result);

            // Call parent update to save to DB
            if (onUpdate) {
                onUpdate(result);
            }
            toast.success("DFD Generated")
        } catch (err) {
            console.error("[DFD] Generation failed:", err)
            toast.error("Failed to generate DFD")
        } finally {
            setIsLoading(false)
        }
    }

    if (isLoading) {
        return (
            <Card className="bg-card w-full h-[300px] flex items-center justify-center border-dashed">
                <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Generating Data Flow Diagram...</p>
                </div>
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
