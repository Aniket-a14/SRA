"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/lib/auth-context"
import { useAuthFetch } from "@/lib/hooks"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
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
import { Key, Trash2, Copy, Check, Plus, AlertCircle } from "lucide-react"
import { formatRelative } from "@/lib/format-date"
import { toast } from "sonner"

interface ApiKey {
    id: string
    name: string
    createdAt: string
    lastUsed: string
    expiresAt: string | null
}

export function ApiKeyManager() {
    const { token } = useAuth()
    const authFetch = useAuthFetch()
    const [keys, setKeys] = useState<ApiKey[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [newKeyName, setNewKeyName] = useState("")
    const [generatedKey, setGeneratedKey] = useState<string | null>(null)
    const [isCopying, setIsCopying] = useState(false)

    const fetchKeys = useCallback(async (signal?: AbortSignal) => {
        try {
            const res = await authFetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/keys`, { signal })
            if (res.ok) {
                const data = await res.json()
                setKeys(data)
            }
        } catch (error: unknown) {
            if ((error as { name?: string })?.name === 'AbortError') return
            console.error(error)
            toast.error("Failed to fetch API keys")
        } finally {
            setIsLoading(false)
        }
    }, [authFetch])

    useEffect(() => {
        if (!token) return
        const controller = new AbortController()
        Promise.resolve().then(() => fetchKeys(controller.signal))
        return () => controller.abort()
    }, [token, fetchKeys])

    const createKey = async () => {
        if (!newKeyName.trim()) return

        try {
            const res = await authFetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/keys`, {
                method: "POST",
                body: JSON.stringify({ name: newKeyName })
            })

            if (res.ok) {
                const data = await res.json()
                setGeneratedKey(data.rawKey)
                setKeys(prev => [data, ...prev])
                setNewKeyName("")
                toast.success("API key created successfully")
            } else {
                toast.error("Failed to create API key")
            }
        } catch {
            toast.error("Error creating API key")
        }
    }

    const revokeKey = async (id: string) => {
        try {
            const res = await authFetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/keys/${id}`, {
                method: "DELETE"
            })

            if (res.ok) {
                setKeys(prev => prev.filter(k => k.id !== id))
                toast.success("API key revoked")
            } else {
                toast.error("Failed to revoke API key")
            }
        } catch {
            toast.error("Error revoking API key")
        }
    }

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text)
            setIsCopying(true)
            toast.success("Copied to clipboard")
            setTimeout(() => setIsCopying(false), 2000)
        } catch {
            toast.error("Failed to copy")
        }
    }

    const closeDialog = () => {
        setIsCreateOpen(false)
        setGeneratedKey(null)
        setNewKeyName("")
    }

    if (isLoading) return <div className="text-sm text-muted-foreground">Loading keys...</div>

    return (
        <div className="border border-foreground/10 p-6">
            <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                    <h3 className="flex items-center gap-2 font-medium mb-1">
                        <Key className="h-4 w-4" />
                        API keys
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Used by the sra CLI and other external tools to authenticate with the platform.
                    </p>
                </div>
                <Dialog open={isCreateOpen} onOpenChange={(open) => {
                    if (!open) closeDialog()
                    else setIsCreateOpen(true)
                }}>
                    <DialogTrigger asChild>
                        <Button size="sm" className="gap-2 rounded-full bg-foreground hover:bg-foreground/90 text-background shrink-0">
                            <Plus className="h-4 w-4" />
                            Create key
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Create API key</DialogTitle>
                            <DialogDescription>
                                Generate a new key for accessing the SRA API programmatically.
                            </DialogDescription>
                        </DialogHeader>

                        {!generatedKey ? (
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Key name</Label>
                                    <Input
                                        id="name"
                                        placeholder="e.g. Laptop CLI"
                                        value={newKeyName}
                                        onChange={(e) => setNewKeyName(e.target.value)}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="py-4 space-y-4">
                                <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md text-yellow-600 text-sm">
                                    <AlertCircle className="h-4 w-4" />
                                    <span>Copy this key now. You won&apos;t see it again!</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 p-2 bg-muted border font-mono text-sm break-all">
                                        {generatedKey}
                                    </code>
                                    <Button size="icon" variant="outline" onClick={() => copyToClipboard(generatedKey)}>
                                        {isCopying ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>
                        )}

                        <DialogFooter>
                            {!generatedKey ? (
                                <Button onClick={createKey} disabled={!newKeyName.trim()} className="rounded-full bg-foreground hover:bg-foreground/90 text-background">
                                    Generate key
                                </Button>
                            ) : (
                                <Button onClick={closeDialog} className="rounded-full bg-foreground hover:bg-foreground/90 text-background">
                                    Done
                                </Button>
                            )}
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="space-y-3">
                {keys.length === 0 && (
                    <div className="text-muted-foreground text-sm">No active API keys found.</div>
                )}
                {keys.map((key) => (
                    <div key={key.id} className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between p-4 border border-foreground/10">
                        <div className="space-y-1">
                            <div className="font-medium flex items-center gap-2">
                                {key.name}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-4">
                                <span>Created {formatRelative(key.createdAt)}</span>
                                <span>•</span>
                                <span>Last used {formatRelative(key.lastUsed)}</span>
                            </div>
                            <div className="text-xs font-mono text-muted-foreground">
                                sra_live_...{key.id.slice(0, 4)}
                            </div>
                        </div>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    className="w-full sm:w-auto rounded-full"
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Revoke
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Revoke &quot;{key.name}&quot;?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This takes effect immediately. Any script or CLI session using this key will stop working, and this cannot be undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => revokeKey(key.id)} className="bg-destructive hover:bg-destructive/90">Revoke</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                ))}
            </div>
        </div>
    )
}
