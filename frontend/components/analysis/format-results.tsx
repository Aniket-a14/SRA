"use client"

import { memo, Fragment } from "react"
import dynamic from "next/dynamic"
import { Card, CardContent } from "@/components/ui/card"
import { ErrorBoundary } from "@/components/error-boundary"
import type { FormatSpec, FormatSection } from "@/lib/formats"
import type { RequirementShell } from "@/lib/formats/types"

const MermaidRenderer = dynamic(() => import("@/components/mermaid-renderer").then(m => m.MermaidRenderer), {
    loading: () => <div className="h-[300px] w-full bg-muted/20 animate-pulse rounded-lg" />,
    ssr: false,
})

type AnyData = Record<string, unknown>

// ---- small render helpers -------------------------------------------------

const boldify = (text: string) =>
    text.split(/(\*\*.*?\*\*)/g).filter(Boolean).map((part, i) =>
        part.startsWith("**") && part.endsWith("**")
            ? <strong key={i}>{part.slice(2, -2)}</strong>
            : <Fragment key={i}>{part}</Fragment>
    )

const Prose = ({ text }: { text?: unknown }) =>
    text && typeof text === "string"
        ? <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">{boldify(text)}</p>
        : <p className="text-sm italic text-muted-foreground">Not specified.</p>

const BulletList = ({ items }: { items?: unknown }) => {
    const list = Array.isArray(items) ? items : []
    if (list.length === 0) return <p className="text-sm italic text-muted-foreground">None specified.</p>
    return (
        <ul className="list-disc list-inside space-y-1.5 text-sm text-foreground/90">
            {list.map((it, i) => <li key={i}>{typeof it === "string" ? boldify(it) : JSON.stringify(it)}</li>)}
        </ul>
    )
}

const isShell = (r: unknown): r is RequirementShell => !!r && typeof r === "object" && "description" in (r as object)

const RequirementItems = ({ items, prefix }: { items?: unknown; prefix: string }) => {
    const list = Array.isArray(items) ? items : []
    if (list.length === 0) return <p className="text-sm italic text-muted-foreground">None specified.</p>
    return (
        <div className="space-y-2">
            {list.map((r, i) => {
                if (typeof r === "string") {
                    return (
                        <p key={i} className="text-sm text-foreground/90">
                            <span className="font-mono text-xs text-primary mr-2">{prefix}-{i + 1}</span>{boldify(r)}
                        </p>
                    )
                }
                if (isShell(r)) {
                    return (
                        <div key={i} className="rounded-md border border-foreground/10 p-3 text-sm space-y-1">
                            <p className="text-foreground/90"><span className="font-mono text-xs text-primary mr-2">{r.id || `${prefix}-${i + 1}`}</span>{boldify(r.description)}</p>
                            {r.rationale && <p className="text-xs text-muted-foreground"><span className="font-medium">Rationale:</span> {r.rationale}</p>}
                            {r.fitCriterion && <p className="text-xs text-muted-foreground"><span className="font-medium">Fit criterion:</span> {r.fitCriterion}</p>}
                            {r.source && <p className="text-xs text-muted-foreground"><span className="font-medium">Source:</span> {r.source}</p>}
                        </div>
                    )
                }
                return <p key={i} className="text-sm">{JSON.stringify(r)}</p>
            })}
        </div>
    )
}

const diagramCode = (d: unknown): string =>
    typeof d === "string" ? d : (d && typeof d === "object" && "code" in d ? String((d as { code?: string }).code || "") : "")

// ---- per-kind section renderer -------------------------------------------

