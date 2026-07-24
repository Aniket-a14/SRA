"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Sparkles, Trash2, Plus, CheckCircle2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { DiscoveredModel } from "@/lib/models"

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
    availableModels?: DiscoveredModel[] | null
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
    const [isVerifying, setIsVerifying] = useState(false)
    const [verifiedModels, setVerifiedModels] = useState<DiscoveredModel[] | null>(null)

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
            Promise.resolve().then(() => fetchKeys())
        }
    }, [token, fetchKeys])

    const configuredProviders = new Set(keys.map(k => k.provider))
    const availableProviders = ALL_PROVIDERS.filter(p => !configuredProviders.has(p))

    const closeDialog = () => {
        setIsAddOpen(false)
        setApiKey("")
        setLabel("")
        setVerifiedModels(null)
    }

    // Gemini keys can be saved without the verify-to-list round-trip (model list is fixed);
    // the other providers surface their available models only after a verify call.
    const needsVerify = provider !== "GEMINI"

    const verifyKey = async () => {
        if (!apiKey.trim()) return
        setIsVerifying(true)
        setVerifiedModels(null)
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/settings/provider-keys/verify`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ provider, apiKey: apiKey.trim() })
            })
            const json = await res.json()
            if (res.ok) {
                const models: DiscoveredModel[] = json.data?.models || []
                setVerifiedModels(models)
                toast.success(`Key verified — ${models.length} model${models.length === 1 ? "" : "s"} available`)
            } else {
                setVerifiedModels(null)
                toast.error(json.message || json.error || "Key verification failed")
            }
        } catch {
            toast.error("Could not reach the verification service")
        } finally {
            setIsVerifying(false)
        }
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
                const count = json.data?.availableModels?.length || 0
                toast.success(count > 0
                    ? `${PROVIDER_LABELS[provider]} key saved — ${count} models available`
                    : `${PROVIDER_LABELS[provider]} key saved`)
                closeDialog()
            } else {
                toast.error(json.message || json.error || "Failed to save key")
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

    if (isLoading) return <div className="text-sm text-muted-foreground">Loading provider keys...</div>

    return (
        <div className="border border-foreground/10 p-4 sm:p-6">
            <div className="flex items-start justify-between gap-4 mb-5 sm:mb-6">
                <div>
                    <h3 className="flex items-center gap-2 font-medium mb-1">
                        <Sparkles className="h-4 w-4" />
                        AI provider keys
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Bring your own key to generate specs — required for every provider, Gemini
                        included. The platform key is used only for embeddings, so add at least one
                        generation key here before running an analysis.
                    </p>
                </div>
                <Dialog open={isAddOpen} onOpenChange={(open) => open ? setIsAddOpen(true) : closeDialog()}>
                    <DialogTrigger asChild>
                        <Button size="sm" className="gap-2 rounded-full bg-foreground hover:bg-foreground/90 text-background shrink-0" disabled={availableProviders.length === 0}>
                            <Plus className="h-4 w-4" />
                            Add key
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Add provider key</DialogTitle>
                            <DialogDescription>
                                Your key is encrypted at rest and never shown again after saving.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="provider">Provider</Label>
                                <Select value={provider} onValueChange={(v) => { setProvider(v as AiProvider); setVerifiedModels(null) }}>
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
                                <Label htmlFor="apiKey">API key</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="apiKey"
                                        type="password"
                                        placeholder="sk-..."
                                        value={apiKey}
                                        onChange={(e) => { setApiKey(e.target.value); setVerifiedModels(null) }}
                                    />
                                    {needsVerify && (
                                        <Button type="button" variant="outline" onClick={verifyKey} disabled={!apiKey.trim() || isVerifying} className="shrink-0">
                                            {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
                                        </Button>
                                    )}
                                </div>
                                {verifiedModels && (
                                    <div className="mt-1 rounded-md border border-green-500/20 bg-green-500/5 p-3">
                                        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-green-600">
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                            {verifiedModels.length} model{verifiedModels.length === 1 ? "" : "s"} available for this key
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                                            {verifiedModels.map(m => (
                                                <span key={m.id} className="rounded-full border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                                    {m.label}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
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
                            <Button onClick={saveKey} disabled={!apiKey.trim() || isSaving} className="rounded-full bg-foreground hover:bg-foreground/90 text-background">
                                {isSaving ? "Saving..." : "Save key"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="space-y-3">
                {keys.length === 0 && (
                    <div className="text-muted-foreground text-sm">
                        No provider keys configured. Add a key above — generation can&apos;t run until you do.
                    </div>
                )}
                {keys.map((key) => (
                    <div key={key.id} className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between p-4 border border-foreground/10">
                        <div className="space-y-1">
                            <div className="font-medium flex items-center gap-2">
                                {PROVIDER_LABELS[key.provider]}
                                {key.label && <span className="text-xs text-muted-foreground">({key.label})</span>}
                            </div>
                            <div className="text-xs font-mono text-muted-foreground">{key.maskedKey}</div>
                            {Array.isArray(key.availableModels) && key.availableModels.length > 0 && (
                                <div className="text-[11px] text-muted-foreground/80">
                                    {key.availableModels.length} models available
                                </div>
                            )}
                        </div>
                        <Button
                            variant="destructive"
                            size="sm"
                            className="w-full sm:w-auto rounded-full"
                            onClick={() => removeKey(key.provider)}
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    )
}
