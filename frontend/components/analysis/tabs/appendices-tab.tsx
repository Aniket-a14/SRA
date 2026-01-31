"use client"

import React, { memo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"
import dynamic from "next/dynamic"
import { DFDDiagramSection } from "@/components/analysis/dfd-diagram-section"
import { useAuthFetch } from "@/lib/hooks"
import { useRouter } from "next/navigation"
import type { AnalysisResult, Diagram } from "@/types/analysis"

const DiagramEditor = dynamic(() => import("@/components/diagram-editor").then(mod => mod.DiagramEditor), {
    loading: () => <div className="h-[400px] w-full bg-muted/20 animate-pulse rounded-lg" />,
    ssr: false
})

interface AppendicesTabProps {
    appendices: AnalysisResult["appendices"]
    glossary: AnalysisResult["glossary"]
    analysisId: string
    projectTitle?: string
    productScope?: string
    srsContent: string
    onRefresh?: () => void
    onDiagramEditChange?: (isEditing: boolean) => void
}

export const AppendicesTab = memo(function AppendicesTab({
    appendices,
    glossary,
    analysisId,
    projectTitle,
    productScope,
    srsContent,
    onRefresh,
    onDiagramEditChange,
}: AppendicesTabProps) {
    const authFetch = useAuthFetch();
    const router = useRouter();

    const handleDiagramSave = async (diagramType: string, newCode: string, options?: { inPlace?: boolean }) => {
        try {
            const isInPlace = !!options?.inPlace;
            const res = await authFetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze/${analysisId}`, {
                method: "PUT",
                body: JSON.stringify({
                    appendices: {
                        ...appendices,
                        analysisModels: {
                            ...appendices?.analysisModels,
                            [diagramType]: newCode
                        }
                    },
                    skipAlignment: true,
                    inPlace: isInPlace
                })
            });

            if (!res.ok) throw new Error("Failed to save diagram")

            const json = await res.json()
            const updated = json.data || json

            if (!isInPlace && updated.id && updated.id !== analysisId) {
                toast.success("New version created")
                router.push(`/analysis/${updated.id}`)
            } else {
                toast.success(isInPlace ? "Diagram fixed" : "Saved")
                onRefresh?.()
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to save diagram")
        }
    }

    return (
        <div className="space-y-8 animate-fade-in outline-none">
            {/* Diagrams */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold border-l-4 border-primary pl-3">Analysis Models</h3>
                <div className="grid lg:grid-cols-2 gap-6">
                    <DiagramEditor
                        title="Flowchart"
                        initialCode={typeof appendices?.analysisModels?.flowchartDiagram === 'string'
                            ? appendices.analysisModels.flowchartDiagram
                            : appendices?.analysisModels?.flowchartDiagram?.code || ""}
                        onSave={(newCode, options) => handleDiagramSave('flowchartDiagram', newCode, options)}
                        onOpenChange={onDiagramEditChange}
                    />
                    <DiagramEditor
                        title="Sequence Diagram"
                        initialCode={typeof appendices?.analysisModels?.sequenceDiagram === 'string'
                            ? appendices.analysisModels.sequenceDiagram
                            : appendices?.analysisModels?.sequenceDiagram?.code || ""}
                        onSave={(newCode, options) => handleDiagramSave('sequenceDiagram', newCode, options)}
                        onOpenChange={onDiagramEditChange}
                    />
                </div>

                {/* DFD Section */}
                <div className="mt-6">
                    <DFDDiagramSection
                        data={appendices?.analysisModels?.dataFlowDiagram}
                        projectTitle={projectTitle || ""}
                        description={productScope || ""}
                        srsContent={srsContent}
                        onUpdate={async (newDfdInput) => {
                            const newDFD = {
                                ...(typeof appendices?.analysisModels?.dataFlowDiagram === 'object' ? appendices.analysisModels.dataFlowDiagram : {}),
                                ...newDfdInput,
                                caption: "Data Flow Diagram"
                            };

                            try {
                                const res = await authFetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze/${analysisId}`, {
                                    method: "PUT",
                                    body: JSON.stringify({
                                        appendices: {
                                            ...appendices,
                                            analysisModels: {
                                                ...appendices?.analysisModels,
                                                dataFlowDiagram: newDFD
                                            }
                                        },
                                        skipAlignment: true,
                                        inPlace: true
                                    })
                                })
                                if (res.ok) {
                                    onRefresh?.();
                                } else {
                                    toast.error("Failed to save generated DFD");
                                }
                            } catch (e) {
                                console.error(e);
                                toast.error("Failed to save generated DFD");
                            }
                        }}
                    />
                </div>

                <div className="grid lg:grid-cols-2 gap-6 mt-6">
                    <DiagramEditor
                        title="Entity Relationship Diagram"
                        initialCode={typeof appendices?.analysisModels?.entityRelationshipDiagram === 'string'
                            ? appendices.analysisModels.entityRelationshipDiagram
                            : appendices?.analysisModels?.entityRelationshipDiagram?.code || ""}
                        syntaxExplanation={typeof appendices?.analysisModels?.entityRelationshipDiagram === 'object' && appendices.analysisModels.entityRelationshipDiagram !== null ? (appendices.analysisModels.entityRelationshipDiagram as Diagram).syntaxExplanation : undefined}
                        onSave={(newCode, options) => handleDiagramSave('entityRelationshipDiagram', newCode, options)}
                        onOpenChange={onDiagramEditChange}
                    />
                </div>
            </div>

            {/* Glossary */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold border-l-4 border-primary pl-3">Glossary</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {glossary && glossary.length > 0 ? (
                        glossary.map((term, i) => (
                            <Card key={i} className="bg-card">
                                <CardContent className="pt-4">
                                    <dt className="font-semibold text-primary mb-1">{term.term}</dt>
                                    <dd className="text-sm text-muted-foreground">{term.definition}</dd>
                                </CardContent>
                            </Card>
                        ))
                    ) : (
                        <p className="text-muted-foreground text-sm col-span-full">No glossary terms found.</p>
                    )}
                </div>
            </div>

            {/* TBD List */}
            {appendices?.tbdList && appendices.tbdList.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold border-l-4 border-primary pl-3">To Be Determined (TBD)</h3>
                    <Card>
                        <CardContent className="pt-4">
                            <ul className="list-disc list-inside space-y-2">
                                {appendices.tbdList.map((item, i) => (
                                    <li key={i} className="text-sm text-muted-foreground">{item}</li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
})
