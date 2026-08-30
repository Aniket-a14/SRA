"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { DocsCallout, type CalloutType } from "./docs-callout"
import { DocsCodeBlock } from "./docs-code-block"
import { cn } from "@/lib/utils"

const MermaidRenderer = dynamic(() => import("@/components/mermaid-renderer").then(m => m.MermaidRenderer), {
    loading: () => <div className="h-32 w-full bg-muted/5 animate-pulse" />,
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

            // 1. Mermaid Code Block — auto-sized to exact dimensions needed
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
                    <div key={`mermaid-${i}`} className="my-4 border border-foreground/10 bg-muted/5 p-3 overflow-x-auto">
                        <MermaidRenderer chart={chart} variant="fluid" />
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
                        <p>{renderInlineMarkdown(calloutLines.join(" "))}</p>
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
                        <div key={`table-${i}`} className="my-5 overflow-x-auto border border-foreground/10 bg-background">
                            <table className="w-full text-xs text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-foreground/10 bg-muted/10 font-mono text-[11px] uppercase tracking-wider">
                                        {headers.map((h, hIdx) => (
                                            <th key={hIdx} className="px-3.5 py-2.5 font-semibold text-foreground">
                                                {renderInlineMarkdown(h)}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-foreground/5">
                                    {rows.map((row, rIdx) => (
                                        <tr key={rIdx} className="hover:bg-muted/5 transition-colors">
                                            {row.map((cell, cIdx) => (
                                                <td key={cIdx} className="px-3.5 py-2.5 text-foreground/80 leading-relaxed font-sans">
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
                    <h3 key={`h3-${i}`} className="text-lg font-display font-medium text-foreground pt-4 mb-2">
                        {renderInlineMarkdown(line.replace("### ", ""))}
                    </h3>
                )
                i++
                continue
            }
            if (line.startsWith("#### ")) {
                result.push(
                    <h4 key={`h4-${i}`} className="text-sm font-semibold text-foreground font-sans pt-2 mb-1">
                        {renderInlineMarkdown(line.replace("#### ", ""))}
                    </h4>
                )
                i++
                continue
            }

            // 6. Bullet lists (- or *)
            if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
                const listItems: string[] = []
                while (i < lines.length && (lines[i].trim().startsWith("- ") || lines[i].trim().startsWith("* "))) {
                    listItems.push(lines[i].trim().substring(2))
                    i++
                }
                result.push(
                    <ul key={`ul-${i}`} className="list-disc list-inside space-y-1 text-xs sm:text-sm text-foreground/80 my-2.5 pl-1">
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
                    <ol key={`ol-${i}`} className="list-decimal list-inside space-y-1 text-xs sm:text-sm text-foreground/80 my-2.5 pl-1">
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
                    <p key={`p-${i}`} className="text-xs sm:text-sm text-foreground/85 leading-relaxed my-2 font-sans">
                        {renderInlineMarkdown(line)}
                    </p>
                )
            }

            i++
        }

        return result
    }, [content])

    return (
        <div className={cn("space-y-2.5 leading-relaxed", className)}>
            {blocks}
        </div>
    )
}

/**
 * Robust markdown inline tokenizer: handles code, bold, italics, math, and links.
 */
function renderInlineMarkdown(text: string): React.ReactNode {
    if (!text) return null

    // Replace LaTeX math expressions for clean visual rendering
    const cleanText = text
        .replace(/\\\$/g, "$")
        .replace(/\$\\ge\s*(\d+)\$/g, "≥ $1")
        .replace(/\$\\le\s*(\d+)\$/g, "≤ $1")
        .replace(/\$\\text\{([^}]+)\}\s*\\rightarrow\s*\\text\{([^}]+)\}\$/g, "$1 → $2")
        .replace(/\$\$\\text\{([^}]+)\}\s*\\rightarrow\s*\\text\{([^}]+)\}\$\$/g, "$1 → $2")
        .replace(/\$\\rightarrow\$/g, "→")

    // Regex tokenizing: code `...`, bold **...**, link [title](url), italic *...*
    const tokenRegex = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|\*[^*]+\*)/g
    const parts = cleanText.split(tokenRegex)

    return parts.map((part, idx) => {
        if (!part) return null

        // Inline Code `code`
        if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
            return (
                <code key={idx} className="font-mono text-[11px] bg-muted/60 px-1 py-0.5 text-primary border border-foreground/10 mx-0.5">
                    {part.slice(1, -1)}
                </code>
            )
        }

        // Bold **text**
        if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
            return (
                <strong key={idx} className="font-semibold text-foreground">
                    {part.slice(2, -2)}
                </strong>
            )
        }

        // Italic *text*
        if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
            return (
                <em key={idx} className="italic text-foreground/90">
                    {part.slice(1, -1)}
                </em>
            )
        }

        // Markdown Link [text](url)
        const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
        if (linkMatch) {
            const [, linkText, url] = linkMatch
            const isInternal = url.startsWith("/") || url.startsWith("#")
            if (isInternal) {
                return (
                    <Link
                        key={idx}
                        href={url}
                        className="text-primary underline underline-offset-4 hover:text-foreground font-medium transition-colors"
                    >
                        {linkText}
                    </Link>
                )
            }
            return (
                <a
                    key={idx}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-4 hover:text-foreground font-medium transition-colors"
                >
                    {linkText}
                </a>
            )
        }

        return part
    })
}
