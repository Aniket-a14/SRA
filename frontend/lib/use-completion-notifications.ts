import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { showNotification } from "./notifications";

const SEEN_KEY = "sra:notified-analyses";

export interface NotifiableAnalysis {
    id: string;
    title?: string;
    status?: string;
    resultQuality?: string;
}

const TERMINAL = new Set(["COMPLETED", "FAILED"]);

function loadSeen(): Set<string> {
    if (typeof window === "undefined") return new Set();
    try {
        const raw = localStorage.getItem(SEEN_KEY);
        return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
        return new Set();
    }
}

function persistSeen(seen: Set<string>) {
    try {
        // Bounded: only the most recent ids matter, and this is the only thing keeping the
        // key from growing without limit on a long-lived browser profile.
        localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-200)));
    } catch {
        // Private mode / quota — losing the record only risks a duplicate toast.
    }
}

/**
 * Notify when a background analysis reaches a terminal state.
 *
 * Detection is a transition, not a snapshot: an analysis must be observed running and then
 * observed finished. Firing on "is finished" alone would announce every historical run on
 * first load. The first observation therefore only seeds the baseline.
 *
 * Runs off whatever list the caller is already polling, so it adds no requests of its own —
 * SWR dedupes by key, and this consumes the same data the sidebar renders.
 *
 * @param analyses - the polled analysis list
 * @param onOpen - navigate to an analysis when its notification is activated
 * @returns unread completion count and a way to clear it
 */
export function useCompletionNotifications(
    analyses: NotifiableAnalysis[],
    onOpen?: (id: string) => void
) {
    const [unreadIds, setUnreadIds] = useState<string[]>([]);
    // Last known status per analysis. A ref, not state: it is a comparison baseline, and
    // storing it in state would re-render on every poll for no visual reason.
    const previousStatus = useRef<Map<string, string>>(new Map());
    const seeded = useRef(false);
    const seen = useRef<Set<string>>(new Set());
    const onOpenRef = useRef(onOpen);

    useEffect(() => {
        onOpenRef.current = onOpen;
    }, [onOpen]);

    useEffect(() => {
        seen.current = loadSeen();
    }, []);

    // Stable across renders unless the statuses actually change, so an unrelated re-render
    // of the polled list cannot re-trigger the effect.
    const statusSignature = useMemo(
        () => analyses.map((a) => `${a.id}:${(a.status || "").toUpperCase()}`).join("|"),
        [analyses]
    );

    /** Toast + OS notification for each run that just reached a terminal state. */
    const announce = (finished: NotifiableAnalysis[]) => {
        for (const analysis of finished) {
            const name = analysis.title || "Your analysis";
            const failed = (analysis.status || "").toUpperCase() === "FAILED";
            const partial = (analysis.resultQuality || "").toUpperCase() === "PARTIAL";

            const body = failed
                ? "The run did not finish. Open it to resume from the last completed stage."
                : partial
                    ? "Finished with a partial result — some sections were skipped."
                    : "Your requirements document is ready.";

            if (failed) toast.error(`${name}: analysis failed`, { description: body });
            else toast.success(`${name} is ready`, { description: body });

            showNotification(name, body, () => onOpenRef.current?.(analysis.id));
        }
    };
    // Kept in a ref so the detection effect can call the latest closure without listing it
    // as a dependency — re-running detection on every render would re-notify.
    const announceRef = useRef(announce);
    useEffect(() => {
        announceRef.current = announce;
    });

    useEffect(() => {
        if (!analyses.length) return;

        // First pass records where everything already stood. Without this, opening the app
        // with a history of finished runs would fire a notification for each of them.
        if (!seeded.current) {
            analyses.forEach((a) => previousStatus.current.set(a.id, (a.status || "").toUpperCase()));
            seeded.current = true;
            return;
        }

        const justFinished: NotifiableAnalysis[] = [];

        for (const analysis of analyses) {
            const status = (analysis.status || "").toUpperCase();
            const before = previousStatus.current.get(analysis.id);
            previousStatus.current.set(analysis.id, status);

            const wasRunning = before === "PENDING" || before === "IN_PROGRESS";
            if (!wasRunning || !TERMINAL.has(status)) continue;
            if (seen.current.has(analysis.id)) continue;

            seen.current.add(analysis.id);
            justFinished.push(analysis);
        }

        if (!justFinished.length) return;
        persistSeen(seen.current);

        // Deferred out of the effect body on purpose. Detection runs during commit, so
        // updating state synchronously here would force a second render pass before the
        // browser paints — and this is a notification, not something the current frame
        // depends on. Announcing and badging belong together, so both move.
        queueMicrotask(() => {
            setUnreadIds((prev) => [...prev, ...justFinished.map((a) => a.id)]);
            announceRef.current(justFinished);
        });
        // statusSignature is the real dependency; `analyses` is read through it.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusSignature]);

    return {
        unreadCount: unreadIds.length,
        unreadIds,
        clearUnread: () => setUnreadIds([]),
        markRead: (id: string) => setUnreadIds((prev) => prev.filter((x) => x !== id)),
    };
}
