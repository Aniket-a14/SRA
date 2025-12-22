"use client"

import { Check, Clock, ShieldCheck, Database } from "lucide-react"
import { cn } from "@/lib/utils"

interface WorkflowPhasesProps {
    status: 'draft' | 'verified' | 'finalized'
    qualityScore?: number
}

export function WorkflowPhases({ status }: WorkflowPhasesProps) {
    const steps = [
        {
            id: 'draft',
            label: 'Initial Draft',
            icon: Clock,
            description: 'AI Generation'
        },
        {
            id: 'verified',
            label: 'Verified',
            icon: ShieldCheck,
            description: 'Validation Passed',
            color: 'text-blue-500'
        },
        {
            id: 'finalized',
            label: 'Finalized',
            icon: Database, // Use Database icon to signify Layer 5 KB
            description: 'Added to Knowledge Base',
            color: 'text-green-500'
        }
    ]

    // Determine current index
    const statusMap = { 'draft': 0, 'verified': 1, 'finalized': 2 }
    const currentIndex = statusMap[status]

    return (
        <div className="w-full bg-card border-b">
            <div className="container mx-auto px-4 py-4">
                <div className="flex items-center justify-between max-w-3xl mx-auto relative">
                    {/* Connecting Line */}
                    <div className="absolute left-0 top-1/2 w-full h-0.5 bg-muted -z-10" />
                    <div
                        className="absolute left-0 top-1/2 h-0.5 bg-primary -z-10 transition-all duration-500"
                        style={{ width: `${(currentIndex / (steps.length - 1)) * 100}%` }}
                    />

                    {steps.map((step, index) => {
                        const isCompleted = index <= currentIndex
                        const isActive = index === currentIndex
                        const Icon = step.icon

                        return (
                            <div key={step.id} className="flex flex-col items-center bg-card px-2">
                                <div className={cn(
                                    "h-10 w-10 rounded-full border-2 flex items-center justify-center transition-all bg-card",
                                    isActive ? "border-primary text-primary scale-110 shadow-lg shadow-primary/20" :
                                        isCompleted ? "border-primary bg-primary text-primary-foreground" : "border-muted text-muted-foreground"
                                )}>
                                    {isCompleted && !isActive ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                                </div>
                                <div className="mt-2 text-center">
                                    <p className={cn(
                                        "text-sm font-medium",
                                        isActive ? "text-foreground" : isCompleted ? "text-foreground/80" : "text-muted-foreground"
                                    )}>
                                        {step.label}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground hidden sm:block">
                                        {step.description}
                                    </p>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
