import React from "react"
import { cleanInputText, cn } from "@/lib/utils"
import type {
    SystemFeature,
    Appendices
} from "@/types/analysis"

export interface DiffChange<T = unknown> {
    old: T
    new: T
}

export type AnalysisDiff = Record<string, DiffChange<unknown> | undefined>

interface VersionDiffViewerProps {
    diff: AnalysisDiff
}

const SECTION_LABELS: Record<string, { title: string; badge: string }> = {
    inputText: { title: "Refinement Input", badge: "Intent" },
    introduction: { title: "1. Introduction", badge: "Context" },
    overallDescription: { title: "2. Overall Description", badge: "Perspective" },
    externalInterfaceRequirements: { title: "3. External Interfaces", badge: "Integration" },
    specificRequirements: { title: "External Interfaces", badge: "Integration" },
    systemFeatures: { title: "System Features", badge: "Capabilities" },
    systemFunctions: { title: "System Functions", badge: "Capabilities" },
    functionalRequirements: { title: "Functional Requirements", badge: "Capabilities" },
    nonFunctionalRequirements: { title: "Non-Functional Requirements", badge: "Quality" },
    systemAttributes: { title: "Software System Attributes", badge: "Quality" },
    otherRequirements: { title: "Other Requirements", badge: "Scope" },
    verification: { title: "Verification", badge: "Quality" },
    appendices: { title: "Appendices & Models", badge: "Diagrams" },
    overview: { title: "Overview", badge: "Vision" },
    objectives: { title: "Goals & Objectives", badge: "Goals" },
    personas: { title: "User Personas", badge: "Audience" },
    userStories: { title: "User Stories", badge: "Stories" },
    openQuestions: { title: "Open Questions", badge: "TBD" },
    purpose: { title: "Project Purpose", badge: "Purpose" },
    stakeholders: { title: "Stakeholders", badge: "Roles" },
    constraints: { title: "Constraints", badge: "Boundaries" },
    namingConventions: { title: "Terminology", badge: "Glossary" },
    projectIssues: { title: "Project Issues", badge: "Risks" },
    glossary: { title: "Glossary & Definitions", badge: "Glossary" }
}

function getSectionMeta(key: string): { title: string; badge: string } {
    if (SECTION_LABELS[key]) return SECTION_LABELS[key]
    const title = key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase())
        .trim()
    return { title, badge: "Section" }
}

export function VersionDiffViewer({ diff }: VersionDiffViewerProps) {
    const keys = Object.keys(diff || {})
    if (keys.length === 0) {
        return (
            <div className="p-8 text-center text-muted-foreground italic border rounded-lg bg-muted/5">
                No changes detected in this version.
            </div>
        )
    }

    return (
        <div className="space-y-10">
            {keys.map((key) => {
                const change = diff[key]
                if (!change) return null
                const meta = getSectionMeta(key)

                return (
                    <DiffSection key={key} title={meta.title} badge={meta.badge}>
                        {renderDiffBody(key, change.old, change.new)}
                    </DiffSection>
                )
            })}
        </div>
    )
}

function renderDiffBody(key: string, oldVal: unknown, newVal: unknown) {
    if (key === "inputText" && typeof oldVal === "string" && typeof newVal === "string") {
        return (
            <DiffText
                oldText={cleanInputText(oldVal)}
                newText={cleanInputText(newVal)}
            />
        )
    }

    if (
        (key === "systemFeatures" || key === "systemFunctions" || key === "functionalRequirements") &&
        Array.isArray(oldVal) &&
        Array.isArray(newVal)
    ) {
        return <DiffFeatures oldFeatures={oldVal as SystemFeature[]} newFeatures={newVal as SystemFeature[]} />
    }

    if (key === "appendices" && oldVal && newVal && typeof oldVal === "object" && typeof newVal === "object") {
        return <DiffDiagrams oldApp={oldVal as Appendices} newApp={newVal as Appendices} />
    }

    if (Array.isArray(oldVal) || Array.isArray(newVal)) {
        return <DiffList oldList={(oldVal as unknown[]) || []} newList={(newVal as unknown[]) || []} />
    }

    if (typeof oldVal === "object" || typeof newVal === "object") {
        return <DiffObject oldObj={(oldVal as Record<string, unknown>) || {}} newObj={(newVal as Record<string, unknown>) || {}} />
    }

    return (
        <DiffText
            oldText={String(oldVal ?? "N/A")}
            newText={String(newVal ?? "N/A")}
        />
    )
}

function DiffSection({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3 border-b pb-2">
                <h3 className="text-lg font-bold tracking-tight">{title}</h3>
                {badge && (
                    <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                        {badge}
                    </span>
                )}
            </div>
            {children}
        </div>
    )
}

function DiffText({ oldText, newText }: { oldText: string; newText: string }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 rounded-xl border bg-red-50/30 border-red-200/50">
                <div className="text-[10px] uppercase font-bold text-red-600 mb-2 flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-red-600" /> Previous
                </div>
                <div className="text-sm whitespace-pre-wrap break-words leading-relaxed opacity-70 italic">{oldText}</div>
            </div>
            <div className="p-4 rounded-xl border bg-green-50/30 border-green-200/50 shadow-sm">
                <div className="text-[10px] uppercase font-bold text-green-600 mb-2 flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-600 animate-pulse" /> Updated
                </div>
                <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">{newText}</div>
            </div>
        </div>
    )
}

