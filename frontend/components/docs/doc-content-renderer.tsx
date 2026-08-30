"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { DocsCallout, type CalloutType } from "./docs-callout"
import { DocsCodeBlock } from "./docs-code-block"
import { cn } from "@/lib/utils"

const MermaidRenderer = dynamic(() => import("@/components/mermaid-renderer").then(m => m.MermaidRenderer), {
    loading: () => <div className="h-[220px] w-full bg-muted/10 animate-pulse rounded-xl" />,
    ssr: false
})

interface DocContentRendererProps {
    content: string
    className?: string
}

export function DocContentRenderer({ content, className }: DocContentRendererProps) {
    // Split content into blocks (paragraphs, code blocks, mermaid charts, callouts, tables)
    const blocks = React.useMemo(() => {
        if (!content) return []
        const result: React.ReactNode[] = []
        const lines = content.split("\n")
        let i = 0

        while (i < lines.length) {
            const line = lines[i]

            // 1. Mermaid Code Block
            if (line.trim().startsWith("```mermaid")) {
                const chartLines: string[] = []
                i++
                while (i < lines.length && !lines[i].trim().startsWith("```")) {
                    chartLines.push(lines[i])
                    i++
                }
                i++ // skip closing ```
                const chart = chartLines.join("\n")
                result.push(
                    <div key={`mermaid-${i}`} className="my-6 p-4 rounded-xl border border-foreground/10 bg-background/50 overflow-hidden">
                        <MermaidRenderer chart={chart} title="Architecture Diagram" />
                    </div>
                )
                continue
            }

            // 2. Standard Fenced Code Block
            if (line.trim().startsWith("```")) {
                const lang = line.trim().replace("```", "") || "text"
                const codeLines: string[] = []
                i++
                while (i < lines.length && !lines[i].trim().startsWith("```")) {
                    codeLines.push(lines[i])
                    i++
                }
                i++ // skip closing ```
                result.push(
                    <DocsCodeBlock
                        key={`code-${i}`}
                        language={lang}
                        code={codeLines.join("\n")}
                    />
                )
                continue
            }

            // 3. GitHub-style Alert Callout (> [!NOTE], > [!TIP], > [!IMPORTANT], > [!WARNING], > [!CAUTION])
            if (line.trim().startsWith("> [!")) {
                const match = line.trim().match(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|SECURITY)\]/i)
                const type = (match ? match[1].toLowerCase() : "note") as CalloutType
                const calloutLines: string[] = []
                i++
                while (i < lines.length && (lines[i].trim().startsWith(">") || lines[i].trim() === "")) {
                    calloutLines.push(lines[i].replace(/^>\s?/, ""))
                    i++
                }
                result.push(
                    <DocsCallout key={`callout-${i}`} type={type}>
                        <p>{calloutLines.join(" ")}</p>
                    </DocsCallout>
                )
                continue
            }

            // 4. Markdown Table (| Col 1 | Col 2 |)
            if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
                const tableLines: string[] = []
                while (i < lines.length && lines[i].trim().startsWith("|")) {
                    tableLines.push(lines[i].trim())
                    i++
                }

                if (tableLines.length >= 2) {
                    const headers = tableLines[0].split("|").filter((_, idx, arr) => idx > 0 && idx < arr.length - 1).map(c => c.trim())
                    const rows = tableLines.slice(2).map(r => r.split("|").filter((_, idx, arr) => idx > 0 && idx < arr.length - 1).map(c => c.trim()))

                    result.push(
                        <div key={`table-${i}`} className="my-6 overflow-x-auto rounded-xl border border-foreground/10">
                            <table className="w-full text-xs text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-foreground/10 bg-muted/40 font-mono text-[11px] uppercase tracking-wider">
                                        {headers.map((h, hIdx) => (
                                            <th key={hIdx} className="px-4 py-2.5 font-semibold text-foreground">
                                                {h.replace(/\*\*/g, "")}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-foreground/5 bg-background">
                                    {rows.map((row, rIdx) => (
                                        <tr key={rIdx} className="hover:bg-muted/10 transition-colors">
                                            {row.map((cell, cIdx) => (
                                                <td key={cIdx} className="px-4 py-2.5 text-foreground/80 leading-relaxed">
                                                    {renderInlineMarkdown(cell)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                    continue
                }
            }

            // 5. Headings (###, ####)
            if (line.startsWith("### ")) {
                result.push(
                    <h3 key={`h3-${i}`} className="text-lg font-display font-semibold text-foreground pt-4 mb-2">
                        {line.replace("### ", "")}
                    </h3>
                )
                i++
                continue
            }
            if (line.startsWith("#### ")) {
                result.push(
                    <h4 key={`h4-${i}`} className="text-sm font-semibold text-foreground font-sans pt-2 mb-1">
                        {line.replace("#### ", "")}
                    </h4>
                )
                i++
                continue
            }

            // 6. Bullet lists
            if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
                const listItems: string[] = []
                while (i < lines.length && (lines[i].trim().startsWith("- ") || lines[i].trim().startsWith("* "))) {
                    listItems.push(lines[i].trim().substring(2))
                    i++
                }
                result.push(
                    <ul key={`ul-${i}`} className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-foreground/80 my-3 pl-2">
                        {listItems.map((item, lIdx) => (
                            <li key={lIdx} className="leading-relaxed">
                                {renderInlineMarkdown(item)}
                            </li>
                        ))}
                    </ul>
                )
                continue
            }

            // 7. Numbered lists (1. , 2. )
            if (/^\d+\.\s/.test(line.trim())) {
                const listItems: string[] = []
                while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
                    listItems.push(lines[i].trim().replace(/^\d+\.\s/, ""))
                    i++
                }
                result.push(
                    <ol key={`ol-${i}`} className="list-decimal list-inside space-y-1.5 text-xs sm:text-sm text-foreground/80 my-3 pl-2">
                        {listItems.map((item, lIdx) => (
                            <li key={lIdx} className="leading-relaxed">
                                {renderInlineMarkdown(item)}
                            </li>
                        ))}
                    </ol>
                )
                continue
            }

            // 8. Regular paragraph
            if (line.trim()) {
                result.push(
                    <p key={`p-${i}`} className="text-xs sm:text-sm text-foreground/80 leading-relaxed my-2.5 font-sans">
                        {renderInlineMarkdown(line)}
                    </p>
                )
            }

            i++
        }

        return result
    }, [content])

    return (
        <div className={cn("space-y-3 leading-relaxed", className)}>
            {blocks}
        </div>
    )
}

function renderInlineMarkdown(text: string): React.ReactNode {
    // Parse inline code `code`, bold **text**, and links
    const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g)

    return parts.map((part, idx) => {
        if (part.startsWith("`") && part.endsWith("`")) {
            return (
                <code key={idx} className="font-mono text-[11px] bg-muted/60 px-1 py-0.5 rounded text-primary border border-foreground/5">
                    {part.slice(1, -1)}
                </code>
            )
        }
        if (part.startsWith("**") && part.endsWith("**")) {
            return (
                <strong key={idx} className="font-semibold text-foreground">
                    {part.slice(2, -2)}
                </strong>
            )
        }
        return part
    })
}
