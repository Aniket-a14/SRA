"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
    Network,
    Terminal,
    Sparkles
} from "lucide-react"

interface NextActionsPanelProps {
    onOpenDfdDialog: () => void
    onOpenCliTraceability: () => void
}

export function NextActionsPanel({
    onOpenDfdDialog,
    onOpenCliTraceability,
}: NextActionsPanelProps) {
    return (
        <div className="border-b border-foreground/10 bg-muted/10 px-4 sm:px-6 py-2 shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 max-w-5xl mx-auto">
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        AI Analysis Tools
                    </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Action 1: Generate DFD */}
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1.5 border-foreground/15 hover:bg-foreground/5"
                        onClick={onOpenDfdDialog}
                    >
                        <Network className="h-3.5 w-3.5 text-indigo-500" />
                        <span>Generate DFD</span>
                    </Button>

                    {/* Action 2: SRA CLI Traceability */}
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1.5 border-foreground/15 hover:bg-foreground/5"
                        onClick={onOpenCliTraceability}
                    >
                        <Terminal className="h-3.5 w-3.5 text-emerald-500" />
                        <span>Code Traceability</span>
                    </Button>
                </div>
            </div>
        </div>
    )
}
