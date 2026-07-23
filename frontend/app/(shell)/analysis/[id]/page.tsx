"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import useSWR from "swr";
import { fetcher, swrOptions } from "@/lib/swr-utils";
import { useAnalysisProgress } from "@/lib/hooks";

import { Button } from "@/components/ui/button"
import { ArrowLeft, Sparkles, Save, MessageSquare, FileText } from "lucide-react"
import { updateAnalysis, runValidation, autoFixIssue, startAnalysis, finalizeAnalysis } from "@/lib/analysis-api"
import type { Analysis, ValidationIssue, StartAnalysisInput } from "@/types/analysis"
import { SRSIntakeModel } from "@/types/srs-intake"
import { cn } from "@/lib/utils"

import { toast } from "sonner"
import { useLayer } from "@/lib/layer-context"
import { AnalysisLoading } from "@/components/analysis/analysis-loading"
import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"
import { AnalysisConversation } from "@/components/analysis/analysis-conversation"
import { DocumentCanvas } from "@/components/analysis/document-canvas"

const ImprovementDialog = dynamic(() => import("@/components/improvement-dialog").then(mod => mod.ImprovementDialog))
const AccordionInput = dynamic(() => import("@/components/analysis/accordion-input").then(mod => mod.AccordionInput))
const ValidationReport = dynamic(() => import("@/components/analysis/validation-report").then(mod => mod.ValidationReport))

export default function AnalysisDetailPage() {
    return <AnalysisDetailContent />
}

