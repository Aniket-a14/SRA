"use client"

import React, { memo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ShieldCheck, AlertTriangle, CheckCircle2 } from "lucide-react"
import type { AnalysisResult } from "@/types/analysis"

interface QualityAuditTabProps {
    qualityAudit: AnalysisResult["qualityAudit"]
}

export const QualityAuditTab = memo(function QualityAuditTab({
    qualityAudit
}: QualityAuditTabProps) {
    if (!qualityAudit) {
        return (
            <div className="text-center p-8 text-muted-foreground">
                No quality audit data available for this analysis.
            </div>
        )
    }

    const getQualityColor = (score: number) => {
        if (score >= 80) return "text-green-500"
        if (score >= 50) return "text-amber-500"
        return "text-destructive"
    }

    const getQualityIndicator = (score: number) => {
        if (score >= 80) return "bg-green-500"
        if (score >= 50) return "bg-amber-500"
        return "bg-destructive"
    }

    return (
        <div className="outline-none">
            <Card className="bg-card border-border">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <ShieldCheck className="h-5 w-5 text-primary" />
                        Requirements Quality Score: {qualityAudit.score}/100
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span>Quality Check</span>
                            <span className={getQualityColor(qualityAudit.score)}>
                                {qualityAudit.score >= 80 ? "Excellent" : qualityAudit.score >= 50 ? "Needs Improvement" : "Poor"}
                            </span>
                        </div>
                        <Progress
                            value={qualityAudit.score}
                            className="bg-secondary"
                            indicatorClassName={getQualityIndicator(qualityAudit.score)}
                        />
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-semibold text-sm">Identified Issues</h4>
                        {qualityAudit.issues && qualityAudit.issues.length > 0 ? (
                            <ul className="space-y-3">
                                {qualityAudit.issues.map((issue, index) => (
                                    <li key={index} className="flex items-start gap-3 text-sm bg-muted/30 p-3 rounded-md border border-border/50">
                                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                        <span>{issue}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="flex items-center gap-2 text-green-500 text-sm p-4 bg-green-500/10 rounded-md">
                                <CheckCircle2 className="h-4 w-4" />
                                No issues found. Great job!
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
})
