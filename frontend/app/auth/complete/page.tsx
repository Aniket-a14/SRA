"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

// Lands here after an OAuth (Google/GitHub) redirect. The backend hands us a short-lived,
// single-use exchange code instead of live tokens in the URL — we trade it for the real
// access token here. The refresh token is set directly as an httpOnly cookie by the
// exchange endpoint and never touches this page's JS.
function AuthCompleteContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { authenticateWithToken } = useAuth()
    const [error, setError] = useState<string | null>(null)
    const hasRun = useRef(false)

    useEffect(() => {
        if (hasRun.current) return
        hasRun.current = true

        const code = searchParams.get("code")
        if (!code) {
            // Defer to a microtask — calling setState synchronously in the effect body
            // (as opposed to inside the fetch callbacks below) trips react-hooks/set-state-in-effect.
            Promise.resolve().then(() => setError("Missing authorization code"))
            return
        }

        fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/exchange`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
        })
            .then(async (res) => {
                const data = await res.json()
                if (!res.ok) throw new Error(data.error || data.message || "Sign-in failed")
                await authenticateWithToken(data.token)
            })
            .catch((err) => {
                toast.error(err instanceof Error ? err.message : "Sign-in failed")
                setError(err instanceof Error ? err.message : "Sign-in failed")
                setTimeout(() => router.push("/auth/login"), 1500)
            })
    }, [searchParams, authenticateWithToken, router])

    return (
        <div className="flex min-h-screen items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
                {error ? (
                    <p className="text-sm">{error} — redirecting to login…</p>
                ) : (
                    <>
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <p className="text-sm">Signing you in…</p>
                    </>
                )}
            </div>
        </div>
    )
}

export default function AuthCompletePage() {
    return (
        <Suspense fallback={
            <div className="flex min-h-screen items-center justify-center bg-background">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        }>
            <AuthCompleteContent />
        </Suspense>
    )
}
