"use client"

import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import useSWR from "swr";
import { fetcher, swrOptions } from "@/lib/swr-utils";

import { Button } from "@/components/ui/button"
import { Loader2, ArrowLeft, Calendar, Download, Sparkles, Database, Save } from "lucide-react"
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
import { generateSRS, generateAPI, downloadBundle } from "@/lib/export-utils"
import type { Analysis, ValidationIssue } from "@/types/analysis"
import { SRSIntakeModel } from "@/types/srs-intake"
import { cn } from "@/lib/utils"

import { toast } from "sonner"
import { useLayer } from "@/lib/layer-context"
import { AnalysisLoading } from "@/components/analysis/analysis-loading"
import dynamic from "next/dynamic"
import saveAs from "file-saver"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorBoundary } from "@/components/error-boundary"
import { SourcesPanel } from "@/components/analysis/sources-panel"
import { useTransition } from "react"

const ResultsTabs = dynamic(() => import("@/components/results-tabs").then(mod => mod.ResultsTabs), {
    loading: () => <div className="h-[600px] w-full bg-muted/5 animate-pulse rounded-xl" />
})

const ProjectChatPanel = dynamic(() => import("@/components/project-chat-panel").then(mod => mod.ProjectChatPanel), {
    ssr: false // Client side floating widget
})

