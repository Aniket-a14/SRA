"use client"

import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    return (
        <html>
            <body>
                <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 mb-8">
                        <AlertCircle className="h-10 w-10 text-destructive" />
                    </div>

                    <h1 className="text-3xl font-bold tracking-tight mb-4">
                        Critical Error
                    </h1>

                    <p className="text-muted-foreground max-w-md mb-8">
                        A critical system error prevented the application from loading.
                    </p>

                    <div className="bg-muted p-4 rounded-md mb-8 text-left w-full max-w-md overflow-auto max-h-40">
                        <code className="text-xs font-mono">{error.message}</code>
                    </div>

                    <Button onClick={() => reset()} size="lg">
                        Try Again
                    </Button>
                </div>
            </body>
        </html>
    )
}
