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
    /** A slice of readable prose from the drafting stream; carries no `message`. */
    token?: string;
    /** The attempt that produced the text so far was abandoned and is being retried. */
    tokenReset?: boolean;
}

export interface AnalysisProgress {
    event: AnalysisProgressEvent | null;
    text: string;
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
 *
 * Injects the bearer token and, on a 401, refreshes it once and replays the request. That
 * retry is what makes a short access-token lifetime viable: without it, every call in the
 * app simply began failing the moment the token expired, with no recovery until the user
 * reloaded the page — so the token had to live as long as the session, which defeated
 * having a refresh token at all.
 *
 * The refresh itself is deduplicated in auth-context, because a page fires several requests
 * at once and they expire together.
 */
export function useAuthFetch() {
    const { token, refreshAccessToken } = useAuth();

    const authFetch = useCallback(async (url: string, options: RequestInit = {}) => {
        const send = (bearer: string | null) => fetch(url, {
            credentials: "include", // refresh cookie rides along for /auth/refresh
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...options.headers,
                "Authorization": `Bearer ${bearer}`
            },
        });

        const response = await send(token);
        if (response.status !== 401) return response;

        const refreshed = await refreshAccessToken();
        // No new token means the session is genuinely over, or the network is down. Hand
        // back the original 401 and let the caller decide — auth-context signs the user out
        // on its own /auth/me cycle rather than doing it from inside a data fetch.
        if (!refreshed.token) return response;

        // Retried exactly once. A second 401 after a successful refresh is not an expiry
        // problem, and looping on it would hammer the API.
        return send(refreshed.token);
    }, [token, refreshAccessToken]);

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
export function useAnalysisProgress(id: string | null, active: boolean, onTerminal?: () => void): AnalysisProgress {
    const { token } = useAuth();
    const [progress, setProgress] = useState<AnalysisProgressEvent | null>(null);
    const [text, setText] = useState("");
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

                    // Token frames carry no message and must not displace the stage label.
                    if (parsed.tokenReset) {
                        setText("");
                        return;
                    }
                    if (typeof parsed.token === "string") {
                        setText(prev => prev + parsed.token);
                        return;
                    }

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

    return { event: progress, text };
}
