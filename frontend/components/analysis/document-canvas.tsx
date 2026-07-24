"use client"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
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
import { Download, Sparkles, Database, Loader2, X, History, Zap } from "lucide-react"
import dynamic from "next/dynamic"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { downloadBundle } from "@/lib/export-utils"
import { exportSrsToDocx, listFormats } from "@/lib/srs-export"
import { updateAnalysis } from "@/lib/analysis-api"
import type { Analysis, SystemFeature } from "@/types/analysis"
import { ErrorBoundary } from "@/components/error-boundary"
import { SourcesPanel } from "@/components/analysis/sources-panel"
import { FormatResults } from "@/components/analysis/format-results"
import { getFormatSpec, resolveFormatId } from "@/lib/formats"

const ResultsTabs = dynamic(() => import("@/components/results-tabs").then(mod => mod.ResultsTabs), {
    loading: () => <div className="h-[600px] w-full bg-muted/5 animate-pulse" />
})
const VersionTimeline = dynamic(() => import("@/components/version-timeline").then(mod => mod.VersionTimeline), {
    loading: () => <div className="h-20 w-full bg-muted/5 animate-pulse" />
})
const RecyclingPanel = dynamic(() => import("@/components/analysis/recycling-panel").then(mod => mod.RecyclingPanel))

interface DocumentCanvasProps {
    analysis: Analysis
    analysisId: string
    token: string
    onClose?: () => void
    onDiagramEditChange?: (isEditing: boolean) => void
    onRefresh?: () => void
    onNavigate: (id: string) => void
    isFinalizing: boolean
    onFinalize: () => void
    onImproveClick: () => void
    className?: string
}

