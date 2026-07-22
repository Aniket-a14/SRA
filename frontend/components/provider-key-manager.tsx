"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Sparkles, Trash2, Plus } from "lucide-react"
import { toast } from "sonner"

export type AiProvider = "GEMINI" | "OPENAI" | "CLAUDE" | "GROK"

export const PROVIDER_LABELS: Record<AiProvider, string> = {
    GEMINI: "Gemini",
    OPENAI: "OpenAI",
    CLAUDE: "Claude",
    GROK: "Grok",
}

interface ProviderKey {
    id: string
    provider: AiProvider
    maskedKey: string
    label: string | null
    isActive: boolean
    createdAt: string
    updatedAt: string
}

const ALL_PROVIDERS: AiProvider[] = ["GEMINI", "OPENAI", "CLAUDE", "GROK"]

export function ProviderKeyManager() {
    const { token } = useAuth()
    const [keys, setKeys] = useState<ProviderKey[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [provider, setProvider] = useState<AiProvider>("OPENAI")
    const [apiKey, setApiKey] = useState("")
    const [label, setLabel] = useState("")
    const [isSaving, setIsSaving] = useState(false)

    const fetchKeys = useCallback(async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/settings/provider-keys`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            if (res.ok) {
                const json = await res.json()
                setKeys(json.data || json)
            }
        } catch (error) {
            console.error(error)
            toast.error("Failed to fetch provider keys")
        } finally {
            setIsLoading(false)
        }
    }, [token])

    useEffect(() => {
        if (token) {
            // Defer to next tick to avoid cascading render warning
            Promise.resolve().then(() => fetchKeys())
        }
    }, [token, fetchKeys])

    const configuredProviders = new Set(keys.map(k => k.provider))
    const availableProviders = ALL_PROVIDERS.filter(p => !configuredProviders.has(p))

    const closeDialog = () => {
        setIsAddOpen(false)
        setApiKey("")
        setLabel("")
    }

    const saveKey = async () => {
        if (!apiKey.trim()) return
        setIsSaving(true)
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/settings/provider-keys`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ provider, apiKey: apiKey.trim(), label: label.trim() || undefined })
            })
            const json = await res.json()
            if (res.ok) {
                setKeys(prev => [...prev.filter(k => k.provider !== provider), json.data])
                toast.success(`${PROVIDER_LABELS[provider]} key saved`)
                closeDialog()
            } else {
                toast.error(json.error || json.message || "Failed to save key")
            }
        } catch {
            toast.error("Error saving provider key")
        } finally {
            setIsSaving(false)
        }
    }

    const removeKey = async (p: AiProvider) => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/settings/provider-keys/${p}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            })
            if (res.ok) {
                setKeys(prev => prev.filter(k => k.provider !== p))
                toast.success(`${PROVIDER_LABELS[p]} key removed`)
            } else {
                toast.error("Failed to remove key")
            }
        } catch {
            toast.error("Error removing provider key")
        }
    }

    if (isLoading) return <div>Loading provider keys...</div>

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        AI Provider Keys
                    </CardTitle>
                    <CardDescription>
                        Bring your own key to generate analyses with OpenAI, Claude, or Grok. Gemini works
                        out of the box using the platform&apos;s key — add your own here to override it.
                    </CardDescription>
                </div>
                <Dialog open={isAddOpen} onOpenChange={(open) => open ? setIsAddOpen(true) : closeDialog()}>
                    <DialogTrigger asChild>
                        <Button size="sm" className="gap-2" disabled={availableProviders.length === 0}>
                            <Plus className="h-4 w-4" />
                            Add Key
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Add Provider Key</DialogTitle>
                            <DialogDescription>
                                Your key is encrypted at rest and never shown again after saving.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="provider">Provider</Label>
                                <Select value={provider} onValueChange={(v) => setProvider(v as AiProvider)}>
                                    <SelectTrigger id="provider">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableProviders.map(p => (
                                            <SelectItem key={p} value={p}>{PROVIDER_LABELS[p]}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="apiKey">API Key</Label>
                                <Input
                                    id="apiKey"
                                    type="password"
                                    placeholder="sk-..."
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="label">Label (optional)</Label>
                                <Input
                                    id="label"
                                    placeholder="e.g. Personal account"
                                    value={label}
                                    onChange={(e) => setLabel(e.target.value)}
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button onClick={saveKey} disabled={!apiKey.trim() || isSaving}>
                                {isSaving ? "Saving..." : "Save Key"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {keys.length === 0 && (
                        <div className="text-muted-foreground text-sm">
                            No provider keys configured. Analyses run on Gemini by default.
                        </div>
                    )}
                    {keys.map((key) => (
                        <div key={key.id} className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between p-4 border rounded-lg bg-muted/20">
                            <div className="space-y-1">
                                <div className="font-medium flex items-center gap-2">
                                    {PROVIDER_LABELS[key.provider]}
                                    {key.label && <span className="text-xs text-muted-foreground">({key.label})</span>}
                                </div>
                                <div className="text-xs font-mono text-muted-foreground">{key.maskedKey}</div>
                            </div>
                            <Button
                                variant="destructive"
                                size="sm"
                                className="w-full sm:w-auto"
                                onClick={() => removeKey(key.provider)}
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remove
                            </Button>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
