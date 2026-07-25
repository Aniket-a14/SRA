import { useAuth } from "./auth-context";
import { useCallback, useEffect, useRef, useState } from "react";
import { readSSEStream } from "./sse";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export interface AnalysisProgressEvent {
    stage: string;
    message?: string;
    terminal?: boolean;
    status?: string;
    resultQuality?: string;
}

/**
 * Refetch when the page is restored from the browser's back/forward cache.
 *
 * Back-navigation does not remount the page or re-run effects: the bfcache restores the
 * whole JS heap, so React state and the SWR cache come back frozen at the moment the user
 * left. For a page showing a background job that is exactly wrong — the analysis has moved
 * on, and a stale "ready to start" view invites a duplicate submit of a run already going.
 *
 * `pageshow` with `persisted: true` is the only reliable bfcache signal; SWR's
 * revalidateOnFocus does not cover it, because a restore need not raise a focus event.
 * `visibilitychange` covers the ordinary background-tab case.
 *
 * @param revalidate - called when the page returns to view; typically SWR's `mutate`
 * @param enabled - skip while unauthenticated or before hydration
 */
export function useRevalidateOnRestore(revalidate: () => void, enabled = true) {
    const revalidateRef = useRef(revalidate);

    useEffect(() => {
        revalidateRef.current = revalidate;
    }, [revalidate]);

    useEffect(() => {
        if (!enabled || typeof window === "undefined") return;

        const onPageShow = (event: PageTransitionEvent) => {
            if (event.persisted) revalidateRef.current();
        };
        const onVisibility = () => {
            if (document.visibilityState === "visible") revalidateRef.current();
        };

        window.addEventListener("pageshow", onPageShow);
        document.addEventListener("visibilitychange", onVisibility);
        return () => {
            window.removeEventListener("pageshow", onPageShow);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [enabled]);
}

/**
 * Custom hook for making authenticated API requests.
 * Automatically injects the Authorization bearer token.
 */
export function useAuthFetch() {
    const { token } = useAuth();

    const authFetch = useCallback(async (url: string, options: RequestInit = {}) => {
        const headers = {
            "Content-Type": "application/json",
            ...options.headers,
            "Authorization": `Bearer ${token}`
        };

        return fetch(url, {
            credentials: "include", // Required for cookies (if you use them for other things) or remove if purely token based. Kept for safety.
            ...options,
            headers,
        });
    }, [token]);

    return authFetch;
}

/**
 * Consumes GET /analyze/:id/stream — a text/event-stream response read via fetch(),
 * not native EventSource (which can't send the Authorization header this API requires,
 * and putting the JWT in the URL would leak it into server/proxy access logs).
 *
 * Purely additive: this is a faster, live-progress signal layered on top of whatever
 * polling the caller already does for the underlying data — if the stream never
 * connects (Redis not configured, network hiccup), that existing polling still
 * eventually shows the completed result.
 */
export function useAnalysisProgress(id: string | null, active: boolean, onTerminal?: () => void) {
    const { token } = useAuth();
    const [progress, setProgress] = useState<AnalysisProgressEvent | null>(null);
    const onTerminalRef = useRef(onTerminal);

    useEffect(() => {
        onTerminalRef.current = onTerminal;
    }, [onTerminal]);

    useEffect(() => {
        if (!id || !token || !active) return;

        const controller = new AbortController();

        (async () => {
            try {
                const res = await fetch(`${BACKEND_URL}/analyze/${id}/stream`, {
                    headers: { Authorization: `Bearer ${token}` },
                    signal: controller.signal
                });
                if (!res.ok) return;

                await readSSEStream(res, (data) => {
                    const parsed = data as AnalysisProgressEvent;
                    setProgress(parsed);
                    if (parsed.terminal) onTerminalRef.current?.();
                }, controller.signal);
            } catch {
                // Network error / aborted — the caller's own polling fallback covers this
            }
        })();

        return () => {
            controller.abort();
        };
    }, [id, token, active]);

    return progress;
}
