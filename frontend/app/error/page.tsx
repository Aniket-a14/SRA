"use client"

import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { AlertTriangle, ArrowLeft, RefreshCcw } from "lucide-react"

function ErrorContent() {
    const searchParams = useSearchParams()
    const error = searchParams.get("message") || "An unexpected error occurred."

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
            <div className="absolute inset-0 -z-10 overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-destructive/5 rounded-full blur-3xl animate-float" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-destructive/10 rounded-full blur-3xl animate-float delay-500" />
            </div>

            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 mb-8 animate-fade-up">
                <AlertTriangle className="h-10 w-10 text-destructive" />
            </div>

            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 animate-fade-up delay-100">
                Something went wrong
            </h1>

            <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full mb-8 animate-fade-up delay-200 shadow-sm">
                <p className="text-sm font-mono text-destructive break-words">{error}</p>
            </div>

            <p className="text-muted-foreground max-w-md mb-8 animate-fade-up delay-300">
                We apologize for the inconvenience. Our team has been notified and we are working on a fix. Please try again later.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 animate-fade-up delay-400">
                <Button asChild variant="outline" size="lg" className="gap-2">
                    <Link href="/">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Home
                    </Link>
                </Button>
                <Button asChild size="lg" className="gap-2">
                    <Link href="/">
                        <RefreshCcw className="h-4 w-4" />
                        Try Again
                    </Link>
                </Button>
            </div>
        </div>
    )
}

export default function ErrorPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ErrorContent />
        </Suspense>
    )
}
