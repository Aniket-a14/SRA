"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Sparkles, ArrowLeft } from "lucide-react"

export default function ComingSoonPage() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
            <div className="absolute inset-0 -z-10 overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-float" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float delay-500" />
            </div>

            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary mb-8 animate-fade-up">
                <Sparkles className="h-8 w-8 text-primary-foreground" />
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6 animate-fade-up delay-100">
                Coming <span className="text-primary">Soon</span>
            </h1>

            <p className="text-lg text-muted-foreground max-w-md mb-8 animate-fade-up delay-200">
                We're working hard to bring you this feature. Stay tuned for updates!
            </p>

            <div className="animate-fade-up delay-300">
                <Button asChild size="lg" className="gap-2">
                    <Link href="/">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Home
                    </Link>
                </Button>
            </div>
        </div>
    )
}
