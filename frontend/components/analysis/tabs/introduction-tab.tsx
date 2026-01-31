"use client"

import React, { memo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, Bug } from "lucide-react"
import { KVDisplay } from "@/components/kv-display"
import type { AnalysisResult } from "@/types/analysis"

interface IntroductionTabProps {
    introduction: AnalysisResult["introduction"]
    overallDescription: AnalysisResult["overallDescription"]
    missingLogic?: string[]
    contradictions?: string[]
    isEditing: boolean
    onUpdate: (section: keyof AnalysisResult, value: unknown) => void
}

export const IntroductionTab = memo(function IntroductionTab({
    introduction,
    overallDescription,
    missingLogic,
    contradictions,
    isEditing,
    onUpdate,
}: IntroductionTabProps) {
    return (
        <div className="space-y-8 animate-fade-in outline-none">
            <div className="grid gap-8 lg:grid-cols-2">
                <KVDisplay
                    title="1. Introduction"
                    data={introduction as unknown as Record<string, unknown>}
                    isEditing={isEditing}
                    onUpdate={(val) => onUpdate('introduction', val)}
                />
                <KVDisplay
                    title="2. Overall Description"
                    data={overallDescription as unknown as Record<string, unknown>}
                    isEditing={isEditing}
                    onUpdate={(val) => onUpdate('overallDescription', val)}
                />
            </div>

            {/* Issues / Contradictions (Global) */}
            {((missingLogic && missingLogic.length > 0) || (contradictions && contradictions.length > 0)) && (
                <div className="grid gap-6 md:grid-cols-2">
                    {missingLogic && missingLogic.length > 0 && (
                        <Card className="bg-amber-500/5 border-amber-500/20">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-amber-500 text-lg">
                                    <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                                    Missing Logic
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="list-disc list-inside space-y-2">
                                    {missingLogic.map((item, i) => (
                                        <li key={i} className="text-sm text-foreground/80">{item}</li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    )}
                    {contradictions && contradictions.length > 0 && (
                        <Card className="bg-destructive/5 border-destructive/20">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-destructive text-lg">
                                    <Bug className="h-5 w-5" aria-hidden="true" />
                                    Contradictions Found
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="list-disc list-inside space-y-2">
                                    {contradictions.map((item, i) => (
                                        <li key={i} className="text-sm text-foreground/80">{item}</li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}
        </div>
    )
})
