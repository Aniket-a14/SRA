"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import useSWR from "swr";
import { fetcher, swrOptions } from "@/lib/swr-utils";
import { useAnalysisProgress } from "@/lib/hooks";

import { Button } from "@/components/ui/button"
import { Loader2, ArrowLeft, Calendar, Download, Sparkles, Database, Save, Zap } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { generateSRS, downloadBundle } from "@/lib/export-utils"
import { updateAnalysis, runValidation, autoFixIssue, startAnalysis, finalizeAnalysis } from "@/lib/analysis-api"
import type { Analysis, ValidationIssue, StartAnalysisInput, SystemFeature } from "@/types/analysis"
import { SRSIntakeModel } from "@/types/srs-intake"
import { cn } from "@/lib/utils"

import { toast } from "sonner"
import { useLayer } from "@/lib/layer-context"
import { AnalysisLoading } from "@/components/analysis/analysis-loading"
import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorBoundary } from "@/components/error-boundary"
import { SourcesPanel } from "@/components/analysis/sources-panel"

const ResultsTabs = dynamic(() => import("@/components/results-tabs").then(mod => mod.ResultsTabs), {
    loading: () => <div className="h-[600px] w-full bg-muted/5 animate-pulse" />
})

const ProjectChatPanel = dynamic(() => import("@/components/project-chat-panel").then(mod => mod.ProjectChatPanel), {
    ssr: false
})

const VersionTimeline = dynamic(() => import("@/components/version-timeline").then(mod => mod.VersionTimeline), {
    loading: () => <div className="h-20 w-full bg-muted/5 animate-pulse" />
})