export function DocumentCanvas({
    analysis,
    analysisId,
    token,
    onClose,
    onDiagramEditChange,
    onRefresh,
    onNavigate,
    isFinalizing,
    onFinalize,
    onImproveClick,
    className,
}: DocumentCanvasProps) {
    return (
        <div className={cn("flex flex-col h-full bg-background", className)}>
            {/* Toolbar — every action here operates on the document itself, so it lives
                with the document rather than in the outer page chrome. */}
            <div className="border-b border-foreground/10 px-4 py-3 flex items-center justify-between gap-3 shrink-0">
                <div className="min-w-0 flex items-center gap-2">
                    <span className="font-display text-lg truncate">
                        {analysis.projectTitle || analysis.title || "SRS Document"}
                    </span>
                    <span className="shrink-0 px-2 py-0.5 border border-foreground/10 text-xs font-mono">
                        v{analysis.version}
                    </span>
                    {analysis.metadata?.optimized && (
                        <span className="hidden sm:inline-flex shrink-0 px-2 py-0.5 bg-green-500/10 text-green-600 text-xs rounded-full border border-green-200 items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                            KB Optimized
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    {analysis.rootId && (
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" aria-label="Version history" title="Version history">
                                    <History className="h-4 w-4" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent className="w-[400px] sm:w-[540px] p-0 flex flex-col h-full">
                                <SheetHeader className="px-6 py-4 border-b shrink-0">
                                    <SheetTitle>Project History</SheetTitle>
                                </SheetHeader>
                                <div className="flex-1 min-h-0 overflow-hidden">
                                    <VersionTimeline
                                        rootId={analysis.rootId}
                                        currentId={analysisId}
                                        className="border-0 bg-transparent"
                                        hideHeader={true}
                                    />
                                </div>
                            </SheetContent>
                        </Sheet>
                    )}

                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={analysis.isFinalized} aria-label="Recycling" title="Knowledge recycling">
                                <Zap className="h-4 w-4 text-amber-500" />
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

                                        const updatedFeatures: SystemFeature[] = [...(analysis.systemFeatures || []), newFeature];

                                        const updatedData = await updateAnalysis(analysisId, token, {
                                            systemFeatures: updatedFeatures,
                                            skipAlignment: true,
                                        });

                                        toast.success("Requirement applied! Switching to new version...", { id: loadingToast });
                                        onNavigate(updatedData.data.id);
                                    } catch (e) {
                                        console.error(e);
                                        toast.error("Failed to apply requirement", { id: loadingToast });
                                    }
                                }}
                            />
                        </SheetContent>
                    </Sheet>

                    <Button variant="ghost" size="icon" onClick={onImproveClick} disabled={analysis.isFinalized} aria-label="Improve SRS" title="Improve SRS">
                        <Sparkles className="h-4 w-4 text-amber-500" />
                    </Button>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Export" title="Export">
                                <Download className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger>Export SRS (Word)</DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                    <DropdownMenuLabel className="text-xs text-muted-foreground">Choose a template</DropdownMenuLabel>
                                    {listFormats().map((fmt) => (
                                        <DropdownMenuItem
                                            key={fmt.id}
                                            onClick={async () => {
                                                const loading = toast.loading(`Generating ${fmt.name} document...`);
                                                try {
                                                    const { saveAs } = await import("file-saver");
                                                    const projectTitle = analysis.projectTitle || analysis.title || "Project_Context";
                                                    const { blob, filename } = await exportSrsToDocx(analysis, projectTitle, fmt.id);
                                                    saveAs(blob, filename);
                                                    toast.success(`${fmt.name} document downloaded`, { id: loading });
                                                } catch (err) {
                                                    console.error("SRS Word Export Failed", err);
                                                    toast.error("Failed to generate Word document", { id: loading });
                                                }
                                            }}
                                        >
                                            <div className="flex flex-col">
                                                <span>{fmt.name}</span>
                                                <span className="text-xs text-muted-foreground">{fmt.description}</span>
                                            </div>
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={async () => {
                                try {
                                    toast.info("Generating bundle...");
                                    await downloadBundle(analysis, "Project_Analysis");
                                    toast.success("Bundle downloaded successfully");
                                } catch (err) {
                                    console.error("Bundle Export Failed", err);
                                    toast.error("Failed to generate Download Bundle");
                                }
                            }}>
                                Download Bundle (.zip)
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                variant={analysis.isFinalized ? "outline" : "default"}
                                size="sm"
                                className={cn(
                                    "gap-2 rounded-full ml-1",
                                    analysis.isFinalized
                                        ? "border-green-500/30 text-green-600 bg-green-500/5 hover:bg-green-500/10"
                                        : "bg-foreground text-background hover:bg-foreground/90"
                                )}
                                disabled={isFinalizing || analysis.isFinalized}
                            >
                                {isFinalizing ? <Loader2 className="h-4 w-4 animate-spin" /> :
                                    analysis.isFinalized ? (
                                        <>
                                            <Database className="h-4 w-4" />
                                            Finalized
                                        </>
                                    ) : "Finalize"}
                            </Button>
                        </AlertDialogTrigger>

                        {!analysis.isFinalized && (
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
                                    <AlertDialogAction onClick={onFinalize} className="bg-foreground hover:bg-foreground/90 text-background">
                                        Yes, finalize
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        )}
                    </AlertDialog>

                    {onClose && (
                        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close document">
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                <div className="flex flex-col gap-4 w-full max-w-5xl mx-auto">
                    <div className="px-4 sm:px-6 pt-4">
                        <SourcesPanel sources={analysis.metadata?.ragSources || []} />
                    </div>
                    <ErrorBoundary name="Results View">
                        {resolveFormatId(analysis) === "ieee830" ? (
                            <ResultsTabs
                                data={analysis}
                                onDiagramEditChange={onDiagramEditChange}
                                onRefresh={onRefresh}
                            />
                        ) : (
                            <FormatResults
                                spec={getFormatSpec(resolveFormatId(analysis))}
                                data={analysis as unknown as Record<string, unknown>}
                            />
                        )}
                    </ErrorBoundary>
                </div>
            </div>
        </div>
    )
}
