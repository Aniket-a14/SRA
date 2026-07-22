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