function DiffObject<T extends object>({ oldObj, newObj }: { oldObj: T | undefined; newObj: T | undefined }) {
    const keys = Array.from(new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]))

    return (
        <div className="space-y-4">
            {keys.map((key) => {
                const o = (oldObj as Record<string, unknown>)?.[key]
                const n = (newObj as Record<string, unknown>)?.[key]
                if (JSON.stringify(o) === JSON.stringify(n)) return null

                const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())

                return (
                    <div key={key} className="space-y-1.5">
                        <label className="text-[11px] font-bold text-muted-foreground ml-1 uppercase tracking-wider">{label}</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-3 rounded-lg border bg-secondary/20 text-xs italic opacity-60">
                                {Array.isArray(o) ? o.map(it => typeof it === 'object' ? JSON.stringify(it) : String(it)).join(", ") : String(o ?? "N/A")}
                            </div>
                            <div className="p-3 rounded-lg border bg-primary/5 text-xs font-medium border-primary/20">
                                {Array.isArray(n) ? n.map(it => typeof it === 'object' ? JSON.stringify(it) : String(it)).join(", ") : String(n ?? "N/A")}
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

function DiffFeatures({ oldFeatures, newFeatures }: { oldFeatures: SystemFeature[]; newFeatures: SystemFeature[] }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
                <h4 className="text-[10px] uppercase font-bold text-red-600 mb-2 flex items-center gap-2 px-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-red-600" /> V1 Features
                </h4>
                <div className="space-y-3 opacity-60 italic">
                    {(oldFeatures || []).map((f, i) => (
                        <div key={i} className="p-3 rounded-xl border bg-muted/30 text-xs">
                            <div className="font-bold mb-1">{f?.name || `Feature ${i + 1}`}</div>
                            <div className="line-clamp-2 mb-2">{f?.description}</div>
                            {f?.functionalRequirements?.length > 0 && (
                                <div className="text-[10px] border-t pt-2 mt-2">
                                    <span className="font-bold uppercase tracking-tighter">Requirements:</span> {f.functionalRequirements.length} items
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
            <div className="space-y-4">
                <h4 className="text-[10px] uppercase font-bold text-green-600 mb-2 flex items-center gap-2 px-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-600 animate-pulse" /> V2 Features
                </h4>
                <div className="space-y-3">
                    {(newFeatures || []).map((f, i) => {
                        const isNew = !(oldFeatures || []).find((of) => of?.name === f?.name)
                        return (
                            <div
                                key={i}
                                className={cn(
                                    "p-3 rounded-xl border text-xs shadow-sm",
                                    isNew ? "bg-green-500/5 border-green-500/30" : "bg-card border-border"
                                )}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <div className="font-bold text-primary">{f?.name || `Feature ${i + 1}`}</div>
                                    {isNew && <span className="text-[9px] bg-green-500/20 text-green-700 px-1.5 py-0.5 rounded font-bold">NEW</span>}
                                </div>
                                <div className="line-clamp-3 leading-relaxed mb-2">{f?.description}</div>
                                {f?.functionalRequirements?.length > 0 && (
                                    <div className="text-[10px] border-t pt-2 mt-2 font-medium text-muted-foreground">
                                        <span className="font-bold uppercase tracking-tighter">Requirements:</span>{" "}
                                        {f.functionalRequirements.map((r) => (typeof r === "object" && r ? (r as { description?: string }).description || JSON.stringify(r) : String(r))).join(" • ")}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

function DiffDiagrams({ oldApp, newApp }: { oldApp: Appendices; newApp: Appendices }) {
    const oldModels = (oldApp?.analysisModels || {}) as Record<string, unknown>
    const newModels = (newApp?.analysisModels || {}) as Record<string, unknown>
    const keys = Array.from(new Set([...Object.keys(oldModels), ...Object.keys(newModels)]))

    return (
        <div className="space-y-4">
            {keys.map((key) => {
                const o = oldModels[key]
                const n = newModels[key]

                const getCode = (val: unknown): string => {
                    if (typeof val === "string") return val
                    if (val && typeof val === "object" && "code" in val) {
                        return (val as { code: string }).code || ""
                    }
                    return ""
                }

                const oCode = getCode(o)
                const nCode = getCode(n)

                if (oCode === nCode) return null

                const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())

                return (
                    <div key={key} className="space-y-1.5">
                        <label className="text-[11px] font-bold text-muted-foreground ml-1 uppercase tracking-wider">{label}</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-3 rounded-lg border bg-secondary/20 text-xs italic opacity-60 overflow-hidden text-ellipsis whitespace-nowrap">
                                {oCode ? "Diagram Modified" : "N/A"}
                            </div>
                            <div className="p-3 rounded-lg border bg-primary/5 text-xs font-medium border-primary/20">
                                {nCode ? (oCode ? "Updated Code" : "Initial Diagram") : "Removed"}
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

function DiffList({ oldList, newList }: { oldList: unknown[]; newList: unknown[] }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border bg-muted/20 text-xs italic opacity-60">
                <ul className="list-disc pl-4 space-y-2">
                    {(oldList || []).map((item, i) => (
                        <li key={i}>{typeof item === "object" ? JSON.stringify(item) : String(item)}</li>
                    ))}
                </ul>
            </div>
            <div className="p-4 rounded-xl border bg-primary/5 text-xs font-medium border-primary/20">
                <ul className="list-disc pl-4 space-y-2">
                    {(newList || []).map((item, i) => (
                        <li key={i}>{typeof item === "object" ? JSON.stringify(item) : String(item)}</li>
                    ))}
                </ul>
            </div>
        </div>
    )
}
