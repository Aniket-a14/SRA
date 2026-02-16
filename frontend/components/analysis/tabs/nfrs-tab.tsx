"use client"

import React, { memo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { KVDisplay } from "@/components/kv-display"
import { EditableSection } from "@/components/editable-section"
import { MarkdownDisplay } from "@/components/markdown-display"
import { getAcronym } from "@/lib/utils"
import type { AnalysisResult } from "@/types/analysis"

interface NFRsTabProps {
    nonFunctionalRequirements: AnalysisResult["nonFunctionalRequirements"]
    otherRequirements?: string[]
    projectTitle?: string
    isEditing: boolean
    onUpdate: (section: keyof AnalysisResult, value: unknown) => void
}

export const NFRsTab = memo(function NFRsTab({
    nonFunctionalRequirements,
    otherRequirements,
    projectTitle,
    isEditing,
    onUpdate,
}: NFRsTabProps) {
    const acronym = getAcronym(projectTitle || "SRA");

    return (
        <div className="space-y-6 outline-none">
            <KVDisplay
                title="Non-Functional Requirements"
                data={nonFunctionalRequirements as unknown as Record<string, unknown>}
                projectTitle={projectTitle}
                isEditing={isEditing}
                onUpdate={(val) => onUpdate('nonFunctionalRequirements', val)}
            />

            {isEditing ? (
                <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-4">Other Requirements</h3>
                    <EditableSection
                        items={otherRequirements || []}
                        isEditing={true}
                        onUpdate={(val: string[]) => onUpdate('otherRequirements', val)}
                        prefix={`${acronym}-OR`}
                    />
                </div>
            ) : (
                otherRequirements && otherRequirements.length > 0 && (
                    <Card className="bg-card border-border mt-6">
                        <CardHeader>
                            <CardTitle>Other Requirements</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-2">
                                {otherRequirements.map((req, i) => {
                                    const cleanReq = req.replace(/^[A-Z]+-[A-Z]+-\d+\s*:?\s*/, '').trim();
                                    const finalItem = cleanReq.replace(/^\s*(?:[\-\•\d\.\)]+\s*|\*(?!\*)\s*)/, '').trim();

                                    // Apply the robust logic from KVDisplay to fix bolding issues
                                    let work = finalItem;
                                    work = work.replace(/^\*\*([\s\S]*?):\*\*/, '$1:');
                                    work = work.replace(/^\*\*([\s\S]*?)\*\*:/, '$1:');
                                    work = work.replace(/^\*\*([\s\S]*?):/, '$1:');

                                    if (work.startsWith('**') && work.endsWith('**') && work.includes(':')) {
                                        work = work.substring(2, work.length - 2);
                                    }

                                    const separatorIndex = work.indexOf(':');
                                    let titlePart = "";
                                    let descPart = work;

                                    if (separatorIndex !== -1) {
                                        titlePart = work.substring(0, separatorIndex).trim();
                                        descPart = work.substring(separatorIndex + 1).trim();
                                        titlePart = titlePart.replace(/^[\s*]+|[\s*]+$/g, '');
                                        descPart = descPart.replace(/^\*\*([\s\S]*?)\*\*/, '$1');
                                        if (descPart.startsWith('**')) {
                                            descPart = descPart.substring(2);
                                        }
                                    }

                                    return (
                                        <div key={i} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
                                            <Badge variant="outline" className="shrink-0 mt-0.5 text-xs text-muted-foreground bg-muted/20 border-muted-foreground/20">
                                                {acronym}-OR-{i + 1}
                                            </Badge>
                                            <span className="text-sm text-muted-foreground leading-relaxed w-full">
                                                {titlePart ? (
                                                    <>
                                                        <strong className="font-semibold text-foreground">{titlePart}</strong>: <MarkdownDisplay content={descPart} className="inline ml-1" />
                                                    </>
                                                ) : (
                                                    <MarkdownDisplay content={finalItem} />
                                                )}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                )
            )}
        </div>
    )
})
