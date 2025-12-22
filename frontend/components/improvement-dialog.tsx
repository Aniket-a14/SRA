"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { AlertTriangle, Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"

interface ImprovementDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    analysisId: string
    version: number
}

const SECTIONS = [
    { id: "introduction", label: "Introduction" },
    { id: "overallDescription", label: "Overall Description" },
    { id: "systemFeatures", label: "System Features" },
    { id: "externalInterfaceRequirements", label: "External Interfaces" },
    { id: "nonFunctionalRequirements", label: "Non-Functional Reqs" },
    { id: "otherRequirements", label: "Other Requirements" }
]

export function ImprovementDialog({ open, onOpenChange, analysisId, version }: ImprovementDialogProps) {
    const router = useRouter()
    const { token } = useAuth()
    const [selectedSections, setSelectedSections] = useState<string[]>([])
    const [notes, setNotes] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSectionToggle = (sectionId: string) => {
        setSelectedSections(prev =>
            prev.includes(sectionId)
                ? prev.filter(id => id !== sectionId)
                : [...prev, sectionId]
        )
    }

    const handleSubmit = async () => {
        if (!notes.trim()) {
            toast.error("Please provide improvement notes.")
            return
        }

        setIsSubmitting(true)
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze/${analysisId}/regenerate`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    affectedSections: selectedSections,
                    improvementNotes: notes,
                    force: version >= 5 // Auto-force if user persists past warning (implied by clicking submit)
                })
            })

            if (!response.ok) {
                const err = await response.json()
                throw new Error(err.message || "Failed to start regeneration")
            }

            const data = await response.json()
            toast.success("Improvement cycle started!")

            // Poll for completion
            if (data.jobId) {
                pollJob(data.jobId)
            }

        } catch (error) {
            console.error(error)
            toast.error(error instanceof Error ? error.message : "Something went wrong")
            setIsSubmitting(false)
        }
    }

    const pollJob = async (jobId: string) => {
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze/job/${jobId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
                const jobState = await res.json()

                if (jobState.state === "completed") {
                    clearInterval(interval)
                    toast.success("New SRS Verified & Generated!")
                    // result.id is the new analysis ID (assuming worker returns it)
                    // The worker returns 'result' from performAnalysis. 
                    // performAnalysis returns the 'analysis' object.
                    if (jobState.result && jobState.result.id) {
                        // Close dialog first
                        onOpenChange(false)
                        router.push(`/analysis/${jobState.result.id}`)
                    } else {
                        // Fallback
                        window.location.reload()
                    }
                } else if (jobState.state === "failed") {
                    clearInterval(interval)
                    setIsSubmitting(false)
                    toast.error("Regeneration failed: " + (jobState.error || "Unknown error"))
                }
            } catch (e) {
                console.error("Polling error", e)
            }
        }, 2000)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-amber-500" />
                        Layer 4: Refinement Cycle (v{version} → v{version + 1})
                    </DialogTitle>
                    <DialogDescription>
                        Provide specific feedback to refine the analysis. The AI will regenerate the SRS while preserving your valid requirements.
                    </DialogDescription>
                </DialogHeader>

                {version >= 4 && (
                    <div className="bg-yellow-500/10 text-yellow-500 p-3 rounded-md flex items-start gap-2 text-sm">
                        <AlertTriangle className="h-4 w-4 mt-0.5" />
                        <span>
                            Warning: You are approaching the regeneration cap (5 versions).
                            Further improvements may deliver diminishing returns.
                        </span>
                    </div>
                )}

                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label>Refinement Scope (Where to focus)</Label>
                        <div className="grid grid-cols-2 gap-2">
                            {SECTIONS.map((section) => (
                                <div key={section.id} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={section.id}
                                        checked={selectedSections.includes(section.id)}
                                        onCheckedChange={() => handleSectionToggle(section.id)}
                                    />
                                    <Label htmlFor={section.id} className="text-sm font-normal cursor-pointer">
                                        {section.label}
                                    </Label>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Improvement Notes <span className="text-destructive">*</span></Label>
                        <Textarea
                            id="notes"
                            placeholder="Describe what needs to be changed and why..."
                            className="min-h-[100px]"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Regenerating...
                            </>
                        ) : (
                            "Improve & Regenerate"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
