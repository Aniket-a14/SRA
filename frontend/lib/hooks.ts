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
    /** The attempt that produced the *current section* was abandoned and is being retried. */
    tokenReset?: boolean;
    /** The section just finished: what has been shown so far is settled and survives a reset. */
    sectionBreak?: boolean;
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
    // Split so a retry can rewind the section being drafted without erasing the sections
    // already finished — `tokenReset` used to clear everything on screen.
    const [committed, setCommitted] = useState("");
    const [live, setLive] = useState("");
    const onTerminalRef = useRef(onTerminal);
    // Bumping this re-runs the effect below, which is how a dropped stream reconnects.
    const [attempt, setAttempt] = useState(0);
    const doneRef = useRef(false);
    const failuresRef = useRef(0);

    useEffect(() => {
        onTerminalRef.current = onTerminal;
    }, [onTerminal]);

    useEffect(() => {
        if (!id || !token || !active) return;

        const controller = new AbortController();
        doneRef.current = false;
        let reconnect: ReturnType<typeof setTimeout> | undefined;

        /**
         * The stream is a long-lived response, and anything may end it early: a backgrounded
         * tab on iOS, a sleeping laptop, the serverless function hitting its own time limit
         * mid-run. Ending it early used to be permanent — the effect only re-ran when the id,
         * the token or `active` changed, none of which a dropped connection touches. So
         * returning to the tab showed a page frozen on whichever stage it had last heard
         * about, including for a run that had since finished.
         */
        const scheduleReconnect = () => {
            if (doneRef.current || controller.signal.aborted) return;
            // Backs off while the stream stays unavailable, so a backend that is refusing
            // connections is retried patiently rather than once a second for the whole run.
            const delay = Math.min(1500 * 2 ** failuresRef.current, 20000);
            failuresRef.current += 1;
            reconnect = setTimeout(() => setAttempt(n => n + 1), delay);
        };

        (async () => {
            try {
                const res = await fetch(`${BACKEND_URL}/analyze/${id}/stream`, {
                    headers: { Authorization: `Bearer ${token}` },
                    signal: controller.signal
                });
                // 401/403 is not something reconnecting fixes; anything else is worth retrying.
                if (!res.ok) {
                    if (res.status !== 401 && res.status !== 403) scheduleReconnect();
                    return;
                }

                await readSSEStream(res, (data) => {
                    const parsed = data as AnalysisProgressEvent;
                    failuresRef.current = 0; // the stream works; the next drop starts fresh

                    // Token frames carry no message and must not displace the stage label.
                    if (parsed.sectionBreak) {
                        setLive(current => {
                            setCommitted(prev => prev + current);
                            return "";
                        });
                        return;
                    }
                    if (parsed.tokenReset) {
                        setLive("");
                        return;
                    }
                    if (typeof parsed.token === "string") {
                        setLive(prev => prev + parsed.token);
                        return;
                    }

                    setProgress(parsed);
                    if (parsed.terminal) {
                        doneRef.current = true;
                        onTerminalRef.current?.();
                    }
                }, controller.signal);

                // Reached the end of the body without a terminal event: the run is still going
                // and this connection simply ended. Pick it back up.
                scheduleReconnect();
            } catch {
                // Network error — same treatment. An abort is filtered out by the guard above.
                scheduleReconnect();
            }
        })();

        return () => {
            controller.abort();
            if (reconnect) clearTimeout(reconnect);
        };
    }, [id, token, active, attempt]);

    // Reconnect the moment the tab comes back rather than waiting out the backoff, which is
    // the case the user actually sees: switch away mid-run, come back, expect live progress.
    useEffect(() => {
        if (!id || !active || typeof document === "undefined") return;
        const onVisible = () => {
            if (document.visibilityState === "visible" && !doneRef.current) setAttempt(n => n + 1);
        };
        document.addEventListener("visibilitychange", onVisible);
        return () => document.removeEventListener("visibilitychange", onVisible);
    }, [id, active]);

    return { event: progress, text: committed + live };
}
