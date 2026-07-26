"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, RotateCcw, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { buildModelOptions, formatModelLabel, type ModelOption } from "@/lib/models"
import { useModelQuota, describeQuota, quotaKey } from "@/lib/model-quota"

interface ProviderKeyLite {
    provider: "GEMINI" | "OPENAI" | "CLAUDE" | "GROK"
    isActive: boolean
    availableModels?: { id: string; label: string }[] | null
}

interface ResumeWithModelProps {
    /** The model the run was using when it stopped. */
    currentModel?: string
    isResuming?: boolean
    onResume: (model?: { modelProvider?: string; modelName?: string }) => void
}

/**
 * Resume a stopped run, optionally on a different model.
 *
 * Offered rather than a plain retry because the most common cause of a stopped run is the
 * selected model's daily quota running out — and a plain retry then fails at exactly the same
 * point, having spent more of the allowance getting there. Models already known to be out of
 * quota are disabled here too, so the replacement cannot be another dead end.
 */
export function ResumeWithModel({ currentModel, isResuming, onResume }: ResumeWithModelProps) {
    const { token } = useAuth()
    const { quota } = useModelQuota()
    const [options, setOptions] = useState<ModelOption[]>([])
    const [selected, setSelected] = useState<string>("")

    useEffect(() => {
        if (!token) return
        fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/settings/provider-keys`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((res) => (res.ok ? res.json() : { data: [] }))
            .then((json) => {
                const keys = (json.data || json) as ProviderKeyLite[]
                const active = Array.isArray(keys) ? keys.filter((k) => k.isActive) : []
                setOptions(buildModelOptions(active))
            })
            .catch(() => { /* leaves the plain resume button, which is still correct */ })
    }, [token])

    const currentQuota = currentModel ? quota[
        Object.keys(quota).find((k) => k.endsWith(`:${currentModel}`)) || ""
    ] : undefined
    const currentIsSpent = !!currentQuota?.isExhausted

    const chosen = options.find((o) => o.value === selected)

    return (
        <div className="space-y-2">
            {currentModel && (
                <p className="text-xs text-muted-foreground text-left">
                    Stopped while using <strong>{formatModelLabel(currentModel)}</strong>
                    {currentIsSpent && <span className="text-destructive"> — out of quota</span>}.
                </p>
            )}

            {options.length > 1 && (
                <Select value={selected} onValueChange={setSelected}>
                    <SelectTrigger className="w-full" aria-label="Resume with a different model">
                        <Sparkles className="h-3.5 w-3.5 text-muted-foreground mr-1.5" />
                        <SelectValue placeholder={currentIsSpent ? "Pick another model" : "Same model"} />
                    </SelectTrigger>
                    <SelectContent>
                        {options.map((m) => {
                            const q = quota[quotaKey(m.provider, m.value)]
                            const note = describeQuota(q)
                            return (
                                <SelectItem
                                    key={`${m.provider}:${m.value}`}
                                    value={m.value}
                                    disabled={q?.isExhausted}
                                >
                                    <span className="flex flex-col items-start gap-0.5">
                                        <span>{m.label}</span>
                                        {note && (
                                            <span className={cn(
                                                "text-[10px]",
                                                q?.isExhausted ? "text-destructive" : "text-muted-foreground"
                                            )}>
                                                {note}
                                            </span>
                                        )}
                                    </span>
                                </SelectItem>
                            )
                        })}
                    </SelectContent>
                </Select>
            )}

            <Button
                onClick={() => onResume(
                    chosen ? { modelProvider: chosen.provider, modelName: chosen.value } : undefined
                )}
                disabled={isResuming || (currentIsSpent && !chosen)}
                className="w-full bg-foreground hover:bg-foreground/90 text-background rounded-full"
            >
                {isResuming ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Resuming…</>
                ) : (
                    <>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        {chosen
                            ? `Resume with ${chosen.label}`
                            : "Resume from where it stopped"}
                    </>
                )}
            </Button>

            {currentIsSpent && !chosen && (
                <p className="text-[11px] text-muted-foreground text-left">
                    Pick a model with quota left — resuming on the same one would stop at the
                    same point.
                </p>
            )}
        </div>
    )
}
