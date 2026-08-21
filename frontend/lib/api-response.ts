/**
 * Pulls a display message out of a parsed backend error body. `error` takes priority over
 * `message` — matches errorMiddleware.js's response shape (`{ success, message, errorCode }`)
 * and the `{ error }` shape used by a few older routes (e.g. repairDiagram) — so every call
 * site reads the same field in the same order instead of each guessing its own priority.
 */
export function extractErrorMessage(body: unknown, fallback: string): string {
    if (body && typeof body === "object") {
        const b = body as Record<string, unknown>;
        if (typeof b.error === "string" && b.error) return b.error;
        if (typeof b.message === "string" && b.message) return b.message;
    }
    return fallback;
}

/** Throws with the backend's `{ error }`/`{ message }` body on a non-2xx response, falling back to statusText. */
export async function handleResponse(res: Response): Promise<Response> {
    if (!res.ok) {
        let errorMessage = res.statusText;
        try {
            const errorData = await res.json();
            errorMessage = extractErrorMessage(errorData, res.statusText);
        } catch {
            // Ignore JSON parse error, fallback to statusText
        }
        throw new Error(errorMessage);
    }
    return res;
}
