"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { useAuthFetch } from "@/lib/hooks"
import { Button } from "@/components/ui/button"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Download, ShieldOff } from "lucide-react"
import { toast } from "sonner"

/**
 * Self-service data rights: export (GDPR Art. 15/20) and erasure (Art. 17).
 *
 * These exist as UI, not just endpoints, because the privacy policy tells users they can do
 * both "from Settings". A policy that describes a control the product does not offer is a
 * misrepresentation, not a formality — so the page and the policy ship together.
 */
export function PrivacySettings() {
    const { logout } = useAuth()
    const authFetch = useAuthFetch()
    const [isExporting, setIsExporting] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    const handleExport = async () => {
        setIsExporting(true)
        try {
            const res = await authFetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/me/export`)
            if (!res.ok) {
                toast.error("Could not prepare your export. Please try again.")
                return
            }

            // Downloaded via a blob rather than by pointing the browser at the URL: the
            // endpoint is bearer-authenticated, and a plain navigation would send no
            // Authorization header.
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const link = document.createElement("a")
            link.href = url
            link.download = `sra-export-${new Date().toISOString().slice(0, 10)}.json`
            document.body.appendChild(link)
            link.click()
            link.remove()
            URL.revokeObjectURL(url)

            toast.success("Your data has been downloaded.")
        } catch {
            toast.error("Could not prepare your export. Please try again.")
        } finally {
            setIsExporting(false)
        }
    }

    const handleDelete = async () => {
        setIsDeleting(true)
        try {
            const res = await authFetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/me`, {
                method: "DELETE",
            })

            if (!res.ok) {
                const body = await res.json().catch(() => null)
                toast.error(body?.message || "Could not delete your account. Please try again.")
                return
            }

            toast.success("Account scheduled for deletion. Sign in within 30 days to restore it.")
            // The server has already revoked every session, so there is nothing left to
            // authenticate with — clear local state and leave.
            await logout()
        } catch {
            toast.error("Could not delete your account. Please try again.")
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <div className="border border-foreground/10 p-6">
            <h3 className="flex items-center gap-2 font-medium mb-1">
                <ShieldOff className="h-4 w-4" />
                Your data
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
                Take a copy of everything we hold about you, or close your account for good.
            </p>

            <div className="space-y-4">
                <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between p-4 border border-foreground/10">
                    <div className="space-y-1">
                        <div className="font-medium text-sm">Export your data</div>
                        <p className="text-xs text-muted-foreground max-w-md">
                            Downloads your profile, projects, analyses and chat history as JSON.
                            Stored API keys and session tokens are described but never included.
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto rounded-full"
                        onClick={handleExport}
                        disabled={isExporting}
                    >
                        <Download className="h-4 w-4 mr-2" />
                        {isExporting ? "Preparing…" : "Download"}
                    </Button>
                </div>

                <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between p-4 border border-destructive/30">
                    <div className="space-y-1">
                        <div className="font-medium text-sm">Delete your account</div>
                        <p className="text-xs text-muted-foreground max-w-md">
                            Signs you out everywhere immediately. Your data is permanently erased
                            after 30 days — sign in before then to change your mind.
                        </p>
                    </div>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                variant="destructive"
                                size="sm"
                                className="w-full sm:w-auto rounded-full"
                                disabled={isDeleting}
                            >
                                Delete account
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    You will be signed out of every device straight away and will not
                                    be able to use the account. After 30 days everything — your
                                    projects, analyses, chat history and stored provider keys — is
                                    permanently erased and cannot be recovered.
                                    <br />
                                    <br />
                                    If you want a copy of your work, export it first.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Keep my account</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDelete}>
                                    Delete my account
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>
        </div>
    )
}