function AnalysisDetailContent() {
    const params = useParams()
    const id = params?.id as string
    const router = useRouter()
    const { user, token, isLoading: authLoading } = useAuth()
    const { unlockAndNavigate, unlockLayer, setLayer, setIsFinalized } = useLayer()

    const swrKey = useMemo(() => {
        if (!id || !token || authLoading) return null;
        return [`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze/${id}`, token];
    }, [id, token, authLoading]);

    const { data: analysis, error: swrError, mutate } = useSWR<Analysis>(
        swrKey,
        fetcher,
        {
            ...swrOptions,
            refreshInterval: (latestData) => {
                const status = (latestData?.status || '').toUpperCase();
                const metaStatus = (latestData?.metadata?.status || '').toUpperCase();

                if (status === 'COMPLETED' || status === 'FAILED' || latestData?.isFinalized) {
                    return 0;
                }
                if (metaStatus === 'DRAFT' || metaStatus === 'VALIDATED' || metaStatus === 'NEEDS_FIX') {
                    return 0;
                }
                if (latestData?.resultJson && Object.keys(latestData.resultJson).length > 2 && status !== 'IN_PROGRESS') {
                    return 0;
                }

                return 3000;
            }
        }
    );

    const streamStatus = (analysis?.status || '').toUpperCase();
    const isStreamActive = streamStatus === 'PENDING' || streamStatus === 'IN_PROGRESS' || streamStatus === 'QUEUED';
    const liveProgress = useAnalysisProgress(id || null, isStreamActive, () => { mutate(); });

    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState("")
    const [isDiagramEditing, setIsDiagramEditing] = useState(false)
    const [isImproveDialogOpen, setIsImproveDialogOpen] = useState(false)
    const [view, setView] = useState<'chat' | 'document'>('document')
    const [isFinalizing, setIsFinalizing] = useState(false)
    const [isValidating, setIsValidating] = useState(false)
    const [isProceeding, setIsProceeding] = useState(false)
    const [isFixing, setIsFixing] = useState<string | null>(null);
    const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);

    const [draftData, setDraftData] = useState<SRSIntakeModel | null>(null)

    useEffect(() => {
        if (!analysis) return;

        Promise.resolve().then(() => {
            const currentStatus = (analysis.status || '').toUpperCase();

            if (currentStatus === 'FAILED') {
                const metaStatus = analysis.metadata?.status;
                if (metaStatus === 'DRAFT' && analysis.metadata?.draftData) {
                    setIsLoading(false);
                    setError("");
                    setDraftData((analysis.metadata?.draftData as unknown as SRSIntakeModel) || null);
                    unlockAndNavigate(1);
                    return;
                }
                if (analysis.parentId) {
                    toast.error("Analysis generation failed. Returning to draft.");
                    router.push(`/analysis/${analysis.parentId}`);
                    return;
                }
                const msg = (analysis.resultJson as unknown as Record<string, unknown>)?.error as string || "Analysis generation failed.";
                setError(msg);
                setIsLoading(false);
                return;
            }

            setIsLoading(false);
            setError("");

            const metadataStatus = analysis.metadata?.status;
            if (metadataStatus === 'DRAFT') {
                unlockAndNavigate(1);
                setDraftData((analysis.metadata?.draftData as unknown as SRSIntakeModel) || null);
            } else if (metadataStatus === 'VALIDATING' || metadataStatus === 'VALIDATED' || metadataStatus === 'NEEDS_FIX') {
                unlockAndNavigate(2);
                setDraftData((analysis.metadata?.draftData as unknown as SRSIntakeModel) || null);
                setValidationIssues(prev => {
                    const next = analysis.metadata?.validationResult?.issues || [];
                    return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
                });
            } else {
                if (analysis.isFinalized) {
                    setIsFinalized(true);
                    unlockAndNavigate(5);
                } else {
                    setIsFinalized(false);
                    unlockLayer(5);
                    setLayer(3);
                }
            }
        });
    }, [analysis, unlockAndNavigate, unlockLayer, setLayer, setIsFinalized, router]);

    useEffect(() => {
        if (swrError) {
            Promise.resolve().then(() => {
                setError(swrError.message || "Failed to sync analysis");
                setIsLoading(false);
            });
        }
    }, [swrError]);

    const memoizedOnDiagramEditChange = useCallback((isEditing: boolean) => {
        setIsDiagramEditing(isEditing)
    }, [])

    const memoizedOnRefresh = useCallback(() => {
        mutate();
    }, [mutate])

    useEffect(() => {
        if (authLoading) return
        if (!user || !token) {
            Promise.resolve().then(() => setIsLoading(false));
            router.push("/auth/login")
            return
        }

        if (id === 'undefined') {
            Promise.resolve().then(() => {
                setError("Invalid Analysis ID");
                setIsLoading(false);
            });
        }
    }, [user, token, id, authLoading, router])

    useEffect(() => {
        if (analysis) {
            const s = (analysis.status || '').toUpperCase();
            if (s !== 'PENDING' && s !== 'IN_PROGRESS' && s !== 'QUEUED') {
                Promise.resolve().then(() => setIsLoading(false));
            }
        }
    }, [analysis])

    const handleDraftUpdate = useCallback((section: string, field: string, value: string) => {
        setDraftData((prev: SRSIntakeModel | null) => {
            const newData = (prev ? { ...prev } : {}) as Record<string, Record<string, { content: string }>>;
            const sectionData = newData[section] || {};
            const fieldData = sectionData[field] || { content: "" };

            fieldData.content = value;
            sectionData[field] = fieldData;
            newData[section] = sectionData;

            return newData as unknown as SRSIntakeModel;
        });
    }, []);

    const handleSaveDraft = async () => {
        if (!id || !draftData) return;
        const loadingToast = toast.loading("Saving draft to cloud...");
        try {
            await updateAnalysis(id, token!, {
                metadata: { ...analysis?.metadata, draftData, status: 'DRAFT' }
            });
            toast.success("Draft saved", { id: loadingToast });
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Failed to save draft";
            toast.error(errorMessage, { id: loadingToast });
        }
    }

    const handleRunValidation = async () => {
        setIsValidating(true);
        try {
            await updateAnalysis(id, token!, {
                metadata: { ...analysis?.metadata, draftData, status: 'DRAFT' }
            });

            const response = await runValidation(id, token!);
            const result = response.data;

            if (result.metadata?.validationResult?.validation_status === 'SERVICE_ERROR') {
                const errInfo = result.metadata.validationResult.service_error || {};
                toast.error(errInfo.title || 'AI Service Busy', {
                    description: errInfo.message || 'The AI is currently overloaded. Please try again shortly.',
                    duration: 5000
                });
                mutate(response.data, false);
                return;
            }

            mutate(response.data, false);

            setValidationIssues(result.metadata?.validationResult?.issues || []);
            toast.success("Validation Complete");
        } catch (err: unknown) {
            console.error("Validation failed:", err);
            toast.error("Failed to run validation. Please check your connection and try again.");
        } finally {
            setIsValidating(false);
        }
    }

    const handleAutoFix = async (issueId: string) => {
        if (!token) {
            toast.error("Authentication required");
            return;
        }

        setIsFixing(issueId);
        const loadingToast = toast.loading("AI is repairing your requirement...");

        try {
            const { fixedText } = await autoFixIssue(id, token, issueId);

            const issues: ValidationIssue[] = analysis?.metadata?.validationResult?.issues || [];
            const issue = issues.find(i => i.id === issueId);

            if (issue && issue.section) {
                const section = issue.section.toLowerCase();
                setDraftData(prev => {
                    if (!prev) return prev;
                    const next = { ...prev } as unknown as SRSIntakeModel;

                    if (section.includes('introduction') || section.includes('purpose') || section.includes('description')) {
                        if (next.details?.fullDescription) {
                            next.details.fullDescription.content = fixedText;
                        }
                    }
                    return next;
                });
                toast.success("AI fix applied! You can now review and re-validate.", { id: loadingToast });
            } else {
                toast.info(`AI suggestion: ${fixedText}`, { id: loadingToast, duration: 5000 });
            }
        } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : "Failed to apply auto-fix.";
            toast.error(errorMessage, { id: loadingToast });
        } finally {
            setIsFixing(null);
        }
    }

    const handleProceedToAnalysis = async () => {
        setIsProceeding(true);
        try {
            const result = await startAnalysis(token!, {
                projectId: analysis?.projectId,
                text: "Generated from Draft",
                srsData: draftData as unknown as StartAnalysisInput['srsData'],
                validationResult: { validation_status: 'PASS', issues: validationIssues },
                parentId: id,
                draft: false
            });

            toast.success("Analysis Generation Started (Layer 3)");
            router.push(`/analysis/${result.data.id}`);

        } catch (e) {
            console.error("Failed to proceed to analysis", e);
            toast.error("Failed to proceed to analysis");
            setIsProceeding(false);
        }
    }

    const handleBackToEdit = async () => {
        try {
            await updateAnalysis(id, token!, {
                metadata: { ...analysis?.metadata, status: 'DRAFT' }
            });
            mutate();
        } catch (e) {
            console.error("Failed to reset draft status", e);
            toast.error("Failed to go back to editing — please try again.");
        }
    }

    const handleFinalize = async () => {
        if (!id) return;
        setIsFinalizing(true);
        try {
            await finalizeAnalysis(id, token!);
            toast.success("SRS Finalized & Added to Knowledge Base");
            setIsFinalized(true);
            mutate();
        } catch (err) {
            console.error("Could not finalize SRS", err);
            toast.error("Could not finalize SRS");
        } finally {
            setIsFinalizing(false);
        }
    }

    const currentStatus = (analysis?.status || '').toUpperCase();

    const hasRealResults = analysis?.resultJson && Object.keys(analysis.resultJson).length > 5;

    const isActuallyInProgress =
        !hasRealResults && (
            currentStatus === 'PENDING' ||
            currentStatus === 'IN_PROGRESS' ||
            currentStatus === 'QUEUED' ||
            (analysis?.title?.includes('Analysis in Progress') && currentStatus !== 'FAILED' && currentStatus !== 'COMPLETED')
        );

    if (isActuallyInProgress) {
        return <AnalysisLoading liveMessage={liveProgress?.message} />
    }

    if (authLoading || (isLoading && !analysis)) {
        return (
            <div className="flex flex-col min-h-screen bg-background">
                <div className="border-b border-foreground/10 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-2">
                            <Skeleton className="h-6 w-48" />
                            <Skeleton className="h-4 w-32" />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Skeleton className="h-10 w-24" />
                        <Skeleton className="h-10 w-24" />
                    </div>
                </div>

                <div className="flex-1 p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2 space-y-4">
                            <Skeleton className="h-64 w-full" />
                            <Skeleton className="h-32 w-full" />
                        </div>
                        <div className="space-y-4">
                            <Skeleton className="h-48 w-full" />
                            <Skeleton className="h-48 w-full" />
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (error) {
        const parentDraftId = analysis?.parentId;

        return (
            <div className="min-h-screen flex flex-col">
                <div className="flex-1 flex items-center justify-center p-8 text-center">
                    <div className="max-w-md w-full border border-destructive/20 bg-destructive/5 p-6">
                        <div className="bg-destructive/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Sparkles className="h-6 w-6 text-destructive" />
                        </div>
                        <h2 className="text-xl font-display text-destructive mb-2">Analysis Generation Failed</h2>
                        <p className="text-sm text-muted-foreground mb-6">
                            {error}
                        </p>

                        <div className="flex flex-col gap-2">
                            {parentDraftId && (
                                <Button
                                    onClick={() => router.push(`/analysis/${parentDraftId}`)}
                                    className="w-full bg-foreground hover:bg-foreground/90 text-background rounded-full"
                                >
                                    <ArrowLeft className="h-4 w-4 mr-2" /> Back to Draft
                                </Button>
                            )}
                            <Button
                                onClick={() => router.push('/analysis')}
                                variant="outline"
                                className="w-full rounded-full"
                            >
                                <ArrowLeft className="h-4 w-4 mr-2" /> Back to My Analyses
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    const modelStatus = (analysis?.status || '').toUpperCase();
    const metadataStatus = analysis?.metadata?.status;
    const isTerminal = modelStatus === 'COMPLETED' || modelStatus === 'FAILED';
    const isValidatingOrValidated = metadataStatus === 'VALIDATING' || metadataStatus === 'VALIDATED' || metadataStatus === 'NEEDS_FIX';

    if (metadataStatus === 'DRAFT') {
        return (
            <div className="min-h-screen flex flex-col bg-background">
                <div className="border-b border-foreground/10 px-6 py-4 flex items-center justify-between sticky top-0 bg-background z-20">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => router.push('/analysis')}><ArrowLeft className="h-4 w-4" /></Button>
                        <div>
                            <h1 className="text-xl font-display">{analysis?.title?.replace(" (Draft)", "") || "New Analysis"}</h1>
                            <span className="text-xs font-mono text-muted-foreground">Draft mode · Layer 1</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="rounded-full" onClick={handleSaveDraft}>
                            <Save className="h-4 w-4 mr-2" /> Save draft
                        </Button>
                    </div>
                </div>
                <div className="flex-1 overflow-auto p-6">
                    <AccordionInput
                        data={(draftData as unknown as SRSIntakeModel) || {}}
                        onUpdate={handleDraftUpdate}
                        onValidate={handleRunValidation}
                        isValidating={isValidating}
                    />
                </div>
            </div>
        )
    }

    if (isValidatingOrValidated) {
        return (
            <div className="min-h-screen flex flex-col bg-background">
                <div className="flex-1 overflow-auto p-6">
                    <ValidationReport
                        issues={analysis?.metadata?.validationResult?.issues || []}
                        onProceed={handleProceedToAnalysis}
                        onEdit={handleBackToEdit}
                        isProceeding={isProceeding}
                        onAutoFix={handleAutoFix}
                        isFixing={isFixing}
                    />
                </div>
            </div>
        )
    }

    if (isTerminal && analysis) {
        const projectLabel = draftData?.details?.projectName?.content || analysis.projectTitle || analysis.title || "Analysis Result"
        return (
            <div className="h-screen flex flex-col bg-background">
                {/* One surface at a time, each full-width: the conversation (refinement)
                    and the document (the SRS) are separate views rather than a cramped
                    side-by-side split. */}
                <div className="border-b border-foreground/10 px-4 py-2.5 flex items-center justify-between gap-4 shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <Button variant="ghost" size="icon" onClick={() => router.push('/analysis')} aria-label="Back to analyses">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <h1 className="text-sm font-medium truncate">{projectLabel}</h1>
                    </div>

                    <div className="flex items-center gap-1 rounded-full border border-foreground/10 p-0.5 shrink-0">
                        <button
                            type="button"
                            onClick={() => setView('chat')}
                            className={cn(
                                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                                view === 'chat' ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <MessageSquare className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Conversation</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setView('document')}
                            className={cn(
                                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                                view === 'document' ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <FileText className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Document</span>
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden">
                    <AnalysisConversation
                        analysis={analysis}
                        analysisId={id}
                        onAnalysisUpdate={(newId: string) => router.push(`/analysis/${newId}`)}
                        hidden={view !== 'chat' || isDiagramEditing}
                        isFinalized={analysis.isFinalized}
                        isCanvasOpen={view === 'document'}
                        onOpenCanvas={() => setView('document')}
                    />

                    {view === 'document' && (
                        <DocumentCanvas
                            analysis={analysis}
                            analysisId={id}
                            token={token!}
                            onDiagramEditChange={memoizedOnDiagramEditChange}
                            onRefresh={memoizedOnRefresh}
                            onNavigate={(newId) => router.push(`/analysis/${newId}`)}
                            isFinalizing={isFinalizing}
                            onFinalize={handleFinalize}
                            onImproveClick={() => setIsImproveDialogOpen(true)}
                            className="h-full"
                        />
                    )}
                </div>

                <ImprovementDialog
                    open={isImproveDialogOpen}
                    onOpenChange={setIsImproveDialogOpen}
                    analysisId={id}
                    version={analysis.version}
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-background">
            <div className="border-b border-foreground/10 px-6 py-4 flex items-center justify-between sticky top-0 bg-background z-20">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/analysis')}><ArrowLeft className="h-4 w-4" /></Button>
                    <div>
                        <h1 className="text-xl font-display">{analysis?.title?.replace(" (Draft)", "") || "New Analysis"}</h1>
                    </div>
                </div>
            </div>
        </div>
    )
}
