"use client"

import React, { memo } from "react"
import { FeatureDisplay } from "@/components/feature-display"
import type { AnalysisResult } from "@/types/analysis"

interface FeaturesTabProps {
    systemFeatures: AnalysisResult["systemFeatures"]
    projectTitle?: string
    isEditing: boolean
    onUpdate: (section: keyof AnalysisResult, value: unknown) => void
}

export const FeaturesTab = memo(function FeaturesTab({
    systemFeatures,
    projectTitle,
    isEditing,
    onUpdate,
}: FeaturesTabProps) {
    return (
        <div className="space-y-6 outline-none">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-semibold">3. System Features</h3>
            </div>
            <FeatureDisplay
                features={systemFeatures}
                projectTitle={projectTitle}
                isEditing={isEditing}
                onUpdate={(val) => onUpdate('systemFeatures', val)}
            />
        </div>
    )
})
