"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    FileText,
    ArrowRight,
    Loader2,
    Sparkles
} from "lucide-react"

interface AnalysisItem {
    id: string
    createdAt: string
    title?: string
    inputPreview?: string
    status?: string
    version?: number
    resultQuality?: string
    failureReason?: string
}

interface ContinueWorkingProps {
    analyses: AnalysisItem[]
    onOpenActivityCenter?: () => void
}

export function ContinueWorkingCard({
    analyses,
    onOpenActivityCenter
}: ContinueWorkingProps) {
    const router = useRouter()

    const running = analyses.filter(a => {
        const s = (a.status || "").toUpperCase()
        return s === "PENDING" || s === "IN_PROGRESS" || s === "QUEUED"
    })

    const failed = analyses.filter(a => (a.status || "").toUpperCase() === "FAILED")
    const completed = analyses.filter(a => (a.status || "").toUpperCase() === "COMPLETED")

    // If no work exists at all
    if (analyses.length === 0) {
        return null
    }

    const primaryActionItem = running[0] || failed[0] || completed[0]
    if (!primaryActionItem) return null

    const status = (primaryActionItem.status || "").toUpperCase()
    const isRunning = status === "PENDING" || status === "IN_PROGRESS" || status === "QUEUED"
    const isFailed = status === "FAILED"

    return (
        <Card className="mb-6 border-foreground/10 bg-card shadow-xs">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-foreground/5 text-foreground">
                        <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <CardTitle className="text-base font-display">
                        Continue Where You Left Off
                    </CardTitle>
                </div>
                {onOpenActivityCenter && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 text-muted-foreground hover:text-foreground font-mono"
                        onClick={onOpenActivityCenter}
                    >
                        View All Activity
                    </Button>
                )}
            </CardHeader>
            <CardContent className="pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-foreground/10 bg-muted/10">
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-background border border-foreground/10 text-muted-foreground shrink-0 mt-0.5 sm:mt-0">
                            {isRunning ? (
                                <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                            ) : (
                                <FileText className="h-4 w-4 text-foreground" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-medium text-sm truncate">
                                    {primaryActionItem.title || "Requirements Specification"}
                                </h4>
                                <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-mono border-foreground/10">
                                    v{primaryActionItem.version || 1}
                                </Badge>
                                {isRunning && (
                                    <Badge className="text-[10px] h-4 px-1.5 bg-amber-500/10 text-amber-600 border-transparent font-mono">
                                        Generating...
                                    </Badge>
                                )}
                                {isFailed && (
                                    <Badge className="text-[10px] h-4 px-1.5 bg-destructive/10 text-destructive border-transparent font-mono">
                                        Interrupted · Resumable
                                    </Badge>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5 font-sans">
                                {primaryActionItem.inputPreview || "Ready for review and export."}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <Button
                            size="sm"
                            className="h-8 text-xs gap-1.5 rounded-full border-foreground/20"
                            onClick={() => router.push(`/analysis/${primaryActionItem.id}`)}
                        >
                            {isFailed ? "Resume Run" : isRunning ? "Track Progress" : "Open Document"}
                            <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
