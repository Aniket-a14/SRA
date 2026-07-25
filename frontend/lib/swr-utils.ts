import { toast } from "sonner";

export const fetcher = async ([url, token]: [string, string | null]) => {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache',
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(url, {
        headers,
        credentials: 'include'
    });

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const error = new Error(errorData.message || 'An error occurred while fetching data.');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (error as any).status = res.status;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (error as any).info = errorData;
        throw error;
    }

    const json = await res.json();
    return json.data || json;
};

export const swrOptions = {
    // Analyses run in the background and change while nobody is looking at them, so a
    // returning tab must never render whatever it happened to hold when it left. Combined
    // with the bfcache handling in useRevalidateOnRestore, this is what stops a stale
    // "ready to start" screen from inviting a duplicate submit of a run already going.
    revalidateOnFocus: true,
    // Focus fires often (every alt-tab); this keeps a burst of tab switches from turning
    // into a burst of requests while still refreshing promptly.
    focusThrottleInterval: 5000,
    shouldRetryOnError: false,
    onError: (err: Error) => {
        console.error("SWR Fetch Error:", err);
        toast.error(err.message || "Failed to sync data");
    }
};
