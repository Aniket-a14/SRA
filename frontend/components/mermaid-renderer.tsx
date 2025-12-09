"use client"


import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface MermaidRendererProps {
    chart: string
    title: string
}

interface MermaidInstance {
    render: (id: string, text: string) => Promise<{ svg: string }>
}

export function MermaidRenderer({ chart, title }: MermaidRendererProps) {
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

        // Clean the string:
        // 1. Replace escaped newlines
        // 2. Remove any non-printable characters (except newlines and tabs)
        // 3. Trim whitespace
        const formatted = chart
            .replace(/\\n/g, "\n")
            .replace(/[^\x20-\x7E\n\t]/g, "")
            .trim()

        console.log(`Rendering ${title}:`, formatted)

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

    if (!chart || hasError) {
        return (
            <Card className="h-[500px] bg-card border-border transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 group flex flex-col">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">{title}</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex items-center justify-center min-h-0 text-muted-foreground text-sm">
                    {hasError ? "Unable to render diagram" : "No diagram available"}
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="h-[500px] bg-card border-border transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 group flex flex-col">
            <CardHeader className="pb-2">
                <CardTitle className="text-base">{title}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto min-h-0 p-0">
                <div ref={ref} className="flex justify-center w-full min-w-max p-4" />
            </CardContent>
        </Card>
    )
}
