"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { VersionDiffViewer } from "@/components/version-diff-viewer"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

function CompareSkeleton() {
    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-12">
            <Skeleton className="h-8 w-40 mb-6" />
            <div className="grid gap-4 md:grid-cols-2">
                {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-border p-5 space-y-3">
                        <Skeleton className="h-5 w-1/3" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-11/12" />
                        <Skeleton className="h-4 w-4/5" />
                    </div>
                ))}
            </div>
        </div>
    )
}

export default function ComparePage() {
    return (
        <Suspense fallback={<CompareSkeleton />}>
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

                const json = await response.json()
                // Unwrap the { success, message, data } envelope — passing the raw
                // envelope to VersionDiffViewer would make it diff `success`/`message`
                // keys instead of the real section changes.
                setDiff(json?.data ?? json)
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
        return <CompareSkeleton />
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
