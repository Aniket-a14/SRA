"use client"

import React, { useState, memo } from "react"
import { Button } from "@/components/ui/button"
import { Code, Loader2 } from "lucide-react"
import { useAuthFetch } from "@/lib/hooks"
import dynamic from "next/dynamic"
import type { CodeViewerProps } from "@/components/code-viewer"

const CodeViewer = dynamic(() => import("@/components/code-viewer").then(mod => mod.CodeViewer), {
    loading: () => <div className="h-[600px] w-full bg-muted/20 animate-pulse rounded-lg" />,
    ssr: false
})

interface CodeAssetsTabProps {
    initialGeneratedCode?: CodeViewerProps | null
    analysisId: string
}

export const CodeAssetsTab = memo(function CodeAssetsTab({
    initialGeneratedCode,
    analysisId,
}: CodeAssetsTabProps) {
    const [generatedCode, setGeneratedCode] = useState<CodeViewerProps | null>(initialGeneratedCode || null)
    const [isGeneratingCode, setIsGeneratingCode] = useState(false)
    const [codeError, setCodeError] = useState("")
    const authFetch = useAuthFetch();

    const handleGenerateCode = async () => {
        setIsGeneratingCode(true);
        setCodeError("");

        try {
            const res = await authFetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze/${analysisId}/code`, {
                method: "POST"
            });
            if (!res.ok) throw new Error("Failed to generate code");
            const json = await res.json();
            setGeneratedCode(json.data || json);
        } catch (e) {
            console.error(e);
            setCodeError("Failed to generate code. Please try again.");
        } finally {
            setIsGeneratingCode(false);
        }
    }

    return (
        <div className="animate-fade-in outline-none">
            {!generatedCode && !isGeneratingCode ? (
                <div className="flex flex-col items-center justify-center p-12 text-center space-y-4 border rounded-lg bg-card border-dashed">
                    <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
                        <Code className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-xl font-semibold">Generate Project Code</h3>
                        <p className="text-muted-foreground max-w-md mt-2">
                            Ask AI to scaffold your project structure, database schema, API routes, and React components based on these requirements.
                        </p>
                    </div>
                    <Button className="mt-4" onClick={handleGenerateCode}>
                        Generate Code Assets
                    </Button>
                </div>
            ) : isGeneratingCode ? (
                <div className="flex flex-col items-center justify-center p-12 space-y-6">
                    <div className="relative">
                        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse-glow" />
                        <Loader2 className="h-12 w-12 animate-spin text-primary relative z-10" />
                    </div>
                    <div className="text-center space-y-2">
                        <h3 className="text-lg font-medium">Scaffolding your project...</h3>
                        <p className="text-sm text-muted-foreground">Generating schema, API routes, and components.</p>
                    </div>
                </div>
            ) : generatedCode ? (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium flex items-center gap-2">
                            <Code className="h-5 w-5 text-primary" />
                            Generated Project Assets
                        </h3>
                        <Button variant="outline" size="sm" onClick={() => setGeneratedCode(null)}>
                            Regeneration Options
                        </Button>
                    </div>
                    <CodeViewer {...generatedCode} />
                </div>
            ) : (
                <div className="p-8 text-destructive text-center">{codeError}</div>
            )}
        </div>
    )
})
