"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { ResultsTabs } from "@/components/results-tabs"
import { Button } from "@/components/ui/button"
import { Loader2, ArrowLeft, Calendar, Download } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ProjectChatPanel } from "@/components/project-chat-panel"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { generateSRS, generateAPI, downloadBundle } from "@/lib/export-utils"
import { saveAs } from "file-saver"
import type { AnalysisResult } from "@/types/analysis"

import { toast } from "sonner"

interface AnalysisDetail {
    id: string
    createdAt: string
    inputText: string
    resultJson: AnalysisResult
}

export default function AnalysisDetailPage() {
    return <AnalysisDetailContent />
}

import { useParams } from "next/navigation"

function AnalysisDetailContent() {
    const params = useParams()
    const id = params?.id as string
    const router = useRouter()
    const { user, token, isLoading: authLoading } = useAuth()
    const [analysis, setAnalysis] = useState<AnalysisDetail | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState("")

    useEffect(() => {
        const fetchAnalysis = async (analysisId: string) => {
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze/${analysisId}`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                })

                if (!response.ok) {
                    if (response.status === 404) throw new Error("Analysis not found")
                    if (response.status === 403) throw new Error("Unauthorized access")
                    throw new Error("Failed to load analysis")
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
                        <p className="text-muted-foreground">Loading analysis details...</p>
                    </div>
                </main>
                <Footer />
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen flex flex-col">
                <Navbar />
                <main className="flex-1 container mx-auto px-4 py-12 flex flex-col items-center justify-center text-center">
                    <h2 className="text-2xl font-bold mb-4">Error</h2>
                    <p className="text-muted-foreground mb-6">{error}</p>
                    <Button onClick={() => router.push("/analysis")}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to History
                    </Button>
                </main>
                <Footer />
            </div>
        )
    }

    return (
        <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1">
                <div className="bg-muted/30 border-b border-border">
                    <div className="container mx-auto px-4 sm:px-6 py-8">
                        <Button
                            variant="ghost"
                            className="mb-4 pl-0 hover:pl-2 transition-all"
                            onClick={() => router.push("/analysis")}
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to History
                        </Button>

                        <div className="flex flex-col gap-4">
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Analysis Result</h1>

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
                                            if (analysis) {
                                                const doc = generateSRS(analysis as unknown as AnalysisResult, "SRS Report");
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
                                            if (analysis) {
                                                const md = generateAPI(analysis as unknown as AnalysisResult);
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
                                                await downloadBundle(analysis as unknown as AnalysisResult, "Project_Analysis");
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
                    <ResultsTabs data={analysis as unknown as AnalysisResult} />
                )}
            </main>
            <ProjectChatPanel analysisId={id} onAnalysisUpdate={(newId) => router.push(`/analysis/${newId}`)} />
            <Footer />
        </div>
    )
}
