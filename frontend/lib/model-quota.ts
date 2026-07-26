"use client"

import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"

/**
 * Per-model quota, as reported by `GET /settings/model-quota`.
 *
 * `source` is the important field and must reach the UI intact:
 *
 * - `PROVIDER` — the provider's own rate-limit headers (OpenAI's `x-ratelimit-*`, Anthropic's
 *   `anthropic-ratelimit-*`). Authoritative, and already correct for whatever tier the key is
 *   on, so no table of published limits has to be maintained here.
 * - `COUNTED` — our own tally, because the provider publishes nothing. Gemini has no usage
 *   endpoint and sends no rate-limit headers, so all we can say is how many calls *this app*
 *   made. A key used elsewhere makes that a lower bound, and the UI has to say "estimated".
 */
export interface ModelQuota {
    provider: "GEMINI" | "OPENAI" | "CLAUDE" | "GROK"
    modelName: string
    source: "PROVIDER" | "COUNTED"
    requestLimit: number | null
    requestsRemaining: number | null
    tokensRemaining: number | null
    requestsUsed: number
    isExhausted: boolean
    resetsAt: string | null
    lastErrorText: string | null
}

export const quotaKey = (provider: string, modelName: string) => `${provider}:${modelName}`

/** Index by `PROVIDER:model` so a picker can look a row up without scanning. */
export function indexQuota(rows: ModelQuota[]): Record<string, ModelQuota> {
    const map: Record<string, ModelQuota> = {}
    for (const row of rows) map[quotaKey(row.provider, row.modelName)] = row
    return map
}

/** "in about 3 hours" / "at 12:00" — a relative phrase is easier to act on than a timestamp. */
export function describeReset(resetsAt: string | null): string {
    if (!resetsAt) return ""
    const ms = new Date(resetsAt).getTime() - Date.now()
    if (!Number.isFinite(ms) || ms <= 0) return "shortly"
    const minutes = Math.round(ms / 60000)
    if (minutes < 60) return `in ${minutes} min`
    const hours = Math.round(minutes / 60)
    if (hours < 24) return `in about ${hours} hour${hours === 1 ? "" : "s"}`
    return `in about ${Math.round(hours / 24)} day(s)`
}

/**
 * One short line describing what is left, phrased to match how much we actually know.
 * Returns null when there is nothing worth claiming.
 */
export function describeQuota(q: ModelQuota | undefined): string | null {
    if (!q) return null
    if (q.isExhausted) {
        return q.resetsAt ? `No quota left — resets ${describeReset(q.resetsAt)}` : "No quota left"
    }
    if (q.source === "PROVIDER" && q.requestsRemaining !== null) {
        return q.requestLimit !== null
            ? `${q.requestsRemaining} of ${q.requestLimit} requests left`
            : `${q.requestsRemaining} requests left`
    }
    if (q.requestLimit !== null) {
        // Our own subtraction, so it is an estimate and is labelled as one.
        return `~${Math.max(0, q.requestLimit - q.requestsUsed)} of ${q.requestLimit} left (estimated)`
    }
    if (q.requestsUsed > 0) return `${q.requestsUsed} used today`
    return null
}

/** Fetch quota for the signed-in user. `refresh` re-reads after a run finishes or fails. */
export function useModelQuota() {
    const { token } = useAuth()
    const [quota, setQuota] = useState<Record<string, ModelQuota>>({})
    const [isLoading, setIsLoading] = useState(true)

    const refresh = useCallback(async () => {
        if (!token) return
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/settings/model-quota`, {
                headers: { Authorization: `Bearer ${token}` },
            })
            if (!res.ok) return
            const json = await res.json()
            setQuota(indexQuota((json.data || json) as ModelQuota[]))
        } catch {
            // Quota display is advisory. If it cannot be read, the picker simply shows no
            // annotations rather than blocking the user from starting a run.
        } finally {
            setIsLoading(false)
        }
    }, [token])

    // Deferred to a microtask rather than called straight from the effect body: this file's
    // sibling screens use the same pattern, and it keeps the state update out of the render
    // pass the effect runs in.
    useEffect(() => {
        void Promise.resolve().then(refresh)
    }, [refresh])

    return { quota, isLoading, refresh }
}
