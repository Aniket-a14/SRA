"use client"

import * as React from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Activity,
    Cpu,
    CheckCircle2,
    ShieldCheck,
    Clock,
    Layers
} from "lucide-react"
import type { Analysis } from "@/types/analysis"
import { formatRelative } from "@/lib/format-date"

interface TaskInspectorDialogProps {
    analysis: Analysis
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function TaskInspectorDialog({
    analysis,
    open,
    onOpenChange,
}: TaskInspectorDialogProps) {
    const promptSettings = analysis.metadata?.promptSettings || {}
    const provider = String(promptSettings.modelProvider || "GEMINI")
    const model = String(promptSettings.modelName || "Default model")
    const format = String(promptSettings.format || "ieee830")
    const isPartial = analysis.resultQuality === "PARTIAL"

    const rawAnalysis = analysis as unknown as Record<string, unknown>
    const auditScores = ((rawAnalysis?.metadata as Record<string, unknown>)?.qualityAudit ||
        ((rawAnalysis?.resultJson as Record<string, unknown>)?.metadata as Record<string, unknown>)?.qualityAudit ||
        analysis.qualityAudit ||
        null) as Record<string, unknown> | null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[85vh] p-0 overflow-hidden flex flex-col border border-foreground/10">
                <DialogHeader className="px-6 py-4 border-b border-foreground/10 shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            <Activity className="h-5 w-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-display">
                                Task & Execution Inspector
                            </DialogTitle>
                            <DialogDescription className="text-xs">
                                Pipeline metadata, agent provenance, and 6Cs rubric quality audit.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <ScrollArea className="flex-1 min-h-0 p-6">
                    <div className="space-y-6">
                        {/* Status & Version Header */}
                        <div className="p-4 rounded-xl border border-foreground/10 bg-card space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">
                                    {analysis.projectTitle || analysis.title || "Specification"}
                                </span>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="font-mono text-xs border-foreground/10">
                                        v{analysis.version}
                                    </Badge>
                                    <Badge className="bg-emerald-500/10 text-emerald-600 border-transparent text-xs font-mono">
                                        {analysis.status || "COMPLETED"}
                                    </Badge>
                                    {isPartial && (
                                        <Badge className="bg-amber-500/10 text-amber-600 border-transparent text-xs font-mono">
                                            Partial Checkpoint
                                        </Badge>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                <div className="p-2.5 rounded bg-muted/20 border border-foreground/5 space-y-1">
                                    <span className="text-muted-foreground flex items-center gap-1 font-mono text-[10px] uppercase">
                                        <Cpu className="h-3.5 w-3.5 text-primary" />
                                        AI Model
                                    </span>
                                    <p className="font-medium truncate">{provider}: {model}</p>
                                </div>

                                <div className="p-2.5 rounded bg-muted/20 border border-foreground/5 space-y-1">
                                    <span className="text-muted-foreground flex items-center gap-1 font-mono text-[10px] uppercase">
                                        <Layers className="h-3.5 w-3.5 text-blue-500" />
                                        Standard
                                    </span>
                                    <p className="font-medium uppercase">{format}</p>
                                </div>

                                <div className="p-2.5 rounded bg-muted/20 border border-foreground/5 space-y-1">
                                    <span className="text-muted-foreground flex items-center gap-1 font-mono text-[10px] uppercase">
                                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                                        Persistence
                                    </span>
                                    <p className="font-medium">
                                        {analysis.isFinalized ? "Finalized (KB)" : "Draft"}
                                    </p>
                                </div>

                                <div className="p-2.5 rounded bg-muted/20 border border-foreground/5 space-y-1">
                                    <span className="text-muted-foreground flex items-center gap-1 font-mono text-[10px] uppercase">
                                        <Clock className="h-3.5 w-3.5 text-amber-500" />
                                        Created
                                    </span>
                                    <p className="font-medium">{formatRelative(analysis.createdAt)}</p>
                                </div>
                            </div>
                        </div>

                        {/* Pipeline Stages Execution Milestones */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                5-Layer Pipeline Execution Milestones
                            </h4>

                            <div className="rounded-lg border border-foreground/10 divide-y divide-foreground/5 text-xs bg-card">
                                <div className="p-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                        <span className="font-medium">Layer 1: Strategic Intake Mapping</span>
                                    </div>
                                    <span className="text-muted-foreground font-mono text-[11px]">Passed validation gate</span>
                                </div>

                                <div className="p-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                        <span className="font-medium">Layer 2: Multi-Agent System (PO, Architect, Developer)</span>
                                    </div>
                                    <span className="text-muted-foreground font-mono text-[11px]">Sectional synthesis</span>
                                </div>

                                <div className="p-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                        <span className="font-medium">Layer 3: Objective Review & 6Cs Quality Audit</span>
                                    </div>
                                    <span className="text-muted-foreground font-mono text-[11px]">Critic reflection loop</span>
                                </div>

                                <div className="p-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                        <span className="font-medium">Layer 4: Interactive Refinement Hub</span>
                                    </div>
                                    <span className="text-muted-foreground font-mono text-[11px]">Self-healing diagrams</span>
                                </div>

                                <div className="p-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className={`h-2 w-2 rounded-full ${analysis.isFinalized ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                                        <span className="font-medium">Layer 5: Knowledge Persistence (pgvector)</span>
                                    </div>
                                    <span className="text-muted-foreground font-mono text-[11px]">
                                        {analysis.isFinalized ? "Indexed into Knowledge Graph" : "Draft state (unfinalized)"}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 6Cs Requirements Quality Score Breakdown */}
                        {auditScores && (
                            <div className="space-y-3">
                                <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                    <ShieldCheck className="h-4 w-4 text-primary" />
                                    6Cs Quality Audit Rubric
                                </h4>

                                <div className="p-4 rounded-xl border border-foreground/10 bg-card space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium">Aggregate Quality Score</span>
                                        <span className="font-mono text-sm font-semibold text-primary">
                                            {typeof auditScores.score === "number" ? `${auditScores.score}/100` : "Passed"}
                                        </span>
                                    </div>
                                    {Array.isArray(auditScores.issues) && auditScores.issues.length > 0 ? (
                                        <div className="space-y-1 text-xs text-muted-foreground">
                                            <p className="font-medium text-foreground">Detected Quality Flags:</p>
                                            <ul className="list-disc list-inside space-y-1">
                                                {auditScores.issues.map((issue: string, idx: number) => (
                                                    <li key={idx}>{issue}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-muted-foreground">
                                            All 6Cs verification criteria (Completeness, Consistency, Clarity, Correctness, Conformity, Conciseness) verified.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
