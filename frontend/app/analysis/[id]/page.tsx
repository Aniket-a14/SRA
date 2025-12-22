"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
// import { Navbar } from "@/components/navbar"
import { ResultsTabs } from "@/components/results-tabs"
import { Button } from "@/components/ui/button"
import { Loader2, ArrowLeft, Calendar, Download, Sparkles, Database, Save } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ProjectChatPanel } from "@/components/project-chat-panel"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { generateSRS, generateAPI, downloadBundle } from "@/lib/export-utils"
import { saveAs } from "file-saver"
import type { Analysis } from "@/types/analysis"
import { cn } from "@/lib/utils"
import { VersionTimeline } from "@/components/version-timeline"
import { toast } from "sonner"
import { ImprovementDialog } from "@/components/improvement-dialog"
import { AccordionInput } from "@/components/analysis/accordion-input"
import { ValidationReport } from "@/components/analysis/validation-report"
import { useLayer } from "@/lib/layer-context"

export default function AnalysisDetailPage() {
    return <AnalysisDetailContent />
}

function AnalysisDetailContent() {
    const params = useParams()
    const id = params?.id as string
    const router = useRouter()
    const { user, token, isLoading: authLoading } = useAuth()
    const { setLayer, updateValidationStatus, unlockAndNavigate } = useLayer()

    const [analysis, setAnalysis] = useState<Analysis | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [loadingMessage, setLoadingMessage] = useState("Loading analysis details...")
    const [error, setError] = useState("")
    const [isDiagramEditing, setIsDiagramEditing] = useState(false)
    const [isImproveDialogOpen, setIsImproveDialogOpen] = useState(false)
    const [isFinalizing, setIsFinalizing] = useState(false)
    const [isValidating, setIsValidating] = useState(false)
    const [validationIssues, setValidationIssues] = useState<any[]>([]);

    // Draft State
    const [draftData, setDraftData] = useState<any>(null)

    const fetchAnalysis = async (analysisId: string) => {
        try {
            if (!analysis) setLoadingMessage("Loading project...")

            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze/${analysisId}`, {
                cache: 'no-store',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Pragma': 'no-cache'
                }
            })

            if (!response.ok) throw new Error("Failed to load analysis");

            const data = await response.json()
            setAnalysis(data)

            // Layer Synchronization from Metadata
            const status = data.metadata?.status;
            if (status === 'DRAFT') {
                unlockAndNavigate(1);
                setDraftData(data.metadata?.draftData || {});
            } else if (status === 'VALIDATING' || status === 'VALIDATED' || status === 'NEEDS_FIX') {
                unlockAndNavigate(2);
                setDraftData(data.metadata?.draftData || {}); // Keep draft data loaded if back nav needed
                setValidationIssues(data.metadata?.validationResult?.issues || []);
            } else if (status === 'COMPLETED') {
                // Ensure we unlock up to 3 first, then check specialized states
                if (data.isFinalized) {
                    unlockAndNavigate(5);
                } else {
                    unlockAndNavigate(3);
                }
            } else {
                unlockAndNavigate(3);
            }

        } catch (err) {
            console.error("Error fetching analysis:", err)
            setError(err instanceof Error ? err.message : "Failed to load analysis")
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/auth/login")
            return
        }

        if (user && token && id) {
            fetchAnalysis(id)
        }
    }, [user, token, id, authLoading, router])

    const handleRefresh = () => {
        if (id) fetchAnalysis(id)
    }

    const handleDraftUpdate = useCallback((section: string, field: string, value: string) => {
        setDraftData((prev: any) => {
            const newData = { ...prev };
            if (!newData[section]) newData[section] = {};
            if (!newData[section][field]) newData[section][field] = {};
            newData[section][field].content = value;
            return newData;
        });
    }, []);

    const handleSaveDraft = async () => {
        if (!id || !draftData) return;
        try {
            toast.success("Draft saved locally");
            // Add backend PUT logic if needed
        } catch (e) { toast.error("Failed to save draft"); }
    }

    const handleRunValidation = async () => {
        setIsValidating(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze/${id}/validate`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Validation failed");

            const result = await res.json();
            setValidationIssues(result.issues || []);
            handleRefresh();
            toast.success("Validation Complete");
        } catch (e) {
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
        } catch (e) { }
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
                fetchAnalysis(id);
            } else {
                throw new Error("Failed to finalize");
            }
        } catch (error) {
            toast.error("Could not finalize SRS");
        } finally {
            setIsFinalizing(false);
        }
    };

    if (authLoading || isLoading) {
        return (
            <div className="flex h-[calc(100vh-64px)] items-center justify-center p-8 bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">{loadingMessage}</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="h-[calc(100vh-64px)] flex flex-col">
                <div className="flex-1 flex items-center justify-center p-8 text-center text-destructive">
                    <div>
                        <h2 className="text-xl font-bold mb-2">Error Loading Project</h2>
                        <p>{error}</p>
                        <Button className="mt-4" onClick={() => router.push('/analysis')}>Back to Projects</Button>
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
                        data={draftData || {}}
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

                                        {(analysis as any)?.metadata?.optimized && (
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
                                                    <SheetContent className="w-[400px] sm:w-[540px] p-0">
                                                        <SheetHeader className="px-6 py-4 border-b">
                                                            <SheetTitle>Project History</SheetTitle>
                                                        </SheetHeader>
                                                        <div className="h-full pb-20">
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
                                    >
                                        <Sparkles className="h-4 w-4 text-amber-500" />
                                        Improve SRS
                                    </Button>

                                    {/* Layer 5: Finalize */}
                                    <Button
                                        onClick={handleFinalize}
                                        variant={((analysis as any)?.isFinalized) ? "outline" : "default"}
                                        className={cn(
                                            "gap-2 transition-all",
                                            ((analysis as any)?.isFinalized)
                                                ? "border-green-500/30 text-green-600 bg-green-500/5 hover:bg-green-500/10"
                                                : "bg-primary hover:bg-primary/90"
                                        )}
                                        disabled={isFinalizing || (analysis as any)?.isFinalized}
                                    >
                                        {isFinalizing ? <Loader2 className="h-4 w-4 animate-spin" /> :
                                            (analysis as any)?.isFinalized ? (
                                                <>
                                                    <Database className="h-4 w-4" />
                                                    Finalized
                                                </>
                                            ) : "Finalize & Save"}
                                    </Button>

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
