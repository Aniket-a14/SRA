"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import useSWR from "swr"
import { createAuthFetcher, swrOptions } from "@/lib/swr-utils"
import { useAuthFetch } from "@/lib/hooks"
import { toast } from "sonner"
import { CheckCircle2, AlertCircle, Sparkles, ArrowRight } from "lucide-react"

interface AnalysisItem {
    id: string
    createdAt: string
    title?: string
    inputPreview?: string
    status?: string
    resultQuality?: string
    failureReason?: string
}

const LAST_SEEN_KEY = "sra_session_last_seen"

export function WelcomeBackNotifier() {
    const router = useRouter()
    const { token, user } = useAuth()
    const authFetch = useAuthFetch()
    const swrFetcher = React.useMemo(() => createAuthFetcher(authFetch), [authFetch])
    const hasCheckedRef = React.useRef(false)

    const swrKey = React.useMemo(() => {
        if (!token) return null
        return [`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze`, token] as const
    }, [token])

    const { data: historyData } = useSWR<AnalysisItem[]>(
        swrKey,
        swrFetcher,
        swrOptions
    )

    React.useEffect(() => {
        if (!historyData || !Array.isArray(historyData) || hasCheckedRef.current || !user) {
            return
        }

        hasCheckedRef.current = true

        try {
            const rawLastSeen = localStorage.getItem(LAST_SEEN_KEY)
            const now = Date.now()

            // Always update last seen for the current session
            localStorage.setItem(LAST_SEEN_KEY, String(now))

            if (!rawLastSeen) {
                // First session; don't trigger welcome back catchup
                return
            }

            const lastSeenTime = parseInt(rawLastSeen, 10)
            // If user was away for at least 1 minute (60,000 ms)
            if (now - lastSeenTime < 60000) {
                return
            }

            // Find analyses created before lastSeen or running during lastSeen that completed/failed after lastSeen
            const changedWhileAway = historyData.filter(item => {
                const itemTime = new Date(item.createdAt).getTime()
                const status = (item.status || "").toUpperCase()
                const isFinished = status === "COMPLETED" || status === "FAILED"
                return isFinished && itemTime >= lastSeenTime - 300000 // 5m buffer
            })

            if (changedWhileAway.length > 0) {
                const completed = changedWhileAway.filter(a => (a.status || "").toUpperCase() === "COMPLETED")
                const failed = changedWhileAway.filter(a => (a.status || "").toUpperCase() === "FAILED")

                toast.custom((t) => (
                    <div className="rounded-xl border border-foreground/10 bg-card p-4 shadow-lg text-card-foreground max-w-sm w-full space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-md bg-foreground/5 text-foreground">
                                <Sparkles className="h-4 w-4" />
                            </div>
                            <div>
                                <h4 className="font-display text-base">Welcome Back</h4>
                                <p className="text-xs text-muted-foreground font-sans">
                                    {changedWhileAway.length} specification update{changedWhileAway.length === 1 ? "" : "s"} while you were away
                                </p>
                            </div>
                        </div>

                        <div className="space-y-1.5 pt-1 text-xs">
                            {completed.slice(0, 2).map(c => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => {
                                        toast.dismiss(t)
                                        router.push(`/analysis/${c.id}`)
                                    }}
                                    className="w-full flex items-center justify-between gap-2 p-2 rounded border border-foreground/5 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
                                >
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                        <span className="truncate font-medium">{c.title || "Specification ready"}</span>
                                    </div>
                                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                </button>
                            ))}

                            {failed.slice(0, 1).map(f => (
                                <button
                                    key={f.id}
                                    type="button"
                                    onClick={() => {
                                        toast.dismiss(t)
                                        router.push(`/analysis/${f.id}`)
                                    }}
                                    className="w-full flex items-center justify-between gap-2 p-2 rounded border border-destructive/10 bg-destructive/5 hover:bg-destructive/10 transition-colors text-left text-destructive"
                                >
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate font-medium">{f.title || "Analysis interrupted"}</span>
                                    </div>
                                    <span className="text-[10px] font-mono font-medium shrink-0">Resume</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ), {
                    duration: 8000,
                    position: "bottom-right"
                })
            }
        } catch {
            // Ignore localStorage errors
        }
    }, [historyData, user, router])

    return null
}
