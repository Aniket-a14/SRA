"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { AnalysisHistory } from "@/components/analysis-history"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

export default function AnalysisPage() {
    const router = useRouter()
    const { user, token, isLoading: authLoading } = useAuth()
    const [history, setHistory] = useState([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/analyze`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                })

                if (!response.ok) {
                    throw new Error("Failed to fetch analysis history")
                }

                const data = await response.json()
                setHistory(data)
            } catch (err) {
                console.error("Error fetching history:", err)
                toast.error("Failed to load your analysis history. Please try again later.")
            } finally {
                setIsLoading(false)
            }
        }

        // If auth is done loading and no user, redirect
        if (!authLoading && !user) {
            router.push("/auth/login")
            return
        }

        if (user && token) {
            fetchHistory()
        }
    }, [user, token, authLoading, router])

    if (authLoading || isLoading) {
        return (
            <div className="min-h-screen flex flex-col">
                <Navbar />
                <main className="flex-1 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-muted-foreground">Loading your analyses...</p>
                    </div>
                </main>
                <Footer />
            </div>
        )
    }

    return (
        <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1 container mx-auto px-4 sm:px-6 py-12">
                <div className="max-w-5xl mx-auto space-y-8">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-3xl font-bold tracking-tight">My Analysis</h1>
                        <p className="text-muted-foreground">
                            View and manage your previous requirements analyses.
                        </p>
                    </div>

                    {/* Optimized render: Removed inline error div as we use Toast now */}
                    <AnalysisHistory items={history} />
                </div>
            </main>
            <Footer />
        </div>
    )
}
