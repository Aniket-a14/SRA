"use client"

import React from "react"
import type { AnalysisResult } from "@/types/analysis"
import { getFormatSpec, resolveFormatId } from "@/lib/formats"

interface PrintCoverPageProps {
    analysis: AnalysisResult
    title?: string
}

export function PrintCoverPage({ analysis, title }: PrintCoverPageProps) {
    const resolvedId = resolveFormatId(analysis)
    const spec = getFormatSpec(resolvedId)
    const displayTitle = (title || analysis.projectTitle || "System Requirements Specification").trim()
    const anyData = analysis as unknown as Record<string, unknown>
    const purpose =
        (typeof analysis.introduction?.purpose === "string" ? analysis.introduction.purpose : "") ||
        (typeof (anyData.overview as Record<string, unknown>)?.vision === "string" ? String((anyData.overview as Record<string, unknown>).vision) : "") ||
        (typeof (anyData.purpose as Record<string, unknown>)?.businessProblem === "string" ? String((anyData.purpose as Record<string, unknown>).businessProblem) : "") ||
        "Formal engineering requirements specification and architecture baseline."

    return (
        <div className="hidden print:flex flex-col justify-between min-h-[980px] p-8 border-b-2 border-slate-900 mb-8 break-after-page bg-white text-slate-950">
            {/* Top Bar: Standard & Document Classification */}
            <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold tracking-wider uppercase px-2.5 py-1 rounded bg-slate-100 text-slate-800 border border-slate-200">
                        {spec.name} ({spec.id.toUpperCase()})
                    </span>
                    <span className="text-xs font-mono px-2 py-0.5 text-slate-500">
                        CONFIDENTIAL
                    </span>
                </div>
                <span className="text-xs font-mono text-slate-500">
                    Version 1.0.0
                </span>
            </div>

            {/* Middle: Title Block & Executive Brief */}
            <div className="my-auto space-y-6">
                <div className="space-y-2">
                    <div className="text-xs uppercase tracking-widest font-mono text-slate-500 font-semibold">
                        {spec.coverSubtitle}
                    </div>
                    <h1 className="text-4xl font-bold tracking-tight font-display text-slate-950 leading-tight">
                        {displayTitle}
                    </h1>
                </div>

                <div className="h-1 w-24 bg-indigo-600 rounded-full" />

                {/* Executive Brief Card */}
                <div className="p-5 rounded-lg border border-slate-200 bg-slate-50/80 space-y-2">
                    <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-700">
                        Executive Overview
                    </h4>
                    <p className="text-xs leading-relaxed text-slate-600">
                        {purpose}
                    </p>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200 text-xs">
                    <div>
                        <span className="font-mono text-[10px] uppercase text-slate-400 block">Specification Standard</span>
                        <span className="font-semibold text-slate-800">{spec.name}</span>
                    </div>
                    <div>
                        <span className="font-mono text-[10px] uppercase text-slate-400 block">Date Generated</span>
                        <span className="font-semibold text-slate-800">{new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
                    </div>
                    <div>
                        <span className="font-mono text-[10px] uppercase text-slate-400 block">Platform</span>
                        <span className="font-semibold text-slate-800">SRA (Smart Requirements Analyzer)</span>
                    </div>
                    <div>
                        <span className="font-mono text-[10px] uppercase text-slate-400 block">Traceability Baseline</span>
                        <span className="font-semibold text-slate-800 font-mono">STRICT_COMPLIANT</span>
                    </div>
                </div>
            </div>

            {/* Bottom Footer */}
            <div className="flex items-center justify-between border-t pt-4 text-[10px] font-mono text-slate-400">
                <span>Prepared with Smart Requirements Analyzer</span>
                <span>Page 1 of Document</span>
            </div>
        </div>
    )
}
