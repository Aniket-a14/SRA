"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Calendar,
    ArrowRight,
    FileText,
    Sparkles,
    ShoppingCart,
    HeartPulse,
    CreditCard,
    Bot,
    Loader2
} from "lucide-react"
import { formatRelative } from "@/lib/format-date"
import { cleanInputText } from "@/lib/utils"
import { toast } from "sonner"
import { EmptyState } from "@/components/ui/empty-state"

interface AnalysisHistoryItem {
    id: string
    createdAt: string
    inputText: string
    inputPreview: string
    version?: number
    title?: string
    status?: string
    resultQuality?: string
    resumable?: boolean
    failureReason?: string
}

/** Small status pill for a run's lifecycle state */
function StatusPill({ status, resultQuality }: { status?: string; resultQuality?: string }) {
    const s = (status || "").toUpperCase()
    if (s === "FAILED") {
        return <Badge className="h-6 px-2 text-xs shrink-0 border-transparent bg-destructive/10 text-destructive">Failed · resume</Badge>
    }
    if (s === "PENDING" || s === "IN_PROGRESS" || s === "QUEUED") {
        return (
            <Badge className="h-6 px-2 text-xs shrink-0 border-transparent bg-amber-500/10 text-amber-600 flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> In progress
            </Badge>
        )
    }
    if ((resultQuality || "").toUpperCase() === "PARTIAL") {
        return <Badge className="h-6 px-2 text-xs shrink-0 border-transparent bg-amber-500/10 text-amber-600">Partial</Badge>
    }
    return null
}

const STARTER_TEMPLATES = [
    {
        id: "ecommerce",
        title: "E-Commerce Microservices Engine",
        description: "Checkout workflow, inventory reservation, payment gateway, and PCI-DSS compliance.",
        icon: ShoppingCart,
        color: "text-blue-500",
        bg: "bg-blue-500/10"
    },
    {
        id: "telehealth",
        title: "HIPAA Compliant Telehealth App",
        description: "Encrypted video consultations, doctor-patient messaging, and EHR integration.",
        icon: HeartPulse,
        color: "text-emerald-500",
        bg: "bg-emerald-500/10"
    },
    {
        id: "fintech",
        title: "FinTech Real-Time Ledger",
        description: "Multi-currency accounts, automated reconciliation, and fraud risk detection.",
        icon: CreditCard,
        color: "text-purple-500",
        bg: "bg-purple-500/10"
    },
    {
        id: "ai_agent",
        title: "Autonomous AI Agent Workspace",
        description: "Agent execution sandboxes, tool integration, and token budget governance.",
        icon: Bot,
        color: "text-amber-500",
        bg: "bg-amber-500/10"
    }
]

interface AnalysisHistoryProps {
    items: AnalysisHistoryItem[]
}

