"use client"

import { useModelQuota, describeReset, type ModelQuota } from "@/lib/model-quota"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Gauge, RefreshCw, AlertTriangle } from "lucide-react"
import { formatModelLabel } from "@/lib/models"

/**
 * What is left on each model, so a model can be chosen before a run rather than discovered
 * to be spent halfway through one.
 *
 * The panel is careful about provenance because the two providers behave differently:
 * OpenAI/Anthropic/Grok report limit, remaining and reset on every response — already correct
 * for the key's tier — while Gemini reports nothing at all and the figure shown is our own
 * count of the calls this app made. Presenting the second as if it were the first would be a
 * confident wrong number, so it is labelled an estimate and the reason is stated.
 */

function usageBar(q: ModelQuota) {
    const limit = q.requestLimit
    if (!limit) return null

    // A spent allowance reads as full whatever our own tally says. The tally only counts calls
    // made through this app, so on a key also used elsewhere it can sit at 1-of-20 while the
    // provider is already refusing — and a near-empty bar next to "Out of quota" reads as a
    // bug rather than as the shortfall it actually is.
    const used = q.isExhausted
        ? limit
        : q.source === "PROVIDER" && q.requestsRemaining !== null
            ? Math.max(0, limit - q.requestsRemaining)
            : q.requestsUsed
    const pct = Math.min(100, Math.round((used / limit) * 100))

    return (
        <div className="mt-2 h-1.5 w-full rounded-full bg-foreground/10 overflow-hidden">
            <div
                className={
                    pct >= 100 ? "h-full bg-destructive"
                        : pct >= 80 ? "h-full bg-amber-500"
                            : "h-full bg-foreground/40"
                }
                style={{ width: `${pct}%` }}
            />
        </div>
    )
}

export function ModelQuotaPanel() {
    const { quota, isLoading, refresh } = useModelQuota()
    const rows = Object.values(quota).sort((a, b) =>
        a.provider.localeCompare(b.provider) || a.modelName.localeCompare(b.modelName)
    )

    return (
        <div className="border border-foreground/10 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
                <h3 className="flex items-center gap-2 font-medium">
                    <Gauge className="h-4 w-4" />
                    Model usage
                </h3>
                <Button variant="ghost" size="sm" className="rounded-full" onClick={() => void refresh()}>
                    <RefreshCw className="h-3.5 w-3.5 mr-2" /> Refresh
                </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
                What each model has left, so you can pick one that will finish the run.
            </p>

            {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
            ) : rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    Nothing recorded yet. Usage appears here after your first run on a model.
                </p>
            ) : (
                <div className="space-y-3">
                    {rows.map((q) => {
                        const remaining = q.source === "PROVIDER"
                            ? q.requestsRemaining
                            : (q.requestLimit === null ? null : Math.max(0, q.requestLimit - q.requestsUsed))

                        return (
                            <div key={`${q.provider}:${q.modelName}`} className="p-4 border border-foreground/10">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="font-medium text-sm truncate">
                                            {formatModelLabel(q.modelName)}
                                        </div>
                                        <div className="text-[11px] font-mono text-muted-foreground">{q.provider}</div>
                                    </div>

                                    {q.isExhausted ? (
                                        <Badge variant="destructive" className="shrink-0">Out of quota</Badge>
                                    ) : remaining !== null ? (
                                        <span className="text-sm shrink-0">
                                            <strong>{remaining}</strong>
                                            {q.requestLimit !== null && (
                                                <span className="text-muted-foreground"> / {q.requestLimit}</span>
                                            )}
                                            <span className="text-muted-foreground"> left</span>
                                        </span>
                                    ) : (
                                        <span className="text-sm text-muted-foreground shrink-0">
                                            {q.requestsUsed} used today
                                        </span>
                                    )}
                                </div>

                                {usageBar(q)}

                                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                                    {q.source === "PROVIDER" ? (
                                        <span>Reported by {q.provider.toLowerCase()} — reflects your key&apos;s tier.</span>
                                    ) : (
                                        <span>
                                            Estimated: counts runs made here. {q.provider === "GEMINI" ? "Google" : q.provider}{" "}
                                            publishes no usage API, so use elsewhere on the same key isn&apos;t counted.
                                        </span>
                                    )}
                                    {q.isExhausted && q.resetsAt && (
                                        <span className="text-foreground/70">Resets {describeReset(q.resetsAt)}.</span>
                                    )}
                                </div>

                                {q.isExhausted && q.lastErrorText && (
                                    <p className="mt-2 flex items-start gap-1.5 text-[11px] text-destructive/90">
                                        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                                        <span className="min-w-0 break-words">{q.lastErrorText}</span>
                                    </p>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
