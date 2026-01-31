"use client"

import { useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import useSWR from "swr";
import { fetcher, swrOptions } from "@/lib/swr-utils";

import { AnalysisHistory } from "@/components/analysis-history"
import { Loader2 } from "lucide-react"

// Import the type from the component
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
    const { user, token, csrfToken, isLoading: authLoading } = useAuth()

    const swrKey = useMemo(() => {
        if (!token || authLoading) return null;
        return [`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze`, token, csrfToken];
    }, [token, csrfToken, authLoading]);

    const { data: historyData, error, isValidating } = useSWR<AnalysisHistoryItem[]>(
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
            <div className="h-full flex flex-col items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground">Loading your analyses...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col container mx-auto px-4 sm:px-6 py-12">
            <div className="max-w-5xl mx-auto space-y-8 w-full">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold tracking-tight">My Analysis</h1>
                    <p className="text-muted-foreground">
                        View and manage your previous requirements analyses.
                    </p>
                </div>

                <AnalysisHistory items={history} />
            </div>
        </div>
    )
}