const VersionTimeline = dynamic(() => import("@/components/version-timeline").then(mod => mod.VersionTimeline), {
    loading: () => <div className="h-20 w-full bg-muted/5 animate-pulse rounded-lg" />
})

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
    const { user, token, csrfToken, isLoading: authLoading, fetchCsrf } = useAuth()
    const { unlockAndNavigate, unlockLayer, setLayer, setIsFinalized } = useLayer()

    // SWR Data Fetching
    const swrKey = useMemo(() => {
        if (!id || !token || authLoading) return null;
        return [`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze/${id}`, token, csrfToken];
    }, [id, token, csrfToken, authLoading]);

    const { data: analysis, error: swrError, mutate, isValidating: swrValidating } = useSWR<Analysis>(
        swrKey,
        fetcher,
        {
            ...swrOptions,
            refreshInterval: (data) => {
                const status = (data?.status || '').toUpperCase();
                // Terminal or Draft states don't need polling
                if (status === 'COMPLETED' || status === 'FAILED' || data?.isFinalized) return 0;
                // Layer 1/2 Drafts don't need polling
                if (data?.metadata?.status === 'DRAFT' || data?.metadata?.status === 'VALIDATED') return 0;
                // Otherwise poll every 3s
                return 3000;
            }
        }
    );

    const [isLoading, setIsLoading] = useState(true)
    const [loadingMessage, setLoadingMessage] = useState("Loading analysis details...")
    const [error, setError] = useState("")
    const [isDiagramEditing, setIsDiagramEditing] = useState(false)
    const [isImproveDialogOpen, setIsImproveDialogOpen] = useState(false)
    const [isFinalizing, setIsFinalizing] = useState(false)
    const [isValidating, setIsValidating] = useState(false)
    const [isProceeding, setIsProceeding] = useState(false)
    const [isFixing, setIsFixing] = useState<string | null>(null);
    const [,] = useTransition()
    const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
    const lastIdRef = useRef<string | null>(null);

    // Draft State
    const [draftData, setDraftData] = useState<SRSIntakeModel | null>(null)

    // State Sync Hook: Keep UI states in sync with SWR data
    useEffect(() => {
        if (!analysis) return;

        const currentStatus = (analysis.status || '').toUpperCase();

        // Handle Error terminal state
        if (currentStatus === 'FAILED') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const msg = (analysis.resultJson as any)?.error || "Analysis generation failed.";
            setError(msg);
            setIsLoading(false);
            return;
        }

        // Handle Polling Messaging
        if (currentStatus === 'PENDING' || currentStatus === 'IN_PROGRESS' || currentStatus === 'QUEUED') {
            const msg = currentStatus === 'IN_PROGRESS'
                ? "AI is analyzing requirements (Layer 3)..."
                : "Queueing analysis job...";
            setLoadingMessage(msg);
            setIsLoading(true);
            return;
        }

        // Terminal logic (COMPLETED or results exist)
        const hasResults = analysis.resultJson && Object.keys(analysis.resultJson).length > 2;
        if (currentStatus === 'COMPLETED' && !hasResults) {
            setLoadingMessage("Finalizing results...");
            setIsLoading(true);
            return;
        }

        // Successfully loaded data
        setIsLoading(false);
        setError("");

        // Layer Synchronization
        const metadataStatus = analysis.metadata?.status;
        if (metadataStatus === 'DRAFT') {
            unlockAndNavigate(1);
            setDraftData((analysis.metadata?.draftData as unknown as SRSIntakeModel) || null);
        } else if (metadataStatus === 'VALIDATING' || metadataStatus === 'VALIDATED' || metadataStatus === 'NEEDS_FIX') {
            unlockAndNavigate(2);
            setDraftData((analysis.metadata?.draftData as unknown as SRSIntakeModel) || null);
            setValidationIssues(analysis.metadata?.validationResult?.issues || []);
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
    }, [analysis, unlockAndNavigate, unlockLayer, setLayer, setIsFinalized]);

    // Handle SWR errors separately
    useEffect(() => {
        if (swrError) {
            setError(swrError.message || "Failed to sync analysis");
            setIsLoading(false);
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
            setIsLoading(false)
            router.push("/auth/login")
            return
        }

        if (id === 'undefined') {
            setError("Invalid Analysis ID");
            setIsLoading(false);
        }
    }, [user, token, id, authLoading, router])

    const handleRefresh = () => {
        mutate()
    }

    useEffect(() => {
        if (analysis) {
            const s = (analysis.status || '').toUpperCase();
            // Poll for any in-progress equivalent
            if (s !== 'PENDING' && s !== 'IN_PROGRESS' && s !== 'QUEUED') {
                setIsLoading(false)
            }
        }
    }, [analysis])

    const handleDraftUpdate = useCallback((section: string, field: string, value: string) => {
        setDraftData((prev: SRSIntakeModel | null) => {
            const newData = (prev ? { ...prev } : {}) as Record<string, unknown>;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sectionData = (newData as any)[section] || {};
            const fieldData = sectionData[field] || { content: "" };

            fieldData.content = value;
            sectionData[field] = fieldData;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (newData as any)[section] = sectionData;

            return newData as unknown as SRSIntakeModel;
        });
    }, []);



    const handleSaveDraft = async () => {
        if (!id || !draftData) return;
        const loadingToast = toast.loading("Saving draft to cloud...");
        try {
            let activeCsrf = csrfToken;
            if (!activeCsrf) activeCsrf = await fetchCsrf();

            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze/${id}`, {
                method: "PUT",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                    ...(activeCsrf && { "x-csrf-token": activeCsrf })
                },
                body: JSON.stringify({
                    metadata: { ...analysis?.metadata, draftData, status: 'DRAFT' }
                })
            });
            if (!res.ok) throw new Error("Save failed");
            toast.success("Draft saved", { id: loadingToast });
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Failed to initialize project";
            toast.error(errorMessage, { id: loadingToast });
        }
    }

    const handleRunValidation = async () => {
        setIsValidating(true);
        try {
            let activeCsrf = csrfToken;
            if (!activeCsrf) activeCsrf = await fetchCsrf();

            // First Save current draft to ensure validation uses latest data
            await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze/${id}`, {
                method: "PUT",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                    ...(activeCsrf && { "x-csrf-token": activeCsrf })
                },
                body: JSON.stringify({
                    metadata: { ...analysis?.metadata, draftData, status: 'DRAFT' }
                })
            });

            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze/${id}/validate`, {
                method: "POST",
                credentials: "include",
                headers: {
                    Authorization: `Bearer ${token}`,
                    ...(activeCsrf && { "x-csrf-token": activeCsrf })
                }
            });
            if (!res.ok) throw new Error("Validation failed");

            const result = await res.json();
            setValidationIssues(result.issues || []);
            mutate();
            toast.success("Validation Complete");
        } catch {
            toast.error("Failed to run validation");
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
            let activeCsrf = csrfToken;
            if (!activeCsrf) activeCsrf = await fetchCsrf();

            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze/${id}/auto-fix`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                    ...(activeCsrf && { "x-csrf-token": activeCsrf })
                },
                body: JSON.stringify({ issueId })
            });

            if (!res.ok) throw new Error("Auto-fix failed");

            const { fixedText } = await res.json();

            // Find the issue to know WHICH section it belongs to
            const issues: ValidationIssue[] = analysis?.metadata?.validationResult?.issues || [];
            const issue = issues.find(i => i.id === issueId);

            if (issue && issue.section) {
                const section = issue.section.toLowerCase();
                setDraftData(prev => {
                    if (!prev) return prev;
                    const next = { ...prev } as unknown as SRSIntakeModel;

                    // Simple heuristic mapping - can be expanded
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
    };

    const handleProceedToAnalysis = async () => {
        setIsProceeding(true);
        try {
            let activeCsrf = csrfToken;
            if (!activeCsrf) activeCsrf = await fetchCsrf();

            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                    ...(activeCsrf && { "x-csrf-token": activeCsrf })
                },
                body: JSON.stringify({
                    projectId: analysis?.projectId,
                    text: "Generated from Draft",
                    srsData: draftData,
                    validationResult: { validation_status: 'PASS', issues: validationIssues },
                    parentId: id,
                    draft: false
                })
            });

            if (!res.ok) throw new Error("Failed to start analysis");
            const result = await res.json();
            toast.success("Analysis Generation Started (Layer 3)");
            router.push(`/analysis/${result.id}`);

        } catch (e) {
            console.error("Failed to proceed to analysis", e);
            toast.error("Failed to proceed to analysis");
            setIsProceeding(false);
        }
    }

    const handleBackToEdit = async () => {
        try {
            let activeCsrf = csrfToken;
            if (!activeCsrf) activeCsrf = await fetchCsrf();

            await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze/${id}`, {
                method: "PUT",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                    ...(activeCsrf && { "x-csrf-token": activeCsrf })
                },
                body: JSON.stringify({
                    metadata: { ...analysis?.metadata, status: 'DRAFT' } // Explicit status reset
                })
            });
            mutate();
        } catch (e) {
            console.error("Failed to reset draft status", e);
        }
    }

    const handleFinalize = async () => {
        if (!id) return;
        setIsFinalizing(true);
        try {
            let activeCsrf = csrfToken;
            if (!activeCsrf) activeCsrf = await fetchCsrf();

            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze/${id}/finalize`, {
                method: "POST",
                credentials: "include",
                headers: {
                    Authorization: `Bearer ${token}`,
                    ...(activeCsrf && { "x-csrf-token": activeCsrf })
                }
            });
            if (res.ok) {
                toast.success("SRS Finalized & Added to Knowledge Base");
                setIsFinalized(true);
                mutate();
            } else {
                throw new Error("Failed to finalize");
            }
        } catch (err) {
            console.error("Could not finalize SRS", err);
            toast.error("Could not finalize SRS");
        } finally {
            setIsFinalizing(false);
        }
    };

    // Loading State Handling (Priority)
    const currentStatus = (analysis?.status || '').toUpperCase();

    const hasRealResults = analysis?.resultJson && Object.keys(analysis.resultJson).length > 5; // Enough keys to represent a real SRS

    const isActuallyInProgress =
        !hasRealResults && (
            currentStatus === 'PENDING' ||
            currentStatus === 'IN_PROGRESS' ||
            currentStatus === 'QUEUED' ||
            (analysis?.title?.includes('Analysis in Progress') && currentStatus !== 'FAILED' && currentStatus !== 'COMPLETED')
        );

    // 1. Premium Loader for Active Analysis
    if (isActuallyInProgress) {
        return <AnalysisLoading />
    }

    // 2. Sophisticated Skeleton Loader
    if (authLoading || (isLoading && !analysis)) {
        return (
            <div className="flex flex-col h-[calc(100vh-64px)] bg-background">
                {/* Header Skeleton */}
                <div className="border-b px-6 py-4 flex items-center justify-between">
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

                {/* Main Content Skeleton */}
                <div className="flex-1 p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2 space-y-4">
                            <Skeleton className="h-64 w-full rounded-xl" />
                            <Skeleton className="h-32 w-full rounded-xl" />
                        </div>
                        <div className="space-y-4">
                            <Skeleton className="h-48 w-full rounded-xl" />
                            <Skeleton className="h-48 w-full rounded-xl" />
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="h-[calc(100vh-64px)] flex flex-col">
                <div className="flex-1 flex items-center justify-center p-8 text-center bg-muted/10">
                    <div className="max-w-md w-full border border-destructive/20 bg-destructive/5 rounded-xl p-6 shadow-sm">
                        <div className="bg-destructive/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Sparkles className="h-6 w-6 text-destructive" />
                        </div>
                        <h2 className="text-xl font-bold text-destructive mb-2">Analysis Generation Failed</h2>
                        <p className="text-sm text-muted-foreground mb-6">
                            {error}
                        </p>

                        <div className="flex flex-col gap-2">
                            <Button
                                onClick={() => router.push('/analysis')}
                                variant="outline"
                                className="w-full"
                            >
                                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Projects
                            </Button>

                            {/* Optional: Retry mechanism could be added here if backend supports it */}
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // View State Logic
    const status = analysis?.metadata?.status || 'COMPLETED';
    const isDraft = status === 'DRAFT';
    const isValidatingOrValidated = status === 'VALIDATING' || status === 'VALIDATED' || status === 'NEEDS_FIX';

    if (isDraft) {
        return (
            <div className="h-[calc(100vh-64px)] flex flex-col bg-background">
                <div className="border-b px-6 py-4 flex items-center justify-between sticky top-0 bg-background z-20 shadow-sm">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => router.push('/analysis')}><ArrowLeft className="h-4 w-4" /></Button>
                        <div>
                            <h1 className="text-xl font-bold">{analysis?.title?.replace(" (Draft)", "") || "New Project Analysis"}</h1>
                            <span className="text-xs text-muted-foreground">Draft Mode • Layer 1</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleSaveDraft}>
                            <Save className="h-4 w-4 mr-2" /> Save Draft
                        </Button>
                    </div>
                </div>
                <div className="flex-1 overflow-auto bg-muted/5 p-6">
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
            <div className="h-[calc(100vh-64px)] flex flex-col bg-background">
                <div className="flex-1 overflow-auto bg-muted/5 p-6">
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

    // Default: COMPLETE (Layer 3+)
    return (
        <div className="h-[calc(100vh-64px)] flex flex-col bg-background">
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                {/* Timeline Sidebar - Only if history exists */}
                {/* Note: This sidebar is local to the analysis, distinct from AppSidebar */}


                <main className="flex-1 overflow-auto h-full bg-muted/5">
                    <div className="bg-background border-b border-border shadow-sm sticky top-0 z-10">
                        <div className="container mx-auto px-4 sm:px-6 py-4">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

                                {/* Title & Meta */}
                                <div className="space-y-1">
                                    <div className="flex items-center gap-3">
                                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate max-w-[300px] sm:max-w-md">
                                            {draftData?.details?.projectName?.content || analysis?.title || "Analysis Result"}
                                        </h1>
                                        {analysis?.version && (
                                            <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full font-medium border border-primary/20">
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
                                        <span className="flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {analysis?.createdAt && formatDistanceToNow(new Date(analysis.createdAt), { addSuffix: true })}
                                        </span>

                                        {/* Version History Trigger */}
                                        {analysis?.rootId && (
                                            <>
                                                <span className="text-border">|</span>
                                                <Sheet>
                                                    <SheetTrigger asChild>
                                                        <button className="flex items-center gap-1 hover:text-primary transition-colors">
                                                            <div className="flex items-center gap-1">
                                                                <div className="relative flex h-2 w-2">
                                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
                                                                </div>
                                                                Version History
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

                                {/* Action Toolbar (Layers 4 & 5) */}
                                <div className="flex items-center gap-2 pl-12 md:pl-0">
                                    {/* Layer 4: Improve */}
                                    <Button
                                        onClick={() => setIsImproveDialogOpen(true)}
                                        variant="outline"
                                        className="gap-2 border-primary/20 hover:bg-primary/5 hover:text-primary"
                                        disabled={analysis?.isFinalized}
                                    >
                                        <Sparkles className="h-4 w-4 text-amber-500" />
                                        Improve SRS
                                    </Button>

                                    {/* Layer 5: Finalize */}
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button
                                                variant={(analysis?.isFinalized) ? "outline" : "default"}
                                                className={cn(
                                                    "gap-2 transition-all",
                                                    (analysis?.isFinalized)
                                                        ? "border-green-500/30 text-green-600 bg-green-500/5 hover:bg-green-500/10"
                                                        : "bg-primary hover:bg-primary/90"
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
                                                    <AlertDialogTitle>Finalize SRS Analysis?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Once you finalize, you cannot &quot;Improve&quot; this specific SRS version again using the AI refinement tools.
                                                        Further changes will require performing a separate analysis.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={handleFinalize} className="bg-primary hover:bg-primary/90">
                                                        Yes, Finalize
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        )}
                                    </AlertDialog>



                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" className="gap-2">
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
                                                        // generateSRS is now async
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
                                            <DropdownMenuItem onClick={() => {
                                                try {
                                                    if (analysis) {
                                                        const md = generateAPI(analysis);
                                                        const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
                                                        saveAs(blob, "API_Blueprint.md");
                                                        toast.success("API Blueprint downloaded");
                                                    }
                                                } catch (err) {
                                                    console.error("API Export Failed", err);
                                                    toast.error("Failed to generate API Blueprint");
                                                }
                                            }}>
                                                Export API Blueprint (MD)
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

                        {analysis && (
                            <div className="flex flex-col gap-4 mb-4">
                                <SourcesPanel sources={analysis.metadata?.ragSources || []} />
                                <div className="border p-2 bg-muted rounded-lg">
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
                    </div>
                </main>
            </div>

            <ProjectChatPanel
                analysisId={id}
                onAnalysisUpdate={(newId) => router.push(`/analysis/${newId}`)}
                hidden={isDiagramEditing}
                isFinalized={analysis?.isFinalized}
            />

            {analysis && (
                <ImprovementDialog
                    open={isImproveDialogOpen}
                    onOpenChange={setIsImproveDialogOpen}
                    analysisId={id}
                    version={analysis.version}
                />
            )}

        </div>
    )
}
