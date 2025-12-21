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
}

interface MermaidInstance {
    render: (id: string, text: string) => Promise<{ svg: string }>
}

export function MermaidRenderer({ chart, title, className }: MermaidRendererProps) {
    const ref = useRef<HTMLDivElement>(null)
    const [mermaidInstance, setMermaidInstance] = useState<MermaidInstance | null>(null)
    const [hasError, setHasError] = useState(false)

    useEffect(() => {
        import("mermaid").then((m) => {
            m.default.initialize({
                startOnLoad: false,
                theme: 'default',
                securityLevel: 'loose',
                fontFamily: 'inherit',
            })
            setMermaidInstance(m.default)
        })
    }, [])

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
                const { svg } = await mermaidInstance.render(id, formatted)

                if (ref.current) {
                    ref.current.innerHTML = svg
                }
            } catch (err) {
                console.error("Mermaid render error:", err)
                setHasError(true)
            }
        }

        renderDiagram()
    }, [chart, mermaidInstance, title])

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
                    className={cn(
                        "flex justify-center w-full min-w-max p-4",
                        (hasError || !chart) ? "opacity-0 pointer-events-none" : "opacity-100"
                    )}
                />
            </CardContent>
        </Card>
    )
}
