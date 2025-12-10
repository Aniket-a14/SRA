"use client"

import { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { ResultsTabs } from "@/components/results-tabs"
import { Button } from "@/components/ui/button"
import { Loader2, ArrowLeft, Calendar } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import type { AnalysisResult } from "@/types/analysis"

interface AnalysisDetail {
    id: string
    createdAt: string
    inputText: string
    resultJson: AnalysisResult
}

export default function AnalysisDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter()
    // React.use() to unwrap params in Next.js 15+ (if applicable, but safe to use await in async component or just standard params usage if not generic)
    // Since this is a client component, params is a promise in newer Next.js versions. 
    // However, simpler to use `useParams` for client components in most cases, 
    // but let's handle the prop as 'use' for safety or just useParams hook.
    // Actually, let's use the standard `useParams` hook which is cleanest for "use client".

    // Wait, if I use `useParams`, I don't need `params` prop.
    // Let's switch to useParams to avoid Promise issues with params prop in client components.

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
        if (!authLoading && !user) {
            router.push("/auth/login")
            return
        }

        if (user && token && id) {
            fetchAnalysis(id)
        }
    }, [user, token, id, authLoading, router])

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
                    </div>
                </div>

                {analysis?.resultJson && (
                    <ResultsTabs data={analysis.resultJson} />
                )}
            </main>
            <Footer />
        </div>
    )
}
