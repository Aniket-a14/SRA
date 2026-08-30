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
import { Download, Sparkles, Database, Loader2, X, History, Zap, Activity, Network } from "lucide-react"
import dynamic from "next/dynamic"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { downloadBundle } from "@/lib/export-utils"
import {
    exportSrsToDocx,
    exportSrsToMarkdown,
    exportSrsToLatex,
    openInOverleaf,
    exportSrsToTypst,
    listFormats
} from "@/lib/srs-export"
import { PrintCoverPage } from "@/components/analysis/print-cover-page"
import { updateAnalysis } from "@/lib/analysis-api"
import type { Analysis, SystemFeature } from "@/types/analysis"
import { ErrorBoundary } from "@/components/error-boundary"
import { SourcesPanel } from "@/components/analysis/sources-panel"
import { CliTraceabilityPanel } from "@/components/analysis/cli-traceability-panel"
import { FormatResults } from "@/components/analysis/format-results"
import { getFormatSpec, resolveFormatId } from "@/lib/formats"
import { TaskInspectorDialog } from "@/components/analysis/task-inspector-dialog"
import { DFDGenerationDialog } from "@/components/analysis/dfd-generation-dialog"
import * as React from "react"

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
    onOpenChat?: () => void
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
    const [isInspectorOpen, setIsInspectorOpen] = React.useState(false)
    const [isDfdOpen, setIsDfdOpen] = React.useState(false)

    return (
        <div className={cn("flex flex-col h-full bg-background", className)}>
            {/* Toolbar — every action here operates on the document itself, so it lives
                with the document rather than in the outer page chrome. */}
            <div className="border-b border-foreground/10 px-4 sm:px-6 py-1.5 flex items-center justify-between gap-3 shrink-0 bg-muted/5">
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1.5 border-foreground/20 hover:bg-foreground/5 rounded-full"
                        onClick={() => setIsDfdOpen(true)}
                    >
                        <Network className="h-3.5 w-3.5 text-indigo-500" />
                        <span>Generate DFD</span>
                    </Button>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsInspectorOpen(true)}
                        aria-label="Execution Inspector"
                        title="Task & Execution Inspector"
                    >
                        <Activity className="h-4 w-4 text-emerald-500" />
                    </Button>

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
                                <DropdownMenuSubTrigger>Export SRS (Word .docx)</DropdownMenuSubTrigger>
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
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger>Export SRS (Markdown .md)</DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                    <DropdownMenuLabel className="text-xs text-muted-foreground">Choose a standard</DropdownMenuLabel>
                                    {listFormats().map((fmt) => (
                                        <DropdownMenuItem
                                            key={fmt.id}
                                            onClick={async () => {
                                                try {
                                                    const { saveAs } = await import("file-saver");
                                                    const projectTitle = analysis.projectTitle || analysis.title || "Project_Context";
                                                    const { text, filename } = exportSrsToMarkdown(analysis, projectTitle, fmt.id);
                                                    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
                                                    saveAs(blob, filename);
                                                    toast.success(`${fmt.name} Markdown downloaded`);
                                                } catch (err) {
                                                    console.error("SRS Markdown Export Failed", err);
                                                    toast.error("Failed to generate Markdown document");
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
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger>Export LaTeX (.tex)</DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                    <DropdownMenuLabel className="text-xs text-muted-foreground">Choose a standard</DropdownMenuLabel>
                                    {listFormats().map((fmt) => (
                                        <DropdownMenuItem
                                            key={fmt.id}
                                            onClick={async () => {
                                                try {
                                                    const { saveAs } = await import("file-saver");
                                                    const projectTitle = analysis.projectTitle || analysis.title || "Project_Context";
                                                    const { tex, filename } = exportSrsToLatex(analysis, projectTitle, fmt.id);
                                                    const blob = new Blob([tex], { type: "application/x-tex;charset=utf-8" });
                                                    saveAs(blob, filename);
                                                    toast.success(`${fmt.name} LaTeX (.tex) downloaded`);
                                                } catch (err) {
                                                    console.error("LaTeX Export Failed", err);
                                                    toast.error("Failed to generate LaTeX document");
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
                            <DropdownMenuItem
                                onClick={() => {
                                    try {
                                        const projectTitle = analysis.projectTitle || analysis.title || "Project_Context";
                                        const { tex, filename } = exportSrsToLatex(analysis, projectTitle);
                                        openInOverleaf(tex, filename);
                                        toast.success("Opening project in Overleaf...");
                                    } catch (err) {
                                        console.error("Overleaf launch failed", err);
                                        toast.error("Failed to open project in Overleaf");
                                    }
                                }}
                            >
                                Open in Overleaf ↗
                            </DropdownMenuItem>
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger>Export Typst (.typ)</DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                    <DropdownMenuLabel className="text-xs text-muted-foreground">Choose a standard</DropdownMenuLabel>
                                    {listFormats().map((fmt) => (
                                        <DropdownMenuItem
                                            key={fmt.id}
                                            onClick={async () => {
                                                try {
                                                    const { saveAs } = await import("file-saver");
                                                    const projectTitle = analysis.projectTitle || analysis.title || "Project_Context";
                                                    const { typ, filename } = exportSrsToTypst(analysis, projectTitle, fmt.id);
                                                    const blob = new Blob([typ], { type: "text/plain;charset=utf-8" });
                                                    saveAs(blob, filename);
                                                    toast.success(`${fmt.name} Typst downloaded`);
                                                } catch (err) {
                                                    console.error("Typst Export Failed", err);
                                                    toast.error("Failed to generate Typst document");
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
                            <DropdownMenuItem onClick={() => {
                                window.print();
                            }}>
                                Print / Executive PDF
                            </DropdownMenuItem>
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
                                Download Complete Bundle (.zip)
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
                <div className="flex flex-col gap-2 w-full max-w-5xl mx-auto">
                    {/* Print-only executive cover page */}
                    <PrintCoverPage analysis={analysis} title={analysis.projectTitle || analysis.title} />

                    {analysis.metadata?.ragSources && analysis.metadata.ragSources.length > 0 && (
                        <div className="px-4 sm:px-6 pt-2">
                            <SourcesPanel sources={analysis.metadata.ragSources} />
                        </div>
                    )}
                    {analysis.metadata?.cliTraceability?.groups && analysis.metadata.cliTraceability.groups.length > 0 && (
                        <div id="cli-traceability-section" className="px-4 sm:px-6">
                            <CliTraceabilityPanel traceability={analysis.metadata.cliTraceability} />
                        </div>
                    )}
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

            {/* Task & Manufacturing Execution Inspector */}
            <TaskInspectorDialog
                analysis={analysis}
                open={isInspectorOpen}
                onOpenChange={setIsInspectorOpen}
            />

            {/* DFD Generator Dialog */}
            <DFDGenerationDialog
                projectName={analysis.projectTitle || analysis.title || "Specification"}
                description={analysis.inputText || ""}
                srsContent={JSON.stringify(analysis.resultJson)}
                open={isDfdOpen}
                onOpenChange={setIsDfdOpen}
                trigger={null}
            />
        </div>
    )
}
