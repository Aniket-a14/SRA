"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Loader2, GitCommit, GitBranch, ArrowLeftRight, Clock, Sparkles, FileText } from "lucide-react"

interface Version {
    id: string
    createdAt: string
    version: number
    title?: string
    rootId: string | null
    parentId: string | null
    metadata?: {
        trigger?: 'initial' | 'chat' | 'edit' | 'regenerate'
        source?: 'ai' | 'user'
        promptSettings?: {
            profile?: string
            modelName?: string
            modelProvider?: string
        }
    }
}

interface VersionTimelineProps {
    rootId: string
    currentId: string
    className?: string
    hideHeader?: boolean
}

export function VersionTimeline({ rootId, currentId, className, hideHeader = false }: VersionTimelineProps) {
    const router = useRouter()
    const { token } = useAuth()
    const [history, setHistory] = useState<Version[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const fetchHistory = async () => {
            if (!rootId) return
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze/history/${rootId}`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                })
                if (response.ok) {
                    const data = await response.json()
                    setHistory(data)
                }
            } catch (error) {
                console.error("Failed to fetch history", error)
            } finally {
                setIsLoading(false)
            }
        }
        fetchHistory()
    }, [rootId, token])

    if (isLoading) {
        return <div className="p-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
    }

    return (
        <div className={cn("flex flex-col h-full border-l bg-muted/10", className)}>
            {!hideHeader && (
                <div className="p-4 border-b flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <h3 className="font-semibold">Version History</h3>
                </div>
            )}
            <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                    {history.map((version, index) => {
                        const isCurrent = version.id === currentId
                        const trigger = version.metadata?.trigger || 'initial';
                        const source = version.metadata?.source || 'ai';
                        const profile = version.metadata?.promptSettings?.profile;
                        const modelName = version.metadata?.promptSettings?.modelName;

                        let BadgeIcon = GitCommit;
                        let badgeLabel = "Update";

                        if (trigger === 'chat') { BadgeIcon = Sparkles; badgeLabel = "Chat"; }
                        else if (trigger === 'edit') { BadgeIcon = FileText; badgeLabel = "Edit"; }
                        else if (trigger === 'initial') { BadgeIcon = GitBranch; badgeLabel = "Initial"; }

                        // Model Badge Logic
                        let modelLabel = "";
                        if (modelName) {
                            if (modelName.includes('gpt')) {
                                modelLabel = modelName.includes('4') ? 'GPT-4o' : 'GPT-3.5';
                            } else if (modelName.includes('gemini')) {
                                modelLabel = modelName.includes('pro') ? 'Gemini Pro' : 'Gemini Flash';
                            } else {
                                modelLabel = modelName;
                            }
                        }

                        return (
                            <div key={version.id} className="relative pl-6 pb-6 last:pb-0">
                                {/* Timeline Line */}
                                {index !== history.length - 1 && (
                                    <div className="absolute left-[11px] top-7 bottom-0 w-px bg-border group-hover:bg-primary/50 transition-colors" />
                                )}

                                <div className="absolute left-[3px] top-1">
                                    <div className={cn(
                                        "h-4 w-4 rounded-full border-2 transition-colors flex items-center justify-center",
                                        isCurrent ? "bg-primary border-primary" : "bg-background border-muted-foreground"
                                    )}>
                                        {!isCurrent && <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />}
                                    </div>
                                </div>

                                <div className={cn(
                                    "flex flex-col gap-1 p-3 rounded-lg border transition-all",
                                    isCurrent ? "bg-accent text-accent-foreground border-accent" : "hover:bg-muted/50 border-transparent hover:border-border"
                                )}>
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium text-sm flex items-center gap-1.5">
                                            v{version.version}
                                        </span>
                                        {isCurrent && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">Current</span>}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-muted border font-medium text-muted-foreground">
                                            <BadgeIcon className="h-3 w-3" /> {badgeLabel}
                                        </span>
                                        {source === 'user' && <span className="text-[10px] text-muted-foreground">(User)</span>}

                                        {modelLabel && source === 'ai' && (
                                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-200 font-medium">
                                                {modelLabel}
                                            </span>
                                        )}
                                    </div>

                                    <p className="text-xs text-muted-foreground truncate font-medium" title={version.title || `Version ${version.version}`}>
                                        {version.title || `Update ${version.version}`}
                                    </p>

                                    {profile && profile !== 'default' && (
                                        <p className="text-[10px] text-muted-foreground/70 italic">
                                            Profile: {profile.replace('_', ' ')}
                                        </p>
                                    )}

                                    <span className="text-[10px] text-muted-foreground mt-1">
                                        {format(new Date(version.createdAt), "MMM d, h:mm a")}
                                    </span>

                                    <div className="flex gap-2 mt-2">
                                        {!isCurrent && (
                                            <>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-6 px-2 text-xs"
                                                    onClick={() => router.push(`/analysis/${version.id}`)}
                                                >
                                                    View
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-6 px-2 text-xs"
                                                    onClick={() => router.push(`/analysis/compare?v1=${version.id}&v2=${currentId}`)}
                                                >
                                                    <ArrowLeftRight className="h-3 w-3 mr-1" />
                                                    Diff
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </ScrollArea>
        </div>
    )
}
