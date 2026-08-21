"use client"

import { useState } from "react"
import { Terminal, FileCode2, CheckCircle2, AlertTriangle, CircleDashed, Sparkles, ChevronDown } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatAbsolute } from "@/lib/format-date"

/** One requirement group as `sra push` recorded it. */
export interface CliTraceabilityGroup {
    id?: string
    name: string
    section?: string | null
    kind?: string | null
    status?: string
    verification_files?: string[]
    requirements?: Array<{
        id?: string
        description?: string
        verification_status?: string
        verifiedAt?: string
        verifiedBy?: string
    }>
}

export interface CliTraceability {
    updatedAt?: string
    cliVersion?: string
    formatId?: string | null
    summary?: {
        groups?: number
        verified?: number
        partial?: number
        failed?: number
        proposed?: number
        pending?: number
        filesLinked?: number
        approved?: number
        rejected?: number
    }
    groups?: CliTraceabilityGroup[]
}

const STATUS_STYLE: Record<string, { label: string; icon: typeof CheckCircle2; className: string }> = {
    verified: { label: "Verified", icon: CheckCircle2, className: "text-green-600 border-green-500/30 bg-green-500/10" },
    partial: { label: "Link may be stale", icon: AlertTriangle, className: "text-amber-600 border-amber-500/30 bg-amber-500/10" },
    failed: { label: "Files missing", icon: AlertTriangle, className: "text-red-600 border-red-500/30 bg-red-500/10" },
    proposed: { label: "Proposed", icon: Sparkles, className: "text-blue-600 border-blue-500/30 bg-blue-500/10" },
    pending: { label: "Not linked", icon: CircleDashed, className: "text-muted-foreground border-border bg-muted/40" },
}

const styleFor = (status?: string) => STATUS_STYLE[status || "pending"] || STATUS_STYLE.pending

/**
 * Implementation traceability reported by the CLI (`sra check` → `sra push`).
 *
 * Rendered from `metadata.cliTraceability` rather than from the document body, because
 * only IEEE 830 has feature objects to hang `verification_files` on — a Volere, ISO 29148
 * or Agile PRD document has no such section, and inventing one to hold CLI state would
 * corrupt the spec. Reading the metadata record instead means every format surfaces the
 * same information here.
 */
export function CliTraceabilityPanel({ traceability }: { traceability?: CliTraceability | null }) {
    const [expanded, setExpanded] = useState(false)

    const groups = traceability?.groups || []
    if (groups.length === 0) return null

    const summary = traceability?.summary || {}
    const linked = groups.filter(g => (g.verification_files?.length || 0) > 0)
    const visible = expanded ? groups : groups.slice(0, 4)

    return (
        <Card className="border-foreground/15">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Terminal className="h-4 w-4" />
                    Implementation traceability
                </CardTitle>
                <CardDescription className="text-[10px]">
                    Reported by the SRA CLI
                    {traceability?.cliVersion ? ` v${traceability.cliVersion}` : ""}
                    {traceability?.updatedAt ? ` · ${formatAbsolute(traceability.updatedAt)}` : ""}
                    {" · links point at files in the developer's working tree, not a proof of correctness"}
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-[10px]">{summary.groups ?? groups.length} group(s)</Badge>
                    {(summary.verified ?? 0) > 0 && <Badge variant="outline" className="text-[10px] text-green-600 border-green-500/30">{summary.verified} verified</Badge>}
                    {(summary.proposed ?? 0) > 0 && <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-500/30">{summary.proposed} proposed</Badge>}
                    {(summary.partial ?? 0) > 0 && <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30">{summary.partial} stale</Badge>}
                    {(summary.failed ?? 0) > 0 && <Badge variant="outline" className="text-[10px] text-red-600 border-red-500/30">{summary.failed} missing</Badge>}
                    {(summary.filesLinked ?? 0) > 0 && <Badge variant="secondary" className="text-[10px]">{summary.filesLinked} file(s) linked</Badge>}
                    {(summary.approved ?? 0) > 0 && <Badge variant="secondary" className="text-[10px]">{summary.approved} human-approved</Badge>}
                    {(summary.rejected ?? 0) > 0 && <Badge variant="secondary" className="text-[10px]">{summary.rejected} rejected</Badge>}
                </div>

                {linked.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">
                        No source files linked yet — run <code className="font-mono">sra check --suggest</code> in the repository.
                    </p>
                )}

                <div className="space-y-2">
                    {visible.map((group, idx) => {
                        const { label, icon: Icon, className } = styleFor(group.status)
                        const files = group.verification_files || []
                        const approved = (group.requirements || []).filter(r => r.verification_status === "APPROVED_HUMAN")

                        return (
                            <div key={group.id || `${group.name}-${idx}`} className="rounded-md border border-border/50 bg-muted/20 p-3 space-y-2">
                                <div className="flex items-start justify-between gap-3">
                                    <p className="text-sm font-medium leading-tight">{group.name}</p>
                                    <Badge variant="outline" className={cn("shrink-0 text-[10px] gap-1", className)}>
                                        <Icon className="h-3 w-3" />
                                        {label}
                                    </Badge>
                                </div>

                                {files.length > 0 && (
                                    <ul className="space-y-1">
                                        {files.map((file) => (
                                            <li key={file} className="text-xs font-mono text-muted-foreground flex items-center gap-2">
                                                <FileCode2 className="h-3 w-3 shrink-0 opacity-70" />
                                                <span className="truncate">{file}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                {approved.length > 0 && (
                                    <p className="text-[10px] text-muted-foreground">
                                        {approved.length} requirement(s) approved
                                        {approved[0].verifiedBy ? ` by ${approved[0].verifiedBy}` : ""}
                                    </p>
                                )}
                            </div>
                        )
                    })}
                </div>

                {groups.length > visible.length && (
                    <Button variant="ghost" size="sm" className="w-full text-xs gap-1" onClick={() => setExpanded(true)}>
                        <ChevronDown className="h-3 w-3" />
                        Show {groups.length - visible.length} more
                    </Button>
                )}
            </CardContent>
        </Card>
    )
}