const ImprovementDialog = dynamic(() => import("@/components/improvement-dialog").then(mod => mod.ImprovementDialog))
const AccordionInput = dynamic(() => import("@/components/analysis/accordion-input").then(mod => mod.AccordionInput))
const ValidationReport = dynamic(() => import("@/components/analysis/validation-report").then(mod => mod.ValidationReport))
const RecyclingPanel = dynamic(() => import("@/components/analysis/recycling-panel").then(mod => mod.RecyclingPanel))

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

    if (isTerminal) {
        return (
            <div className="min-h-screen flex flex-col bg-background">
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                    <main className="flex-1 overflow-auto h-full">
                        <div className="bg-background border-b border-foreground/10 sticky top-0 z-10">
                            <div className="px-6 py-4">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

                                    <div className="space-y-1">
                                        <div className="flex items-center gap-3">
                                            <h1 className="text-xl sm:text-2xl font-display tracking-tight truncate max-w-[300px] sm:max-w-md">
                                                {draftData?.details?.projectName?.content || analysis?.title || "Analysis Result"}
                                            </h1>
                                            {analysis?.version && (
                                                <span className="px-2 py-0.5 border border-foreground/10 text-xs font-mono">
                                                    v{analysis.version}
                                                </span>
                                            )}

                                            {analysis?.metadata?.optimized && (
                                                <span className="hidden sm:inline-flex px-2 py-0.5 bg-green-500/10 text-green-600 text-xs rounded-full border border-green-200 items-center gap-1">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                                                    KB Optimized
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1 font-mono">
                                                <Calendar className="h-3 w-3" />
                                                {analysis?.createdAt && formatDistanceToNow(new Date(analysis.createdAt), { addSuffix: true })}
                                            </span>

                                            {analysis?.rootId && (
                                                <>
                                                    <span className="text-foreground/20">|</span>
                                                    <Sheet>
                                                        <SheetTrigger asChild>
                                                            <button className="flex items-center gap-1 hover:text-foreground transition-colors">
                                                                <div className="flex items-center gap-1">
                                                                    <div className="relative flex h-2 w-2">
                                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
                                                                    </div>
                                                                    Version history
                                                                </div>
                                                            </button>
                                                        </SheetTrigger>
                                                        <SheetContent className="w-[400px] sm:w-[540px] p-0 flex flex-col h-full">
                                                            <SheetHeader className="px-6 py-4 border-b shrink-0">
                                                                <SheetTitle>Project History</SheetTitle>
                                                            </SheetHeader>
                                                            <div className="flex-1 min-h-0 overflow-hidden">
                                                                <VersionTimeline
                                                                    rootId={analysis.rootId}
                                                                    currentId={id}
                                                                    className="border-0 bg-transparent"
                                                                    hideHeader={true}
                                                                />
                                                            </div>
                                                        </SheetContent>
                                                    </Sheet>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 pl-12 md:pl-0 flex-wrap">
                                        <Sheet>
                                            <SheetTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    className="gap-2 rounded-full"
                                                    disabled={analysis?.isFinalized}
                                                >
                                                    <Zap className="h-4 w-4 text-amber-500" />
                                                    Recycling
                                                </Button>
                                            </SheetTrigger>
                                            <SheetContent className="w-[400px] sm:w-[500px] p-6">
                                                <SheetHeader className="mb-6">
                                                    <SheetTitle>Knowledge Recycling</SheetTitle>
                                                </SheetHeader>
                                                <RecyclingPanel
                                                    onApply={async (content: string | Record<string, unknown>) => {
                                                        const loadingToast = toast.loading("Applying recycled requirement...");
                                                        try {
                                                            const newFeature = (typeof content === 'string'
                                                                ? { name: "Recycled Feature", description: content, functionalRequirements: [] }
                                                                : content) as unknown as SystemFeature;

                                                            const updatedFeatures: SystemFeature[] = [...(analysis?.systemFeatures || []), newFeature];

                                                            const updatedData = await updateAnalysis(id, token!, {
                                                                systemFeatures: updatedFeatures,
                                                                skipAlignment: true,
                                                            });

                                                            toast.success("Requirement applied! Switching to new version...", { id: loadingToast });
                                                            router.push(`/analysis/${updatedData.data.id}`);
                                                        } catch (e) {
                                                            console.error(e);
                                                            toast.error("Failed to apply requirement", { id: loadingToast });
                                                        }
                                                    }}
                                                />
                                            </SheetContent>
                                        </Sheet>

                                        <Button
                                            onClick={() => setIsImproveDialogOpen(true)}
                                            variant="outline"
                                            className="gap-2 rounded-full"
                                            disabled={analysis?.isFinalized}
                                        >
                                            <Sparkles className="h-4 w-4 text-amber-500" />
                                            Improve SRS
                                        </Button>

                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                    variant={(analysis?.isFinalized) ? "outline" : "default"}
                                                    className={cn(
                                                        "gap-2 rounded-full transition-all",
                                                        (analysis?.isFinalized)
                                                            ? "border-green-500/30 text-green-600 bg-green-500/5 hover:bg-green-500/10"
                                                            : "bg-foreground text-background hover:bg-foreground/90"
                                                    )}
                                                    disabled={isFinalizing || analysis?.isFinalized}
                                                >
                                                    {isFinalizing ? <Loader2 className="h-4 w-4 animate-spin" /> :
                                                        analysis?.isFinalized ? (
                                                            <>
                                                                <Database className="h-4 w-4" />
                                                                Finalized
                                                            </>
                                                        ) : "Finalize & Save"}
                                                </Button>
                                            </AlertDialogTrigger>

                                            {!analysis?.isFinalized && (
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Finalize SRS analysis?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Once you finalize, you cannot &quot;Improve&quot; this specific SRS version again using the AI refinement tools.
                                                            Further changes will require performing a separate analysis.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={handleFinalize} className="bg-foreground hover:bg-foreground/90 text-background">
                                                            Yes, finalize
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            )}
                                        </AlertDialog>

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" className="gap-2 rounded-full">
                                                    <Download className="h-4 w-4" />
                                                    Export
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="start">
                                                <DropdownMenuItem onClick={async () => {
                                                    try {
                                                        if (analysis) {
                                                            toast.info("Preparing diagrams and PDF...");
                                                            const { renderMermaidDiagrams } = await import("@/lib/export-utils");
                                                            const images = await renderMermaidDiagrams(analysis);

                                                            const projectTitle = analysis.projectTitle || analysis.title || "Project_Context";
                                                            const doc = await generateSRS(analysis, projectTitle, images);
                                                            doc.save(`${projectTitle.replace(/\s+/g, '_')}_SRS.pdf`);
                                                            toast.success("SRS Report downloaded");
                                                        }
                                                    } catch (err) {
                                                        console.error("SRS Export Failed", err);
                                                        toast.error("Failed to generate SRS PDF");
                                                    }
                                                }}>
                                                    Export SRS (PDF)
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={async () => {
                                                    try {
                                                        if (analysis) {
                                                            toast.info("Generating bundle...");
                                                            await downloadBundle(analysis, "Project_Analysis");
                                                            toast.success("Bundle downloaded successfully");
                                                        }
                                                    } catch (err) {
                                                        console.error("Bundle Export Failed", err);
                                                        toast.error("Failed to generate Download Bundle");
                                                    }
                                                }}>
                                                    Download Bundle (.zip)
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {analysis && (
                            <div className="flex flex-col gap-4 p-6">
                                <SourcesPanel sources={analysis.metadata?.ragSources || []} />
                                <div className="border border-foreground/10">
                                    <ErrorBoundary name="Results View">
                                        <ResultsTabs
                                            data={analysis}
                                            onDiagramEditChange={memoizedOnDiagramEditChange}
                                            onRefresh={memoizedOnRefresh}
                                        />
                                    </ErrorBoundary>
                                </div>
                            </div>
                        )}
                    </main>

                    <ProjectChatPanel
                        analysisId={id}
                        onAnalysisUpdate={(newId: string) => router.push(`/analysis/${newId}`)}
                        hidden={isDiagramEditing}
                        isFinalized={analysis?.isFinalized}
                    />
                </div>

                {analysis && (
                    <ImprovementDialog
                        open={isImproveDialogOpen}
                        onOpenChange={setIsImproveDialogOpen}
                        analysisId={id}
                        version={analysis.version}
                    />
                )}

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
