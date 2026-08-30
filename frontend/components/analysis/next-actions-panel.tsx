"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
    Download,
    Network,
    Terminal,
    Sparkles,
    Database
} from "lucide-react"
import type { Analysis } from "@/types/analysis"
import { exportSrsToDocx } from "@/lib/srs-export"
import { toast } from "sonner"

interface NextActionsPanelProps {
    analysis: Analysis
    onOpenChat: () => void
    onOpenDfdDialog: () => void
    onOpenCliTraceability: () => void
    onFinalize: () => void
    isFinalizing?: boolean
}

export function NextActionsPanel({
    analysis,
    onOpenChat,
    onOpenDfdDialog,
    onOpenCliTraceability,
    onFinalize,
    isFinalizing = false,
}: NextActionsPanelProps) {
    const isFinalized = analysis.isFinalized

    const handleExportDocx = async () => {
        try {
            toast.loading("Compiling DOCX document...", { id: "docx-export" })
            const { saveAs } = await import("file-saver")
            const projectTitle = analysis.projectTitle || analysis.title || "Specification"
            const { blob, filename } = await exportSrsToDocx(analysis, projectTitle)
            saveAs(blob, filename)
            toast.success("Document downloaded!", { id: "docx-export" })
        } catch (err) {
            console.error("DOCX export failed", err)
            toast.error("Failed to compile DOCX document", { id: "docx-export" })
        }
    }

    return (
        <div className="border-b border-foreground/10 bg-muted/20 px-4 py-3 shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        Next Recommended Actions
                    </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Action 1: One-Click DOCX Export */}
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5 border-foreground/20 hover:bg-foreground/5"
                        onClick={handleExportDocx}
                    >
                        <Download className="h-3.5 w-3.5" />
                        <span>Export DOCX</span>
                    </Button>

                    {/* Action 2: Generate DFD */}
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5 border-foreground/20 hover:bg-foreground/5"
                        onClick={onOpenDfdDialog}
                    >
                        <Network className="h-3.5 w-3.5 text-indigo-500" />
                        <span>Generate DFD</span>
                    </Button>

                    {/* Action 3: SRA CLI Traceability */}
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5 border-foreground/20 hover:bg-foreground/5"
                        onClick={onOpenCliTraceability}
                    >
                        <Terminal className="h-3.5 w-3.5 text-emerald-500" />
                        <span>Code Traceability</span>
                    </Button>

                    {/* Action 4: Refine with AI Assistant */}
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5 border-foreground/20 hover:bg-foreground/5"
                        onClick={onOpenChat}
                    >
                        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                        <span>Refine via Chat</span>
                    </Button>

                    {/* Action 5: Finalize to Knowledge Base */}
                    {!isFinalized && (
                        <Button
                            variant="default"
                            size="sm"
                            className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                            disabled={isFinalizing}
                            onClick={onFinalize}
                        >
                            <Database className="h-3.5 w-3.5" />
                            <span>{isFinalizing ? "Finalizing..." : "Finalize & Index"}</span>
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
}
