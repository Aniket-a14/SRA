"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    FileText,
    ShieldCheck,
    Bot,
    Sparkles,
    Database,
    Lock,
    MessageSquare,
    Plus
} from "lucide-react"
import { useLayer } from "@/lib/layer-context"
import { useRouter, useParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import useSWR from "swr"
import { fetcher, swrOptions } from "@/lib/swr-utils"
import { useMemo } from "react"

type AppSidebarProps = React.HTMLAttributes<HTMLDivElement>

interface AnalysisHistoryItem {
    id: string
    createdAt: string
    inputPreview: string
    title?: string
}

export function AppSidebar({ className }: AppSidebarProps) {
    const { currentLayer, setLayer, isLayerLocked, maxAllowedLayer, isFinalized } = useLayer()
    const router = useRouter()
    const params = useParams()
    const { token } = useAuth()

    const analysisId = params?.id as string | undefined

    // Live conversation/analysis history rail — replaces the old one-shot,
    // 5-item-capped Project list. useSWR keeps it in sync (revalidates on
    // reconnect/interval like every other data fetch in this app) instead of
    // fetching once on mount and never again.
    const swrKey = useMemo(() => {
        if (!token) return null
        return [`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze`, token] as const
    }, [token])

    const { data: historyData } = useSWR<AnalysisHistoryItem[]>(swrKey, fetcher, {
        ...swrOptions,
        refreshInterval: 30000 // light background sync — this is a nav rail, not the live-progress view
    })

    const history = Array.isArray(historyData) ? historyData : []

    const layers = [
        { id: 1, label: "Structured Input", icon: FileText },
        { id: 2, label: "Validation Gate", icon: ShieldCheck },
        { id: 3, label: "Final Analysis", icon: Bot },
        { id: 4, label: "Refinement", icon: Sparkles },
        { id: 5, label: "Knowledge Base", icon: Database },
    ] as const

    return (
        <div className={cn("pb-12 w-64 border-r h-screen bg-muted/10 flex flex-col fixed left-0 top-0 z-30", className)}>
            <div className="space-y-4 py-4">
                <div className="px-3">
                    <Button
                        variant="outline"
                        className="w-full justify-start gap-2"
                        onClick={() => router.push("/")}
                    >
                        <Plus className="h-4 w-4" />
                        New Analysis
                    </Button>
                </div>

                {/* Layer Tracker - Only show if inside an analysis */}
                {analysisId && (
                    <div className="px-3 py-2">
                        <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
                            Pipeline Progress
                        </h2>
                        <div className="space-y-1">
                            {layers.map((layer) => {
                                const Icon = layer.icon
                                const isLocked = isLayerLocked(layer.id as 1 | 2 | 3 | 4 | 5)
                                const isActive = currentLayer === layer.id

                                return (
                                    <Button
                                        key={layer.id}
                                        variant={isActive ? "secondary" : "ghost"}
                                        className={cn(
                                            "w-full justify-start relative pl-8",
                                            isLocked && "opacity-50 cursor-not-allowed",
                                            isActive && "bg-primary/10 text-primary hover:bg-primary/15"
                                        )}
                                        disabled={isLocked}
                                        onClick={() => !isLocked && setLayer(layer.id as 1 | 2 | 3 | 4 | 5)}
                                    >
                                        {/* Connector Line */}
                                        <div className="absolute left-4 top-0 bottom-0 w-px bg-border group-last:bottom-1/2"></div>

                                        {/* Status Dot */}
                                        <div className={cn(
                                            "absolute left-[13px] h-2.5 w-2.5 rounded-full border border-background z-10",
                                            isActive ? "bg-primary" :
                                                (layer.id < maxAllowedLayer || (layer.id === 5 && isFinalized)) ? "bg-green-500" : "bg-muted-foreground/30"
                                        )} />

                                        <Icon className="mr-2 h-4 w-4" />
                                        {layer.label}
                                        {isLocked && <Lock className="ml-auto h-3 w-3 opacity-50" />}
                                    </Button>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Recent Analyses — live history rail */}
                <div className="py-2">
                    <div className="flex items-center justify-between px-7 mb-2">
                        <h2 className="text-xs font-semibold tracking-tight text-muted-foreground/70 uppercase">
                            Recent Analyses
                        </h2>
                        <button
                            className="text-xs text-primary hover:underline"
                            onClick={() => router.push("/analysis")}
                        >
                            View all
                        </button>
                    </div>
                    <ScrollArea className="h-[calc(100vh-64px-13rem)] px-1">
                        <div className="space-y-1 p-2">
                            {history.length === 0 && (
                                <p className="px-3 text-xs text-muted-foreground/60">No analyses yet</p>
                            )}
                            {history.slice(0, 15).map((item) => (
                                <Button
                                    key={item.id}
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                        "w-full justify-start font-normal truncate gap-2",
                                        item.id === analysisId && "bg-secondary text-secondary-foreground"
                                    )}
                                    onClick={() => router.push(`/analysis/${item.id}`)}
                                >
                                    <MessageSquare className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{item.title || item.inputPreview || "Untitled"}</span>
                                </Button>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            </div>

            {/* Footer / User Info could go here */}
        </div>
    )
}
