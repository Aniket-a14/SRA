"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MermaidRenderer } from "@/components/mermaid-renderer"
import { Edit2, Save, ExternalLink } from "lucide-react"
import { toast } from "sonner"
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
    onSave: (newCode: string) => Promise<void>
    onOpenChange?: (isOpen: boolean) => void
}

export function DiagramEditor({ title, initialCode, onSave, onOpenChange }: DiagramEditorProps) {
    const [open, setOpen] = useState(false)
    const [code, setCode] = useState(initialCode)
    const [isSaving, setIsSaving] = useState(false)

    // Sync if prop changes externally
    useEffect(() => {
        setCode(initialCode)
    }, [initialCode])

    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen)
        onOpenChange?.(newOpen)
    }

    const handleSave = async () => {
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
    }

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

    return (
        <div className="space-y-4 h-full flex flex-col">
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
                                        <h4 className="font-medium text-sm">Live Preview</h4>
                                        <div className="h-full border rounded-md overflow-hidden bg-white/50 dark:bg-black/20 p-4 relative flex-1">
                                            <div className="absolute inset-0 overflow-auto flex items-center justify-center p-4">
                                                <MermaidRenderer chart={code} title={`${title} (Preview)`} />
                                            </div>
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

            {/* Read-only view in the main flow */}
            <div className="border rounded-lg p-4 bg-card flex-1 min-h-[300px] flex items-center justify-center overflow-auto">
                <MermaidRenderer chart={initialCode} title={title} />
            </div>
        </div>
    )
}
