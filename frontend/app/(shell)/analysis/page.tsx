"use client"

import { useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import useSWR from "swr";
import { fetcher, swrOptions } from "@/lib/swr-utils";

import { AnalysisHistory } from "@/components/analysis-history"
import { Skeleton } from "@/components/ui/skeleton"

type AnalysisHistoryItem = {
    id: string
    createdAt: string
    inputText: string
    inputPreview: string
    version?: number
    title?: string
}

export default function AnalysisPage() {
    const router = useRouter()
    const { user, token, isLoading: authLoading } = useAuth()

    const swrKey = useMemo(() => {
        if (!token || authLoading) return null;
        return [`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze`, token];
    }, [token, authLoading]);

    const { data: historyData, error } = useSWR<AnalysisHistoryItem[]>(
        swrKey,
        fetcher,
        swrOptions
    );

    const history = Array.isArray(historyData) ? historyData : [];
    const isLoading = authLoading || (!historyData && !error);

    useEffect(() => {
        if (!authLoading && (!user || !token)) {
            router.push("/auth/login")
        }
    }, [user, token, authLoading, router])

    if (authLoading || isLoading) {
        return (
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-12">
                <div className="flex flex-col gap-2 mb-8">
                    <Skeleton className="h-9 w-56" />
                    <Skeleton className="h-4 w-72" />
                </div>
                <div className="relative border-l-2 border-muted ml-3 md:ml-6 space-y-6 pl-6 md:pl-10 py-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="rounded-xl border border-border/50 bg-card/40 p-5 space-y-3">
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-6 w-10 rounded-full" />
                                <Skeleton className="h-5 w-1/2" />
                            </div>
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-4/5" />
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-12">
            <div className="flex flex-col gap-2 mb-8">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-display tracking-tight">My Analyses</h1>
                <p className="text-muted-foreground">
                    View and manage your previous requirements analyses.
                </p>
            </div>

            <AnalysisHistory items={history} />
        </div>
    )
}
