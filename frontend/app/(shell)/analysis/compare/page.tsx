"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { VersionDiffViewer } from "@/components/version-diff-viewer"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2 } from "lucide-react"

export default function ComparePage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center py-24">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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

    const [diff, setDiff] = useState<unknown>(null)
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
            Promise.resolve().then(() => setIsLoading(false));
            router.push("/auth/login");
            return;
        }

        if (v1 && v2) {
            fetchDiff()
        } else {
            Promise.resolve().then(() => {
                setError("Missing version IDs to compare.")
                setIsLoading(false)
            });
        }
    }, [v1, v2, token, authLoading, router])

    if (authLoading || isLoading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="max-w-5xl mx-auto px-6 lg:px-12 py-12">
            <div className="mb-6 flex items-center gap-4">
                <Button variant="ghost" onClick={() => router.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                </Button>
                <h1 className="text-2xl font-display">Version comparison</h1>
            </div>

            {error ? (
                <div className="p-8 text-center border border-destructive/20 bg-destructive/5 text-destructive">
                    {error}
                </div>
            ) : (
                <div className="border border-foreground/10 p-6">
                    <div className="mb-6 flex items-center justify-between border-b border-foreground/10 pb-4">
                        <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Comparing</span>
                            <span className="font-mono text-xs text-muted-foreground">{v1} <span className="mx-2 text-foreground">vs</span> {v2}</span>
                        </div>
                    </div>
                    {!!diff && <VersionDiffViewer diff={diff} />}
                </div>
            )}
        </div>
    )
}