export function AnalysisHistory({ items }: AnalysisHistoryProps) {
    const router = useRouter()
    const [filter, setFilter] = React.useState<string>("all")

    const filteredItems = React.useMemo(() => {
        if (filter === "all") return items
        if (filter === "running") {
            return items.filter(i => {
                const s = (i.status || "").toUpperCase()
                return s === "PENDING" || s === "IN_PROGRESS" || s === "QUEUED"
            })
        }
        if (filter === "completed") {
            return items.filter(i => (i.status || "").toUpperCase() === "COMPLETED")
        }
        if (filter === "failed") {
            return items.filter(i => (i.status || "").toUpperCase() === "FAILED")
        }
        return items
    }, [items, filter])

    if (items.length === 0) {
        return (
            <div className="space-y-8 py-6">
                <EmptyState
                    icon={FileText}
                    heading="No specifications created yet"
                    description="Kick off your first requirements analysis or get started instantly with an industry template below."
                />

                <div className="space-y-3 max-w-4xl mx-auto">
                    <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        Quick-Start Templates
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {STARTER_TEMPLATES.map((tmpl) => {
                            const Icon = tmpl.icon
                            return (
                                <button
                                    key={tmpl.id}
                                    type="button"
                                    onClick={() => router.push(`/analysis/new?template=${tmpl.id}`)}
                                    className="flex items-start gap-3 p-4 rounded-xl border border-border/70 bg-card/60 hover:bg-card hover:border-primary/40 hover:shadow-md transition-all text-left group"
                                >
                                    <div className={`p-2.5 rounded-lg ${tmpl.bg} ${tmpl.color} shrink-0 mt-0.5`}>
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-1">
                                            <h4 className="font-semibold text-sm group-hover:text-primary transition-colors truncate">
                                                {tmpl.title}
                                            </h4>
                                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary opacity-0 group-hover:opacity-100 transition-all shrink-0 -translate-x-1 group-hover:translate-x-0" />
                                        </div>
                                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                            {tmpl.description}
                                        </p>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Filter Bar */}
            <div className="flex items-center justify-between gap-4">
                <Tabs value={filter} onValueChange={setFilter} className="w-full sm:w-auto">
                    <TabsList className="grid grid-cols-4 sm:flex h-9">
                        <TabsTrigger value="all" className="text-xs">
                            All ({items.length})
                        </TabsTrigger>
                        <TabsTrigger value="running" className="text-xs">
                            Running ({items.filter(i => {
                                const s = (i.status || "").toUpperCase()
                                return s === "PENDING" || s === "IN_PROGRESS" || s === "QUEUED"
                            }).length})
                        </TabsTrigger>
                        <TabsTrigger value="completed" className="text-xs">
                            Done ({items.filter(i => (i.status || "").toUpperCase() === "COMPLETED").length})
                        </TabsTrigger>
                        <TabsTrigger value="failed" className="text-xs">
                            Failed ({items.filter(i => (i.status || "").toUpperCase() === "FAILED").length})
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                <Button
                    size="sm"
                    className="hidden sm:inline-flex text-xs h-8"
                    onClick={() => router.push("/analysis/new")}
                >
                    New Analysis
                </Button>
            </div>

            {/* List */}
            {filteredItems.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                    No analyses match the selected filter.
                </div>
            ) : (
                <div className="relative border-l-2 border-muted ml-3 md:ml-6 space-y-8 pl-6 md:pl-10 py-4">
                    {filteredItems.map((item, idx) => (
                        <div
                            key={item.id || idx}
                            className="relative group cursor-pointer"
                            onClick={() => {
                                if (item.id && item.id !== 'undefined') {
                                    router.push(`/analysis/${item.id}`)
                                } else {
                                    toast.error("Analysis ID is invalid");
                                }
                            }}
                        >
                            {/* Timeline Dot */}
                            <span className="absolute -left-[31px] md:-left-[47px] top-5 h-4 w-4 rounded-full border-2 border-primary bg-background group-hover:bg-primary transition-colors duration-300" />

                            <Card className="overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border-border/50 bg-card/50 hover:bg-card hover:border-primary/20">
                                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                                <CardHeader className="pb-3 flex flex-row items-center justify-between gap-4 space-y-0">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="h-6 px-2 text-xs font-semibold shrink-0 transition-colors group-hover:border-primary/50 group-hover:text-primary">
                                                v{item.version || 1}
                                            </Badge>
                                            <CardTitle className="text-base font-semibold group-hover:text-primary transition-colors line-clamp-1">
                                                {item.title || "Analysis"}
                                            </CardTitle>
                                            <StatusPill status={item.status} resultQuality={item.resultQuality} />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
                                        <Calendar className="h-3.5 w-3.5" />
                                        <span className="hidden xs:inline">{formatRelative(item.createdAt)}</span>
                                    </div>
                                </CardHeader>

                                <CardContent>
                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                        {cleanInputText(item.inputPreview)}
                                    </p>

                                    <div className="flex items-center gap-1 text-xs text-primary font-medium mt-3 opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0">
                                        {(item.status || "").toUpperCase() === "FAILED" ? "Resume analysis" : "View details"} <ArrowRight className="h-3 w-3" />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
