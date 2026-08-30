"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import useSWR from "swr"
import { createAuthFetcher, swrOptions } from "@/lib/swr-utils"
import { useAuthFetch } from "@/lib/hooks"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
    Bell,
    CheckCircle2,
    AlertCircle,
    Clock
} from "lucide-react"
import { formatRelative } from "@/lib/format-date"

interface AnalysisItem {
    id: string
    createdAt: string
    title?: string
    inputPreview?: string
    status?: string
    resultQuality?: string
    failureReason?: string
}

const READ_IDS_KEY = "sra_read_notification_ids"
const notificationListeners = new Set<() => void>()

function getReadIdsSnapshot(): string {
    if (typeof window === "undefined") return "[]"
    try {
        return localStorage.getItem(READ_IDS_KEY) || "[]"
    } catch {
        return "[]"
    }
}

function subscribeReadIds(callback: () => void) {
    notificationListeners.add(callback)
    const onStorage = (e: StorageEvent) => {
        if (e.key === READ_IDS_KEY) callback()
    }
    window.addEventListener("storage", onStorage)
    return () => {
        notificationListeners.delete(callback)
        window.removeEventListener("storage", onStorage)
    }
}

function saveReadIdsToStorage(newSet: Set<string>) {
    try {
        localStorage.setItem(READ_IDS_KEY, JSON.stringify(Array.from(newSet)))
    } catch {
        // ignore
    }
    notificationListeners.forEach((cb) => cb())
}

export function NotificationCenter() {
    const router = useRouter()
    const { token } = useAuth()
    const authFetch = useAuthFetch()
    const swrFetcher = React.useMemo(() => createAuthFetcher(authFetch), [authFetch])

    const swrKey = React.useMemo(() => {
        if (!token) return null
        return [`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze`, token] as const
    }, [token])

    const { data: historyData } = useSWR<AnalysisItem[]>(
        swrKey,
        swrFetcher,
        {
            ...swrOptions,
            refreshInterval: 15000
        }
    )

    const analyses = React.useMemo(() => (Array.isArray(historyData) ? historyData : []), [historyData])

    // Shared external store to keep multiple mounted NotificationCenter instances in sync
    const rawReadIds = React.useSyncExternalStore(subscribeReadIds, getReadIdsSnapshot, () => "[]")
    const readIds = React.useMemo(() => {
        try {
            return new Set<string>(JSON.parse(rawReadIds))
        } catch {
            return new Set<string>()
        }
    }, [rawReadIds])

    const notifications = React.useMemo(() => {
        return analyses
            .filter(a => {
                const s = (a.status || "").toUpperCase()
                return s === "COMPLETED" || s === "FAILED"
            })
            .slice(0, 20)
    }, [analyses])

    const unreadCount = React.useMemo(() => {
        return notifications.filter(n => !readIds.has(n.id)).length
    }, [notifications, readIds])

    const markAsRead = (id: string) => {
        const next = new Set(readIds)
        next.add(id)
        saveReadIdsToStorage(next)
    }

    const markAllAsRead = () => {
        const next = new Set(readIds)
        notifications.forEach(n => next.add(n.id))
        saveReadIdsToStorage(next)
    }

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative h-8 w-8 text-muted-foreground hover:text-foreground"
                    aria-label="Notifications"
                >
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 flex h-3.5 min-w-3.5 px-1 items-center justify-center rounded-full bg-primary text-[9px] font-mono font-medium text-primary-foreground">
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 sm:w-96 p-0 border border-foreground/10 shadow-lg bg-card">
                <div className="flex items-center justify-between px-4 py-3 border-b border-foreground/10">
                    <div className="flex items-center gap-2">
                        <h4 className="font-display text-base">Notifications</h4>
                        {unreadCount > 0 && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1 font-mono border-foreground/10">
                                {unreadCount} new
                            </Badge>
                        )}
                    </div>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-6 px-2 text-muted-foreground hover:text-foreground font-mono"
                            onClick={markAllAsRead}
                        >
                            Mark all read
                        </Button>
                    )}
                </div>

                <ScrollArea className="h-80">
                    {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-center p-4">
                            <Clock className="h-8 w-8 text-muted-foreground/40 mb-2" />
                            <p className="text-sm font-medium text-muted-foreground">No recent notifications</p>
                            <p className="text-xs text-muted-foreground/70 mt-1 font-sans">
                                Activity updates from requirements generations will appear here.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-foreground/5">
                            {notifications.map((item) => {
                                const isUnread = !readIds.has(item.id)
                                const isFailed = (item.status || "").toUpperCase() === "FAILED"

                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => {
                                            markAsRead(item.id)
                                            router.push(`/analysis/${item.id}`)
                                        }}
                                        className={`w-full p-3.5 text-left transition-colors flex items-start gap-3 hover:bg-muted/40 ${
                                            isUnread ? "bg-muted/20 font-medium" : "opacity-80"
                                        }`}
                                    >
                                        <div className="shrink-0 mt-0.5">
                                            {isFailed ? (
                                                <div className="p-1 rounded-full bg-destructive/10 text-destructive">
                                                    <AlertCircle className="h-3.5 w-3.5" />
                                                </div>
                                            ) : (
                                                <div className="p-1 rounded-full bg-emerald-500/10 text-emerald-600">
                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-1">
                                                <p className="text-xs font-medium truncate text-foreground">
                                                    {item.title || "Requirements Specification"}
                                                </p>
                                                <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                                                    {formatRelative(item.createdAt)}
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5 font-sans">
                                                {isFailed
                                                    ? item.failureReason || "Analysis interrupted. Click to resume."
                                                    : "Analysis generated and ready for review."}
                                            </p>
                                        </div>

                                        {isUnread && (
                                            <span className="h-1.5 w-1.5 rounded-full bg-foreground shrink-0 self-center" />
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </ScrollArea>
            </PopoverContent>
        </Popover>
    )
}
