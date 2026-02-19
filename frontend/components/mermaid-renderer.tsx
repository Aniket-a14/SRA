"use client"


import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface Diagram {
    code: string;
    caption?: string;
}

interface MermaidRendererProps {
    chart: string | Diagram
    title: string
    className?: string
    onError?: (error: string) => void
    isExport?: boolean
}

interface MermaidInstance {
    render: (id: string, text: string) => Promise<{ svg: string }>
}

export function MermaidRenderer({ chart, title, className, onError, isExport = false }: MermaidRendererProps) {
    const ref = useRef<HTMLDivElement>(null)
    const [mermaidInstance, setMermaidInstance] = useState<MermaidInstance | null>(null)
    const [hasError, setHasError] = useState(false)

    useEffect(() => {
        import("mermaid").then((m) => {
            m.default.initialize({
                startOnLoad: false,
                theme: isExport ? 'neutral' : 'default', // Neutral is reliable grayscale/B&W
                themeVariables: isExport ? {
                    fontFamily: 'arial, sans-serif',
                    fontSize: '16px', // Force larger font
                    nodeBorder: '#000000',
                    mainBkg: '#ffffff',
                    textColor: '#000000',
                    lineColor: '#000000'
                } : undefined,
                securityLevel: 'loose',
                fontFamily: 'arial, sans-serif',
                flowchart: { useMaxWidth: !isExport, htmlLabels: true }
            })
            setMermaidInstance(m.default)
        })
    }, [isExport])

    useEffect(() => {
        setHasError(false)
        if (!chart || !mermaidInstance) return

        // Extract code string
        const code = typeof chart === 'string' ? chart : (chart?.code || "");

        // Clean the string:
        // 1. Replace escaped newlines
        // 2. Remove any non-printable characters (except newlines and tabs)
        // 3. Trim whitespace
        const formatted = code
            .replace(/\\n/g, "\n")
            .replace(/[^\x20-\x7E\n\t]/g, "")
            .trim()



        const renderDiagram = async () => {
            try {
                // Clear previous content
                if (ref.current) ref.current.innerHTML = ""

                const id = "diagram-" + Math.random().toString(36).substring(7)
                // Auto-Fix: Retry logic for common LLM sequence diagram errors
                try {
                    const { svg } = await mermaidInstance.render(id, formatted)
                    renderSvg(svg)
                } catch (renderError) {
                    const errString = String(renderError)
                    if (errString.includes("Trying to inactivate an inactive participant")) {
                        console.warn("Mermaid Error Detected: Inactive Participant. Applying auto-fix (removing deactivations).")
                        const fixedCode = formatted.replace(/^\s*deactivate\s+.*$/gim, "%% Fixed: deactivated removed");
                        const { svg } = await mermaidInstance.render(id, fixedCode)
                        renderSvg(svg)
                    } else {
                        throw renderError
                    }
                }

                function renderSvg(svg: string) {
                    if (ref.current) {
                        ref.current.innerHTML = svg
                        // Force SVG to be 100% width/height if export
                        if (isExport) {
                            const svgEl = ref.current.querySelector('svg');
                            if (svgEl) {
                                svgEl.removeAttribute('height'); // Allow scaling
                                svgEl.removeAttribute('width');
                                svgEl.style.width = '100%';
                                svgEl.style.height = 'auto';
                            }
                        }
                    }
                }
            } catch (err) {
                console.error("Mermaid Render Error:", err)
                const errorMessage = err instanceof Error ? err.message : String(err)
                onError?.(errorMessage)
            }
        }

        renderDiagram()
    }, [chart, mermaidInstance, title, isExport, onError])

    // EXPORT MODE: Render clean, auto-sized div without Card/Scrollbars
    if (isExport) {
        return (
            <div className={cn("w-full bg-white flex flex-col items-center", className)}>
                <div
                    ref={ref}
                    className={cn(
                        "w-full flex justify-center", // Removed p-4 to minimize padding
                        (hasError || !chart) ? "opacity-0" : "opacity-100"
                    )}
                />
                {hasError && <p className="text-red-500 text-sm">Render Error</p>}
            </div>
        )
    }

    // NORMAL MODE: Interactive Card
    return (
        <Card className={cn(
            "h-[500px] w-full bg-card border-border transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 group flex flex-col relative",
            className
        )}>
            <CardHeader className="pb-2">
                <CardTitle className="text-base">{title}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto min-h-0 p-0 relative">
                {hasError || !chart ? (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm bg-card/50 z-10 p-4 text-center">
                        {hasError ? "Unable to render diagram. Please check syntax." : "No diagram available"}
                    </div>
                ) : null}
                <div
                    ref={ref}
                    role="img"
                    aria-label={`Diagram: ${title}`}
                    className={cn(
                        "flex justify-center w-full min-w-max p-4",
                        (hasError || !chart) ? "opacity-0 pointer-events-none" : "opacity-100"
                    )}
                />
            </CardContent>
        </Card>
    )
}