function SectionBody({ section, data }: { section: FormatSection; data: AnyData }) {
    const value = data[section.id]

    switch (section.kind) {
        case "prose":
            return <Prose text={value} />

        case "list":
            return <BulletList items={value} />

        case "group": {
            const obj = (value || {}) as AnyData
            return (
                <div className="space-y-4">
                    {(section.fields || []).map((f) => (
                        <div key={f.id} className="space-y-1.5">
                            <h4 className="text-sm font-semibold text-foreground/80">{section.number}.{(section.fields!.indexOf(f) + 1)} {f.label}</h4>
                            {f.kind === "prose" && <Prose text={obj[f.id]} />}
                            {f.kind === "list" && <BulletList items={obj[f.id]} />}
                            {f.kind === "shell-list" && <RequirementItems items={obj[f.id]} prefix={f.label.split(" ")[0].toUpperCase().slice(0, 3)} />}
                            {f.kind === "user-classes" && <UserClasses items={obj[f.id]} />}
                        </div>
                    ))}
                </div>
            )
        }

        case "feature-list": {
            const feats = Array.isArray(value) ? value as AnyData[] : []
            if (feats.length === 0) return <p className="text-sm italic text-muted-foreground">No features specified.</p>
            return (
                <div className="space-y-5">
                    {feats.map((f, i) => (
                        <div key={i} className="space-y-2 border-l-2 border-primary/30 pl-4">
                            <h4 className="font-semibold">{section.number}.{i + 1} {String(f.name || "")}</h4>
                            <Prose text={f.description} />
                            {Array.isArray(f.stimulusResponseSequences) && f.stimulusResponseSequences.length > 0 && (
                                <div className="text-sm text-muted-foreground space-y-1">
                                    {(f.stimulusResponseSequences as string[]).map((s, j) => <p key={j}>{boldify(s)}</p>)}
                                </div>
                            )}
                            <RequirementItems items={f.functionalRequirements} prefix="FR" />
                        </div>
                    ))}
                </div>
            )
        }

        case "requirement-group":
            return <RequirementItems items={value} prefix="REQ" />

        case "user-classes":
            return <UserClasses items={value} />

        case "stakeholders": {
            const list = Array.isArray(value) ? value as AnyData[] : []
            return (
                <div className="space-y-2">
                    {list.map((s, i) => (
                        <p key={i} className="text-sm"><span className="font-semibold">{String(s.role || "")}: </span>{String(s.interest || "")}</p>
                    ))}
                </div>
            )
        }

        case "personas": {
            const list = Array.isArray(value) ? value as AnyData[] : []
            return (
                <div className="grid gap-3 sm:grid-cols-2">
                    {list.map((p, i) => (
                        <Card key={i}><CardContent className="pt-4 space-y-1">
                            <p className="font-semibold">{String(p.name || "")}</p>
                            <p className="text-sm text-muted-foreground">{String(p.description || "")}</p>
                            {Array.isArray(p.goals) && <BulletList items={p.goals} />}
                        </CardContent></Card>
                    ))}
                </div>
            )
        }

        case "user-stories": {
            const list = Array.isArray(value) ? value as AnyData[] : []
            return (
                <div className="space-y-3">
                    {list.map((s, i) => (
                        <div key={i} className="rounded-md border border-foreground/10 p-3 space-y-1.5">
                            <p className="text-sm"><span className="font-mono text-xs text-primary mr-2">US-{i + 1}</span>As a <strong>{String(s.role || "")}</strong>, I want {String(s.action || "")}, so that {String(s.benefit || "")}.</p>
                            {Array.isArray(s.acceptanceCriteria) && s.acceptanceCriteria.length > 0 && (
                                <div className="pl-4">
                                    <p className="text-xs font-medium text-muted-foreground mb-1">Acceptance criteria</p>
                                    <BulletList items={s.acceptanceCriteria} />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )
        }

        case "issues": {
            const list = Array.isArray(value) ? value as AnyData[] : []
            return (
                <div className="space-y-2">
                    {list.map((it, i) => (
                        <div key={i} className="text-sm">
                            <span className="font-semibold">{String(it.issue || "")}</span>
                            {it.type ? <span className="ml-2 text-xs text-muted-foreground">[{String(it.type)}]</span> : null}
                            {it.impact ? <p className="text-xs text-muted-foreground">{String(it.impact)}</p> : null}
                        </div>
                    ))}
                </div>
            )
        }

        case "glossary": {
            const list = Array.isArray(value) ? value as AnyData[] : []
            if (list.length === 0) return <p className="text-sm italic text-muted-foreground">No terms defined.</p>
            return (
                <div className="grid gap-3 sm:grid-cols-2">
                    {list.map((g, i) => (
                        <Card key={i}><CardContent className="pt-4">
                            <dt className="font-semibold text-primary mb-1">{String(g.term || "")}</dt>
                            <dd className="text-sm text-muted-foreground">{String(g.definition || "")}</dd>
                        </CardContent></Card>
                    ))}
                </div>
            )
        }

        case "diagrams": {
            const models = (value as AnyData)?.analysisModels as AnyData | undefined
            if (!models) return <p className="text-sm italic text-muted-foreground">No analysis models.</p>
            const canonical: { key: string; title: string }[] = [
                { key: "flowchartDiagram", title: "Flowchart" },
                { key: "sequenceDiagram", title: "Sequence Diagram" },
                { key: "entityRelationshipDiagram", title: "Entity Relationship Diagram" },
            ]
            const additional = Array.isArray(models.additionalDiagrams) ? models.additionalDiagrams as AnyData[] : []
            return (
                <div className="space-y-6">
                    {canonical.map(({ key, title }) => {
                        const code = diagramCode(models[key])
                        if (!code) return null
                        return (
                            <ErrorBoundary key={key} name={`${title}`}>
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold">{title}</h4>
                                    <MermaidRenderer chart={code} title={title} />
                                </div>
                            </ErrorBoundary>
                        )
                    })}
                    {additional.map((d, i) => {
                        const code = diagramCode(d)
                        if (!code) return null
                        const title = String(d.title || "Model")
                        return (
                            <ErrorBoundary key={`add-${i}`} name={title}>
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold">{title}{d.appliesTo ? <span className="text-muted-foreground font-normal"> — {String(d.appliesTo)}</span> : null}</h4>
                                    <MermaidRenderer chart={code} title={title} />
                                </div>
                            </ErrorBoundary>
                        )
                    })}
                </div>
            )
        }

        default:
            return null
    }
}

function UserClasses({ items }: { items?: unknown }) {
    const list = Array.isArray(items) ? items as AnyData[] : []
    if (list.length === 0) return <p className="text-sm italic text-muted-foreground">Not specified.</p>
    return (
        <div className="space-y-2">
            {list.map((u, i) => (
                <p key={i} className="text-sm"><span className="font-semibold">{String(u.userClass || "")}: </span>{String(u.characteristics || "")}</p>
            ))}
        </div>
    )
}

/**
 * Generic, format-driven results view. Walks the chosen format's descriptor and renders each
 * section by kind from the format-shaped resultJson. Used for every non-IEEE format; IEEE keeps
 * its bespoke interactive tabs.
 */
export const FormatResults = memo(function FormatResults({ spec, data }: { spec: FormatSpec; data: AnyData }) {
    return (
        <div className="space-y-8 px-4 sm:px-6 pb-10">
            <div className="flex items-center gap-2">
                <span className="text-xs font-mono px-2 py-0.5 rounded-full border border-foreground/10 text-muted-foreground">{spec.name}</span>
            </div>
            {spec.sections.map((section) => (
                <section key={section.id} className="space-y-3">
                    <h3 className="text-lg font-semibold border-l-4 border-primary pl-3">
                        {section.appendix ? `Appendix ${section.number}` : section.number}. {section.title}
                    </h3>
                    <div className="pl-3">
                        <SectionBody section={section} data={data} />
                    </div>
                </section>
            ))}
        </div>
    )
})
