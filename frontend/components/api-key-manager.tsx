"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Key, Trash2, Copy, Check, Plus, AlertCircle } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
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
    const [keys, setKeys] = useState<ApiKey[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [newKeyName, setNewKeyName] = useState("")
    const [generatedKey, setGeneratedKey] = useState<string | null>(null)
    const [isCopying, setIsCopying] = useState(false)

    const fetchKeys = useCallback(async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/keys`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            if (res.ok) {
                const data = await res.json()
                setKeys(data)
            }
        } catch (error) {
            console.error(error)
            toast.error("Failed to fetch API keys")
        } finally {
            setIsLoading(false)
        }
    }, [token])

    useEffect(() => {
        if (token) fetchKeys()
    }, [token, fetchKeys])

    const createKey = async () => {
        if (!newKeyName.trim()) return

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/keys`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ name: newKeyName })
            })

            if (res.ok) {
                const data = await res.json()
                setGeneratedKey(data.rawKey) // Save raw key to show *once*
                setKeys(prev => [data, ...prev])
                setNewKeyName("")
                toast.success("API Key created successfully")
            } else {
                toast.error("Failed to create API Key")
            }
        } catch {
            toast.error("Error creating API Key")
        }
    }

    const revokeKey = async (id: string) => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/keys/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            })

            if (res.ok) {
                setKeys(prev => prev.filter(k => k.id !== id))
                toast.success("API Key revoked")
            } else {
                toast.error("Failed to revoke API Key")
            }
        } catch {
            toast.error("Error revoking API Key")
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

    if (isLoading) return <div>Loading keys...</div>

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        <Key className="h-5 w-5 text-primary" />
                        API Keys
                    </CardTitle>
                    <CardDescription>
                        Manage API keys validation for CLI and external tools.
                    </CardDescription>
                </div>
                <Dialog open={isCreateOpen} onOpenChange={(open) => {
                    if (!open) closeDialog()
                    else setIsCreateOpen(true)
                }}>
                    <DialogTrigger asChild>
                        <Button size="sm" className="gap-2">
                            <Plus className="h-4 w-4" />
                            Create New Key
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Create API Key</DialogTitle>
                            <DialogDescription>
                                Generate a new key for accessing the SRA API programmatically.
                            </DialogDescription>
                        </DialogHeader>

                        {!generatedKey ? (
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Key Name</Label>
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
                                    <code className="flex-1 p-2 bg-muted rounded border font-mono text-sm break-all">
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
                                <Button onClick={createKey} disabled={!newKeyName.trim()}>
                                    Generate Key
                                </Button>
                            ) : (
                                <Button onClick={closeDialog}>
                                    Done
                                </Button>
                            )}
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {keys.length === 0 && (
                        <div className="text-muted-foreground text-sm">No active API keys found.</div>
                    )}
                    {keys.map((key) => (
                        <div key={key.id} className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between p-4 border rounded-lg bg-muted/20">
                            <div className="space-y-1">
                                <div className="font-medium flex items-center gap-2">
                                    {key.name}
                                </div>
                                <div className="text-xs text-muted-foreground flex items-center gap-4">
                                    <span>Created {formatDistanceToNow(new Date(key.createdAt))} ago</span>
                                    <span>•</span>
                                    <span>Last used {formatDistanceToNow(new Date(key.lastUsed))} ago</span>
                                </div>
                                <div className="text-xs font-mono text-muted-foreground">
                                    sra_live_...{key.id.slice(0, 4)} 
                                </div>
                            </div>
                            <Button
                                variant="destructive"
                                size="sm"
                                className="w-full sm:w-auto"
                                onClick={() => revokeKey(key.id)}
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Revoke
                            </Button>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
