"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { MermaidRenderer } from "@/components/mermaid-renderer"
import { Edit2, Save, X, ExternalLink } from "lucide-react"
import { toast } from "sonner"

interface DiagramEditorProps {
    title: string
    initialCode: string
    onSave: (newCode: string) => Promise<void>
}

export function DiagramEditor({ title, initialCode, onSave }: DiagramEditorProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [code, setCode] = useState(initialCode)
    const [isSaving, setIsSaving] = useState(false)

    // Sync if prop changes externally
    useEffect(() => {
        setCode(initialCode)
    }, [initialCode])

    const handleSave = async () => {
        setIsSaving(true)
        try {
            await onSave(code)
            setIsEditing(false)
            toast.success("Diagram saved successfully")
        } catch (error) {
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

    if (!isEditing) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">{title}</h3>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={openLiveEditor}>
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Mermaid Live
                        </Button>
                        <Button size="sm" onClick={() => setIsEditing(true)}>
                            <Edit2 className="mr-2 h-4 w-4" />
                            Edit Diagram
                        </Button>
                    </div>
                </div>
                <MermaidRenderer chart={code} title={title} />
            </div>
        )
    }

    return (
        <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle>{title} - Editor</CardTitle>
                <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setIsEditing(false); setCode(initialCode); }}>
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={isSaving}>
                        <Save className="h-4 w-4 mr-2" />
                        {isSaving ? "Saving..." : "Save Changes"}
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[500px]">
                    <div className="h-full">
                        <Textarea
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            className="font-mono text-xs h-full resize-none p-4"
                            placeholder="Enter Mermaid syntax here..."
                        />
                    </div>
                    <div className="h-full border rounded-md overflow-hidden bg-white/50 dark:bg-black/20 p-4">
                        <div className="h-full overflow-auto flex items-center justify-center">
                            <MermaidRenderer chart={code} title={`${title} (Preview)`} />
                        </div>
                    </div>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                    Tip: Use the text editor to modify the diagram structure. Changes are reflected in the preview.
                </div>
            </CardContent>
        </Card>
    )
}
