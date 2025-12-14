"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Navbar } from "@/components/navbar"
import { ResultsTabs } from "@/components/results-tabs"
import { Button } from "@/components/ui/button"
import { Loader2, ArrowLeft, Calendar, Download } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ProjectChatPanel } from "@/components/project-chat-panel"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { generateSRS, generateAPI, downloadBundle } from "@/lib/export-utils"
import { saveAs } from "file-saver"
import type { Analysis } from "@/types/analysis"
import { VersionTimeline } from "@/components/version-timeline"
import { toast } from "sonner"

export default function AnalysisDetailPage() {
    return <AnalysisDetailContent />
}

function AnalysisDetailContent() {
    const params = useParams()
    const id = params?.id as string
    const router = useRouter()
    const { user, token, isLoading: authLoading } = useAuth()
    const [analysis, setAnalysis] = useState<Analysis | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [loadingMessage, setLoadingMessage] = useState("Loading analysis details...")
    const [error, setError] = useState("")

    useEffect(() => {
        const fetchAnalysis = async (analysisId: string) => {
            try {
                setLoadingMessage("Fetching analysis data...")
                const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze/${analysisId}`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                })

                if (!response.ok) {
                    let errMsg = "Failed to load analysis";
                    try {
                        const errData = await response.json();
                        errMsg = errData.error || errData.message || errMsg;
                    } catch { }

                    if (response.status === 404) throw new Error(errMsg || "Analysis not found");
                    if (response.status === 403) throw new Error(errMsg || "Unauthorized access");
                    throw new Error(errMsg);
                }

                const data = await response.json()
                setAnalysis(data)
            } catch (err) {
                console.error("Error fetching analysis:", err)
                setError(err instanceof Error ? err.message : "Failed to load analysis")
            } finally {
                setIsLoading(false)
            }
        }

        if (!authLoading && !user) {
            router.push("/auth/login")
            return
        }

        if (user && token && id) {
            fetchAnalysis(id)
        }
    }, [user, token, id, authLoading, router])

    if (authLoading || isLoading) {
        return (
            <div className="min-h-screen flex flex-col">
                <Navbar />
                <main className="flex-1 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-muted-foreground">{authLoading ? "Verifying session..." : loadingMessage}</p>
                    </div>
                </main>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen flex flex-col">
                <Navbar />
                <main className="flex-1 container mx-auto px-4 py-12 flex flex-col items-center justify-center text-center">
                    <h2 className="text-2xl font-bold mb-4 text-destructive">Unable to Load Analysis</h2>
                    <p className="text-muted-foreground mb-6 max-w-md">{error}</p>
                    <div className="flex gap-4">
                        <Button variant="outline" onClick={() => window.location.reload()}>
                            Retry
                        </Button>
                        <Button onClick={() => router.push("/analysis")}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to History
                        </Button>
                    </div>
                </main>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex flex-col">
            <Navbar />

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                {/* Timeline Sidebar - Only if rootId exists */}
                {analysis?.rootId && (
                    <aside className="hidden md:block w-72 border-r bg-muted/10 h-[calc(100vh-64px)] overflow-y-auto">
                        <VersionTimeline rootId={analysis.rootId} currentId={id} />
                    </aside>
                )}

                <main className="flex-1 overflow-auto h-[calc(100vh-64px)]">
                    <div className="bg-muted/30 border-b border-border">
                        <div className="container mx-auto px-4 sm:px-6 py-8">
                            <Button
                                variant="ghost"
                                className="mb-4 pl-0 hover:pl-2 transition-all"
                                onClick={() => router.push("/analysis")}
                            >
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to All Analyses
                            </Button>

                            <div className="flex flex-col gap-4">
                                <div className="flex items-center gap-3">
                                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                                        {analysis?.title || "Analysis Result"}
                                    </h1>
                                    {analysis?.version && (
                                        <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full font-medium">
                                            v{analysis.version}
                                        </span>
                                    )}
                                </div>


                                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4" />
                                        <span>
                                            {analysis?.createdAt && formatDistanceToNow(new Date(analysis.createdAt), { addSuffix: true })}
                                        </span>
                                    </div>
                                    <div className="h-4 w-px bg-border hidden sm:block" />
                                    <div className="max-w-xl truncate">
                                        Input: <span className="font-medium text-foreground">{analysis?.inputText}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 flex gap-2">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" className="gap-2">
                                            <Download className="h-4 w-4" />
                                            Export
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start">
                                        <DropdownMenuItem onClick={() => {
                                            try {
                                                if (analysis && analysis.resultJson) {
                                                    const doc = generateSRS(analysis.resultJson, "SRS Report");
                                                    doc.save("SRS_Report.pdf");
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
                                                if (analysis && analysis.resultJson) {
                                                    const md = generateAPI(analysis.resultJson);
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
                                                if (analysis && analysis.resultJson) {
                                                    toast.info("Generating bundle...");
                                                    await downloadBundle(analysis.resultJson, "Project_Analysis");
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
                            <p className="text-xs text-muted-foreground mb-2">Debug Info: Data Present</p>
                            <ResultsTabs data={analysis} />
                        </div>
                    )}
                </main>
            </div>

            <ProjectChatPanel analysisId={id} onAnalysisUpdate={(newId) => router.push(`/analysis/${newId}`)} />

        </div>
    )
}
