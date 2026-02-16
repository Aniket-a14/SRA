"use client"

import React, { memo } from "react"
import { KVDisplay } from "@/components/kv-display"
import type { AnalysisResult } from "@/types/analysis"

interface InterfacesTabProps {
    externalInterfaceRequirements: AnalysisResult["externalInterfaceRequirements"]
    isEditing: boolean
    onUpdate: (section: keyof AnalysisResult, value: unknown) => void
}

export const InterfacesTab = memo(function InterfacesTab({
    externalInterfaceRequirements,
    isEditing,
    onUpdate,
}: InterfacesTabProps) {
    return (
        <div className="space-y-6 outline-none">
            <KVDisplay
                title="External Interface Requirements"
                data={externalInterfaceRequirements as unknown as Record<string, unknown>}
                isEditing={isEditing}
                onUpdate={(val) => onUpdate('externalInterfaceRequirements', val)}
            />
        </div>
    )
})
