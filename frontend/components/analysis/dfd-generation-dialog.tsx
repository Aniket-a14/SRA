"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Loader2, Network } from "lucide-react"
import { toast } from "sonner"
import { generateDFD } from "@/lib/analysis-api"
import { useAuth } from "@/lib/auth-context"
import DFDViewer, { DFDInput } from "@/components/DFDViewer"

interface BaseDFDGenerationDialogProps {
    projectName: string
    description: string
    srsContent?: string
    trigger?: React.ReactElement | null
}

interface ControlledDFDGenerationDialogProps extends BaseDFDGenerationDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

interface UncontrolledDFDGenerationDialogProps extends BaseDFDGenerationDialogProps {
    open?: never
    onOpenChange?: never
}

export type DFDGenerationDialogProps = ControlledDFDGenerationDialogProps | UncontrolledDFDGenerationDialogProps

export function DFDGenerationDialog({
    projectName,
    description,
    srsContent,
    open: controlledOpen,
    onOpenChange: setControlledOpen,
    trigger,
}: DFDGenerationDialogProps) {
    const { token } = useAuth()
    const [internalOpen, setInternalOpen] = useState(false)
    const isControlled = controlledOpen !== undefined
    const isOpen = isControlled ? controlledOpen : internalOpen
    const setIsOpen = (nextOpen: boolean) => {
        if (setControlledOpen) {
            setControlledOpen(nextOpen)
        } else {
            setInternalOpen(nextOpen)
        }
    }

    const [isLoading, setIsLoading] = useState(false)
    const [data, setData] = useState<DFDInput | null>(null)

    const handleGenerate = async () => {
        if (!token) return
        setIsLoading(true)
        try {
            const result = await generateDFD(token, {
                projectName,
                description,
                srsContent
            })
            setData(result)
            toast.success("DFD Generated Successfully")
        } catch (err: unknown) {
            console.error(err)
            const errorMessage = err instanceof Error ? err.message : "Failed to generate DFD";
            toast.error(errorMessage)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            {trigger !== null && (
                <DialogTrigger asChild>
                    {trigger || (
                        <Button variant="outline" className="gap-2">
                            <Network className="h-4 w-4" />
                            Generate DFD (React Flow)
                        </Button>
                    )}
                </DialogTrigger>
            )}
            <DialogContent className="max-w-[90vw] h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Data Flow Diagram (Level 0 & 1)</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-4 bg-muted/10 rounded-md border text-center">
                    {!data && !isLoading && (
                        <div className="flex flex-col items-center justify-center h-full gap-4">
                            <p className="text-muted-foreground">
                                Generate a structured Data Flow Diagram (DFD) for this project using React Flow.
                            </p>
                            <Button onClick={handleGenerate} size="lg">
                                <Network className="h-4 w-4 mr-2" />
                                Start Generation
                            </Button>
                        </div>
                    )}

                    {isLoading && (
                        <div className="flex flex-col items-center justify-center h-full gap-4">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-muted-foreground">Analyzing system flows...</p>
                        </div>
                    )}

                    {data && (
                        <div className="w-full">
                            <DFDViewer data={data} />

                            <div className="mt-4 flex justify-end">
                                <Button variant="ghost" onClick={() => setData(null)}>Reset</Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
