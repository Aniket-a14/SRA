"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Navbar } from "@/components/navbar"
import { VersionDiffViewer } from "@/components/version-diff-viewer"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2 } from "lucide-react"

export default function ComparePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex flex-col">
                <Navbar />
                <main className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </main>
            </div>
        }>
            <CompareContent />
        </Suspense>
    )
}

function CompareContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const v1 = searchParams.get("v1")
    const v2 = searchParams.get("v2")
    const { token, isLoading: authLoading } = useAuth()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [diff, setDiff] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState("")

    useEffect(() => {
        const fetchDiff = async () => {
            if (!v1 || !v2 || !token) return
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze/diff/${v1}/${v2}`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                })

                if (!response.ok) {
                    throw new Error("Failed to fetch diff")
                }

                const data = await response.json()
                setDiff(data)
            } catch (err) {
                console.error("Error fetching diff:", err)
                setError("Failed to load comparison. Ensure you have access to both versions.")
            } finally {
                setIsLoading(false)
            }
        }

        if (authLoading) return;

        if (!token) {
            setIsLoading(false);
            router.push("/auth/login");
            return;
        }

        if (v1 && v2) {
            fetchDiff()
        } else {
            setError("Missing version IDs to compare.")
            setIsLoading(false)
        }
    }, [v1, v2, token, authLoading, router])

    if (authLoading || isLoading) {
        return (
            <div className="min-h-screen flex flex-col">
                <Navbar />
                <main className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </main>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1 container mx-auto px-4 py-8">
                <div className="mb-6 flex items-center gap-4">
                    <Button variant="ghost" onClick={() => router.back()}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                    </Button>
                    <h1 className="text-2xl font-bold">Version Comparison</h1>
                </div>

                {error ? (
                    <div className="p-8 text-center border rounded-lg bg-destructive/10 text-destructive">
                        {error}
                    </div>
                ) : (
                    <div className="bg-card border rounded-lg p-6 shadow-sm">
                        <div className="mb-6 flex items-center justify-between border-b pb-4">
                            <div className="flex flex-col">
                                <span className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Comparing</span>
                                <span className="font-mono text-xs text-muted-foreground">{v1} <span className="mx-2 text-foreground">vs</span> {v2}</span>
                            </div>
                        </div>
                        {diff && <VersionDiffViewer diff={diff} />}
                    </div>
                )}
            </main>

        </div>
    )
}
