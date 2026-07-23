"use client"

import { useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import useSWR from "swr";
import { fetcher, swrOptions } from "@/lib/swr-utils";

import { AnalysisHistory } from "@/components/analysis-history"
import { Loader2 } from "lucide-react"

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
            <div className="h-full flex flex-col items-center justify-center py-24">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <p className="text-muted-foreground text-sm">Loading your analyses...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-5xl mx-auto px-6 lg:px-12 py-12">
            <div className="flex flex-col gap-2 mb-8">
                <h1 className="text-3xl lg:text-4xl font-display tracking-tight">My Analyses</h1>
                <p className="text-muted-foreground">
                    View and manage your previous requirements analyses.
                </p>
            </div>

            <AnalysisHistory items={history} />
        </div>
    )
}
