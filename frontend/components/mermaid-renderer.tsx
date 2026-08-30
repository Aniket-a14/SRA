"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface Diagram {
    code: string
    caption?: string
}

export interface MermaidRendererProps {
    chart: string | Diagram
    title?: string
    className?: string
    onError?: (error: string) => void
    isExport?: boolean
    variant?: "card" | "inline" | "fluid"
}

interface MermaidInstance {
    render: (id: string, text: string) => Promise<{ svg: string }>
}

export function MermaidRenderer({
    chart,
    title,
    className,
    onError,
    isExport = false,
    variant = "fluid"
}: MermaidRendererProps) {
    const ref = useRef<HTMLDivElement>(null)
    const [mermaidInstance, setMermaidInstance] = useState<MermaidInstance | null>(null)
    const [hasError, setHasError] = useState(false)

    useEffect(() => {
        import("mermaid").then((m) => {
            m.default.initialize({
                startOnLoad: false,
                theme: isExport ? 'neutral' : 'default',
                themeVariables: isExport ? {
                    fontFamily: 'arial, sans-serif',
                    fontSize: '16px',
                    nodeBorder: '#000000',
                    mainBkg: '#ffffff',
                    textColor: '#000000',
                    lineColor: '#000000'
                } : undefined,
                securityLevel: 'strict',
                fontFamily: 'arial, sans-serif',
                flowchart: { useMaxWidth: true, htmlLabels: true }
            })
            setMermaidInstance(m.default)
        })
    }, [isExport])

    useEffect(() => {
        if (!chart || !mermaidInstance) return

        // Extract code string
        const code = typeof chart === 'string' ? chart : (chart?.code || "")

        // Clean the string
        const formatted = code
            .replace(/\\n/g, "\n")
            .replace(/[^\x20-\x7E\n\t]/g, "")
            .trim()

        const renderDiagram = async () => {
            setHasError(false)
            try {
                // Clear previous content
                if (ref.current) ref.current.innerHTML = ""

                const id = "diagram-" + Math.random().toString(36).substring(7)
                try {
                    const { svg } = await mermaidInstance.render(id, formatted)
                    renderSvg(svg)
                } catch (renderError) {
                    const errString = String(renderError)
                    if (errString.includes("Trying to inactivate an inactive participant")) {
                        console.warn("Mermaid Error Detected: Inactive Participant. Applying auto-fix.")
                        const fixedCode = formatted.replace(/^\s*deactivate\s+.*$/gim, "%% Fixed: deactivated removed")
                        const { svg } = await mermaidInstance.render(id, fixedCode)
                        renderSvg(svg)
                    } else {
                        throw renderError
                    }
                }

                function renderSvg(svg: string) {
                    if (ref.current) {
                        ref.current.innerHTML = svg
                        const svgEl = ref.current.querySelector('svg')
                        if (svgEl) {
                            svgEl.removeAttribute('height')
                            svgEl.style.maxWidth = '100%'
                            svgEl.style.height = 'auto'
                            svgEl.style.display = 'block'
                            svgEl.style.margin = '0 auto'
                        }
                    }
                }
            } catch (err) {
                console.error("Mermaid Render Error:", err)
                setHasError(true)
                const errorMessage = err instanceof Error ? err.message : String(err)
                onError?.(errorMessage)
            }
        }

        renderDiagram()
    }, [chart, mermaidInstance, title, isExport, onError])

    // EXPORT OR INLINE / FLUID MODE: Render tightly auto-sized diagram taking exact space needed
    if (isExport || variant === "inline" || variant === "fluid") {
        return (
            <div className={cn("w-full flex flex-col items-center justify-center overflow-x-auto", className)}>
                <div
                    ref={ref}
                    role="img"
                    aria-label={title ? `Diagram: ${title}` : "Diagram"}
                    className={cn(
                        "w-full flex justify-center items-center py-2",
                        (hasError || !chart) ? "opacity-0 pointer-events-none" : "opacity-100"
                    )}
                />
                {hasError && <p className="text-red-500 text-xs py-2">Unable to render diagram.</p>}
            </div>
        )
    }

    // CARD MODE: Interactive Bordered Container
    return (
        <Card className={cn(
            "w-full bg-card border border-foreground/10 group flex flex-col relative",
            className
        )}>
            {title && (
                <CardHeader className="pb-2 px-4 pt-3 border-b border-foreground/5">
                    <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-medium">
                        {title}
                    </CardTitle>
                </CardHeader>
            )}
            <CardContent className="overflow-x-auto p-4 relative flex items-center justify-center min-h-[100px]">
                {hasError || !chart ? (
                    <div className="text-muted-foreground text-xs p-4 text-center">
                        {hasError ? "Unable to render diagram. Please check syntax." : "No diagram available"}
                    </div>
                ) : null}
                <div
                    ref={ref}
                    role="img"
                    aria-label={title ? `Diagram: ${title}` : "Diagram"}
                    className={cn(
                        "flex justify-center items-center w-full",
                        (hasError || !chart) ? "opacity-0 pointer-events-none" : "opacity-100"
                    )}
                />
            </CardContent>
        </Card>
    )
}
