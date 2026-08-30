"use client"

import * as React from "react"
import { AlertCircle, AlertTriangle, CheckCircle2, Info, ShieldAlert, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

export type CalloutType = "note" | "tip" | "important" | "warning" | "caution" | "security"

interface DocsCalloutProps {
    type?: CalloutType
    title?: string
    children: React.ReactNode
    className?: string
}

const CALLOUT_CONFIG: Record<CalloutType, { icon: React.ElementType; style: string; defaultTitle: string; iconColor: string }> = {
    note: {
        icon: Info,
        style: "bg-blue-50/50 border-blue-200 text-blue-950",
        iconColor: "text-blue-600",
        defaultTitle: "Note"
    },
    tip: {
        icon: Sparkles,
        style: "bg-emerald-50/50 border-emerald-200 text-emerald-950",
        iconColor: "text-emerald-600",
        defaultTitle: "Tip"
    },
    important: {
        icon: CheckCircle2,
        style: "bg-primary/5 border-primary/20 text-foreground",
        iconColor: "text-primary",
        defaultTitle: "Important"
    },
    warning: {
        icon: AlertTriangle,
        style: "bg-amber-50/50 border-amber-200 text-amber-950",
        iconColor: "text-amber-600",
        defaultTitle: "Warning"
    },
    caution: {
        icon: AlertCircle,
        style: "bg-destructive/5 border-destructive/20 text-destructive",
        iconColor: "text-destructive",
        defaultTitle: "Caution"
    },
    security: {
        icon: ShieldAlert,
        style: "bg-purple-50/50 border-purple-200 text-purple-950",
        iconColor: "text-purple-600",
        defaultTitle: "Security Notice"
    }
}

export function DocsCallout({
    type = "note",
    title,
    children,
    className
}: DocsCalloutProps) {
    const config = CALLOUT_CONFIG[type]
    const Icon = config.icon

    return (
        <div className={cn("my-4 rounded-xl border p-4 text-sm leading-relaxed", config.style, className)}>
            <div className="flex items-center gap-2 font-semibold mb-1.5 text-xs font-mono uppercase tracking-wider">
                <Icon className={cn("h-4 w-4 shrink-0", config.iconColor)} />
                <span>{title || config.defaultTitle}</span>
            </div>
            <div className="text-foreground/80 text-xs sm:text-sm pl-6 space-y-1">
                {children}
            </div>
        </div>
    )
}
