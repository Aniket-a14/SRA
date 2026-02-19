"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MermaidRenderer } from "@/components/mermaid-renderer"
import { Edit2, Save, ExternalLink, Loader2, Sparkles, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
import { throttle } from "@/lib/utils"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"

interface DiagramEditorProps {
    title: string
    initialCode: string
    syntaxExplanation?: string
    onSave: (newCode: string, options?: { inPlace?: boolean }) => Promise<void>
    onOpenChange?: (isOpen: boolean) => void
}

export function DiagramEditor({ title, initialCode, syntaxExplanation, onSave, onOpenChange }: DiagramEditorProps) {
    const [open, setOpen] = useState(false)
    const [code, setCode] = useState(initialCode)
    const [isSaving, setIsSaving] = useState(false)
    const [lastError, setLastError] = useState<string | null>(null)
    const [isRepairing, setIsRepairing] = useState(false)
    const [failedCodes, setFailedCodes] = useState<Set<string>>(new Set())
    const { token } = useAuth()

    // Sync if prop changes externally
    useEffect(() => {
        setCode(initialCode)
    }, [initialCode])

    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen)
        onOpenChange?.(newOpen)
    }

    const handleSave = throttle(async () => {
        setIsSaving(true)
        try {
            await onSave(code)
            setOpen(false)
            onOpenChange?.(false)
            toast.success("Diagram saved successfully")
        } catch {
            toast.error("Failed to save diagram")
        } finally {
            setIsSaving(false)
        }
    }, 2000)

    const openLiveEditor = () => {
        const state = {
            code: code,
            mermaid: { theme: 'default' },
            autoSync: true,
            updateDiagram: true
        }
        const json = JSON.stringify(state)
        // Browser-safe base64 encoding for UTF-8 strings
        const data = window.btoa(encodeURIComponent(json).replace(/%([0-9A-F]{2})/g,
            function toSolidBytes(match, p1) {
                return String.fromCharCode(parseInt(p1, 16));
            }))
        window.open(`https://mermaid.live/edit#base64:${data}`, '_blank')
    }

    const repairWithAI = useMemo(() => throttle(async () => {
        if (!lastError) return

        setIsRepairing(true)
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze/repair-diagram`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    code: code,
                    error: lastError,
                    syntaxExplanation: syntaxExplanation
                })
            })

            if (!res.ok) throw new Error("Repair failed")

            const data = await res.json()
            if (data.code && data.code !== code) {
                const repairedCode = data.code
                // Mark the old code as failed so we don't try it again
                setFailedCodes(prev => new Set(prev).add(code))

                setCode(repairedCode)
                setLastError(null)

                toast.success("Intelligent repair successful", { id: "repair-status" })
                try {
                    await onSave(repairedCode, { inPlace: true })
                    toast.success("Diagram fixed and saved", { id: "repair-status" })
                } catch (saveErr) {
                    console.error("Auto-save failed:", saveErr)
                    toast.error("Fixed locally, but failed to save.", { id: "repair-status" })
                }
            } else {
                // If the AI returned the same code, it means it couldn't fix it.
                setFailedCodes(prev => new Set(prev).add(code))
                toast.error("AI couldn't repair this diagram automatically")
            }
        } catch (error) {
            console.error(error)
            setFailedCodes(prev => new Set(prev).add(code))
            toast.error("Failed to repair diagram")
        } finally {
            setIsRepairing(false)
        }
    }, 3000), [code, lastError, token, onSave, syntaxExplanation])

    const [repairAttempts, setRepairAttempts] = useState(0)

    // Reset attempts when a new diagram is loaded
    useEffect(() => {
        setRepairAttempts(0)
        setFailedCodes(new Set())
    }, [initialCode])

    // Optimized Automatic Repair: Attempt to fix errors up to 3 times
    useEffect(() => {
        if (lastError && !isRepairing && !failedCodes.has(code) && repairAttempts < 3) {
            console.log(`Auto-repairing diagram error (Attempt ${repairAttempts + 1}/3)...`)
            setRepairAttempts(prev => prev + 1)
            repairWithAI()
        } else if (lastError && failedCodes.has(code)) {
            // Standard loop prevention logging
            console.warn("Skipping repair for failed code.")
        }
    }, [lastError, code, isRepairing, failedCodes, repairWithAI, repairAttempts])

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">{title}</h3>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={openLiveEditor}>
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Mermaid Live
                        </Button>
                        <Sheet open={open} onOpenChange={handleOpenChange}>
                            <SheetTrigger asChild>
                                <Button size="sm">
                                    <Edit2 className="mr-2 h-4 w-4" />
                                    Edit Diagram
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="right" className="w-full sm:max-w-4xl sm:w-[80vw] flex flex-col h-full p-0">
                                <div className="p-6 pb-0">
                                    <SheetHeader className="mb-4">
                                        <SheetTitle>Edit {title}</SheetTitle>
                                        <SheetDescription>
                                            Modify the Mermaid diagram code below. Changes are reflected in the preview.
                                        </SheetDescription>
                                    </SheetHeader>
                                    {syntaxExplanation && (
                                        <div className="mb-4 p-4 border rounded-md bg-muted/50 text-sm font-mono whitespace-pre-wrap">
                                            <p className="font-bold mb-2">DIAGRAM SYNTAX AUTHORITY SPECIFICATION:</p>
                                            {syntaxExplanation}
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 overflow-y-auto p-6 pt-0">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full min-h-[500px]">
                                        <div className="h-full flex flex-col gap-2">
                                            <h4 className="font-medium text-sm">Mermaid Code</h4>
                                            <Textarea
                                                value={code}
                                                onChange={(e) => setCode(e.target.value)}
                                                className="font-mono text-sm h-full resize-none p-4 leading-relaxed flex-1"
                                                placeholder="Enter Mermaid syntax here..."
                                            />
                                        </div>
                                        <div className="h-full flex flex-col gap-2">
                                            <div className="flex items-center justify-between">
                                                <h4 className="font-medium text-sm">Live Preview</h4>
                                                {lastError && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => repairWithAI()}
                                                        disabled={isRepairing}
                                                        className="h-6 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                                    >
                                                        {isRepairing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                                                        Auto-Fix with AI
                                                    </Button>
                                                )}
                                            </div>
                                            <div className="h-full border rounded-md overflow-hidden bg-white/50 dark:bg-black/20 p-4 relative flex-1 flex flex-col">
                                                <div className="flex-1 overflow-auto flex items-center justify-center p-4 min-h-0">
                                                    <MermaidRenderer
                                                        chart={code}
                                                        title={`${title} (Preview)`}
                                                        className="h-full shadow-none border-0"
                                                        onError={(err) => setLastError(err)}
                                                    />
                                                </div>

                                                {/* Explicit Error Display */}
                                                {lastError && (
                                                    <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded text-xs text-red-600 dark:text-red-400 font-mono overflow-auto max-h-[100px] flex gap-2">
                                                        <AlertTriangle className="h-4 w-4 shrink-0" />
                                                        <div className="flex-1">
                                                            <p className="font-bold mb-1">Syntax Error:</p>
                                                            {lastError}
                                                        </div>
                                                    </div>
                                                )}

                                                {isRepairing && (
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/80 z-20 backdrop-blur-sm transition-all duration-300">
                                                        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                                                        <p className="text-sm font-medium animate-pulse">Intelligent Repair in Progress...</p>
                                                        <p className="text-xs text-muted-foreground mt-1">Applying Diagram Authority Rules</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 border-t mt-auto bg-background z-10 flex justify-end gap-2">
                                    <Button variant="outline" onClick={() => { handleOpenChange(false); setCode(initialCode); }}>
                                        Cancel
                                    </Button>
                                    <Button onClick={handleSave} disabled={isSaving}>
                                        <Save className="h-4 w-4 mr-2" />
                                        {isSaving ? "Saving..." : "Save Changes"}
                                    </Button>
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>
                </div>
            </div>

            {/* Read-only view in the main flow */}
            <div className="flex-1 min-h-[300px] overflow-auto relative">
                <MermaidRenderer
                    key={initialCode.length}
                    chart={initialCode}
                    title={title}
                    onError={(err) => setLastError(err)}
                />
                {isRepairing && !open && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/80 z-20 backdrop-blur-sm transition-all duration-300">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                        <p className="text-sm font-medium animate-pulse">Repairing Syntax...</p>
                    </div>
                )}
            </div>
        </div>
    )
}
