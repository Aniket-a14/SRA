"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"

import { ResultsTabs } from "@/components/results-tabs"
import { Button } from "@/components/ui/button"
import { Loader2, ArrowLeft, Calendar, Download, Sparkles, Database, Save } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ProjectChatPanel } from "@/components/project-chat-panel"
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
import { saveAs } from "file-saver"
import type { Analysis, ValidationIssue } from "@/types/analysis"
import { SRSIntakeModel } from "@/types/srs-intake"
import { cn } from "@/lib/utils"
import { VersionTimeline } from "@/components/version-timeline"

import { toast } from "sonner"
import { ImprovementDialog } from "@/components/improvement-dialog"
import { AccordionInput } from "@/components/analysis/accordion-input"
import { ValidationReport } from "@/components/analysis/validation-report"
import { useLayer } from "@/lib/layer-context"
import { AnalysisLoading } from "@/components/analysis/analysis-loading"

export default function AnalysisDetailPage() {
    return <AnalysisDetailContent />
}

function AnalysisDetailContent() {
    const params = useParams()
    const id = params?.id as string
    const router = useRouter()
    const { user, token, isLoading: authLoading } = useAuth()
    const { unlockAndNavigate, unlockLayer, setLayer, setIsFinalized } = useLayer()

    const [analysis, setAnalysis] = useState<Analysis | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [loadingMessage, setLoadingMessage] = useState("Loading analysis details...")
    const [error, setError] = useState("")
    const [isDiagramEditing, setIsDiagramEditing] = useState(false)
    const [isImproveDialogOpen, setIsImproveDialogOpen] = useState(false)
    const [isFinalizing, setIsFinalizing] = useState(false)
    const [isValidating, setIsValidating] = useState(false)
    const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
    const lastIdRef = useRef<string | null>(null);

    // Draft State
    const [draftData, setDraftData] = useState<SRSIntakeModel | null>(null)

    const fetchAnalysis = useCallback(async (analysisId: string) => {
        try {
            // Only set loading message if we don't have analysis yet, avoids flicker
            setAnalysis(prev => {
                if (!prev) setLoadingMessage("Loading project...");
                return prev;
            });

            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze/${analysisId}`, {
                cache: 'no-store',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Pragma': 'no-cache'
                }
            })

            if (!response.ok) throw new Error("Failed to load analysis");

            const data: Analysis = await response.json()
            console.log("[Analysis] Fetched:", data.status, "Title:", data.title);
            setAnalysis(data)

            // STATUS HANDLING
            // Poll if PENDING or IN_PROGRESS
            const currentStatus = (data.status || '').toUpperCase();
            if (currentStatus === 'PENDING' || currentStatus === 'IN_PROGRESS' || currentStatus === 'QUEUED') {
                const msg = currentStatus === 'IN_PROGRESS'
                    ? "AI is analyzing requirements (Layer 3)..."
                    : "Queueing analysis job...";
                setLoadingMessage(msg)
                setAnalysis(data) // Ensure analysis is set so AnalysisLoading can render
                setTimeout(() => fetchAnalysis(analysisId), 3000)
                return
            }

            // If FAILED, show error
            if (data.status === 'FAILED') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const errorMsg = (data.resultJson as any)?.error || "Analysis generation failed. The AI worker encountered an error.";
                setError(errorMsg);
                setIsLoading(false)
                return
            }

            // EXTRA GUARD: If status is COMPLETED but we have no results yet, keep polling
            // This handles potential DB consistency delay or early status flips
            const hasResults = data.resultJson && Object.keys(data.resultJson).length > 2; // projectTitle + introduction is at least something
            if (currentStatus === 'COMPLETED' && !hasResults) {
                console.log("[Analysis] Status COMPLETED but results missing, continuing polling...");
                setLoadingMessage("Finalizing results...")
                setTimeout(() => fetchAnalysis(analysisId), 2000)
                return
            }

            // Layer Synchronization from Metadata
            const status = data.metadata?.status;

            if (status === 'DRAFT') {
                unlockAndNavigate(1);
                setDraftData((data.metadata?.draftData as unknown as SRSIntakeModel) || null);
            } else if (status === 'VALIDATING' || status === 'VALIDATED' || status === 'NEEDS_FIX') {
                unlockAndNavigate(2);
                setDraftData((data.metadata?.draftData as unknown as SRSIntakeModel) || null); // Keep draft data loaded if back nav needed
                setValidationIssues(data.metadata?.validationResult?.issues || []);
            } else {
                // Default: COMPLETED (Layer 3 done)
                // This handles 'COMPLETED', undefined (legacy), and any other post-analysis state.

                // CRITICAL FIX: If we have resultJson, we are done.
                if (data.status === 'COMPLETED' || (data.resultJson && Object.keys(data.resultJson).length > 2)) {
                    console.log("[Analysis] Completion detected (Status: " + data.status + "), forcing loader off.");
                    setIsLoading(false);
                }

                if (data.isFinalized) {
                    setIsFinalized(true);
                    unlockAndNavigate(5);
                } else {
                    setIsFinalized(false);
                    // Unlock everything (including 4 and 5) so user can choose to Improve or Finalize
                    // But keep them on the Analysis Report (Layer 3) initially
                    unlockLayer(5);
                    setLayer(3);
                }
            }

        } catch (err) {
            console.error("Error fetching analysis:", err)
            setError(err instanceof Error ? err.message : "Failed to load analysis")
            setIsLoading(false)
        } finally {
            // No-op
        }
    }, [token, unlockAndNavigate, unlockLayer, setLayer, setIsFinalized]);

    useEffect(() => {
        // Wait for auth initialization
        if (authLoading) return

        if (!user || !token) {
            // Not authenticated, stop loading and redirect
            setIsLoading(false)
            router.push("/auth/login")
            return
        }

        if (id && id !== 'undefined') {
            // CRITICAL: ONLY reset state if the ID has actually changed
            // This prevents the infinite reset loop when fetchAnalysis dependencies change
            if (id !== lastIdRef.current) {
                lastIdRef.current = id;
                setIsLoading(true);
                setAnalysis(null);
                setError("");
                setLoadingMessage("Loading analysis details...");
            }
            fetchAnalysis(id)
        } else if (id === 'undefined') {
            setError("Invalid Analysis ID");
            setIsLoading(false);
        }
    }, [user, token, id, authLoading, router, fetchAnalysis])

    const handleRefresh = () => {
        if (id) fetchAnalysis(id)
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
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    metadata: { ...analysis?.metadata, draftData, status: 'DRAFT' }
                })
            });
            if (!res.ok) throw new Error("Save failed");
            toast.success("Draft saved", { id: loadingToast });
        } catch (e) {
            console.error(e);
            toast.error("Failed to save draft", { id: loadingToast });
        }
    }

    const handleRunValidation = async () => {
        setIsValidating(true);
        try {
            // First Save current draft to ensure validation uses latest data
            await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    metadata: { ...analysis?.metadata, draftData, status: 'DRAFT' }
                })
            });

            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze/${id}/validate`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Validation failed");

            const result = await res.json();
            setValidationIssues(result.issues || []);
            handleRefresh();
            toast.success("Validation Complete");
        } catch {
            toast.error("Failed to run validation");
        } finally {
            setIsValidating(false);
        }
    }

    const handleProceedToAnalysis = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
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
        }
    }

    const handleBackToEdit = async () => {
        try {
            await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    metadata: { ...analysis?.metadata, status: 'DRAFT' } // Explicit status reset
                })
            });
            handleRefresh();
        } catch (e) {
            console.error("Failed to reset draft status", e);
        }
    }

    const handleFinalize = async () => {
        if (!id) return;
        setIsFinalizing(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze/${id}/finalize`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                toast.success("SRS Finalized & Added to Knowledge Base");
                setIsFinalized(true);
                fetchAnalysis(id);
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

    // 2. Fallback Basic Loader
    if (authLoading || (isLoading && !analysis)) {
        return (
            <div className="flex h-[calc(100vh-64px)] items-center justify-center p-8 bg-background">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground animate-pulse">{loadingMessage}</p>
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
                                            {analysis?.title || "Analysis Result"}
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

                                    <div className="h-6 w-px bg-border mx-1" />

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
                                                        const doc = generateSRS(analysis, projectTitle, images);
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
                            <div className="border p-2 mb-4 bg-muted">
                                <ResultsTabs
                                    data={analysis}
                                    onDiagramEditChange={setIsDiagramEditing}
                                    onRefresh={handleRefresh}
                                />
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
