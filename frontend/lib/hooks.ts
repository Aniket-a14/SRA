import { useAuth } from "./auth-context";
import { useCallback } from "react";

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
