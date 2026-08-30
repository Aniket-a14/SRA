"use client"

import * as React from "react"
import { Check, Copy, Terminal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface TabOption {
    label: string
    language: string
    code: string
}

interface DocsCodeBlockProps {
    language?: string
    code?: string
    tabs?: TabOption[]
    title?: string
    className?: string
}

export function DocsCodeBlock({
    language = "bash",
    code = "",
    tabs,
    title,
    className
}: DocsCodeBlockProps) {
    const [activeTab, setActiveTab] = React.useState(0)
    const [copied, setCopied] = React.useState(false)

    const currentCode = tabs && tabs.length > 0 ? tabs[activeTab].code : code
    const currentLang = tabs && tabs.length > 0 ? tabs[activeTab].language : language

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(currentCode)
            setCopied(true)
            toast.success("Copied to clipboard")
            setTimeout(() => setCopied(false), 2000)
        } catch {
            toast.error("Failed to copy code")
        }
    }

    return (
        <div className={cn("my-5 border border-foreground/10 bg-background overflow-hidden", className)}>
            {/* Header / Tabs */}
            <div className="flex items-center justify-between px-3.5 py-2 border-b border-foreground/10 bg-muted/10 text-xs">
                <div className="flex items-center gap-2 overflow-x-auto">
                    {tabs && tabs.length > 1 ? (
                        <div className="flex items-center gap-1">
                            {tabs.map((tab, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => setActiveTab(idx)}
                                    className={cn(
                                        "px-2.5 py-1 font-mono text-[11px] transition-colors",
                                        activeTab === idx
                                            ? "bg-foreground text-background font-medium"
                                            : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                                    )}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                            <Terminal className="h-3.5 w-3.5 text-primary" />
                            <span>{title || currentLang}</span>
                        </div>
                    )}
                </div>

                <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                    onClick={handleCopy}
                    aria-label="Copy code"
                >
                    {copied ? (
                        <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            <span className="text-[11px] text-emerald-600 font-mono">Copied</span>
                        </>
                    ) : (
                        <>
                            <Copy className="h-3.5 w-3.5" />
                            <span className="text-[11px] font-mono">Copy</span>
                        </>
                    )}
                </Button>
            </div>

            {/* Code View */}
            <div className="p-4 overflow-x-auto text-xs font-mono leading-relaxed bg-muted/5">
                <pre className="text-foreground whitespace-pre">
                    <code>{currentCode}</code>
                </pre>
            </div>
        </div>
    )
}
