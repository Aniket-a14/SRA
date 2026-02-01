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
    revalidateOnFocus: false,
    shouldRetryOnError: false,
    onError: (err: Error) => {
        console.error("SWR Fetch Error:", err);
        toast.error(err.message || "Failed to sync data");
    }
};
