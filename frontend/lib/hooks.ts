import { useAuth } from "./auth-context";
import { useCallback } from "react";

/**
 * Custom hook for making authenticated API requests.
 * Automatically injects the Authorization bearer token and handled CSRF protection.
 */
export function useAuthFetch() {
    const { token, csrfToken, fetchCsrf } = useAuth();

    const authFetch = useCallback(async (url: string, options: RequestInit = {}) => {
        // PROACTIVE CSRF REFRESH: fetch a new token if missing from context
        let effectiveCsrf = csrfToken;
        if (!effectiveCsrf && options.method && !["GET", "HEAD", "OPTIONS"].includes(options.method.toUpperCase())) {
            effectiveCsrf = await fetchCsrf();
        }

        const headers = {
            "Content-Type": "application/json",
            ...options.headers,
            "Authorization": `Bearer ${token}`,
            ...(effectiveCsrf && { "x-csrf-token": effectiveCsrf }),
        };

        return fetch(url, {
            credentials: "include", // Required for cookies (CSRF)
            ...options,
            headers,
        });
    }, [token, csrfToken, fetchCsrf]);

    return authFetch;
}
