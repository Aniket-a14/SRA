/**
 * Cross-tab authentication synchronizer using BroadcastChannel and Web Locks API.
 * Ensures only one browser tab executes token rotation at a time, broadcasting the fresh token
 * to all open tabs.
 */

export type AuthSyncMessage =
  | { type: "TOKEN_REFRESHED"; token: string }
  | { type: "SESSION_CLEARED"; targetUrl?: string };

const AUTH_CHANNEL_NAME = "sra_auth_sync_channel";
const REFRESH_LOCK_NAME = "sra_token_refresh_web_lock";

let authChannel: BroadcastChannel | null = null;

export function getAuthChannel(): BroadcastChannel | null {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
        return null;
    }
    if (!authChannel) {
        authChannel = new BroadcastChannel(AUTH_CHANNEL_NAME);
    }
    return authChannel;
}

export function broadcastTokenRefreshed(token: string) {
    const channel = getAuthChannel();
    channel?.postMessage({ type: "TOKEN_REFRESHED", token });
}

export function broadcastSessionCleared(targetUrl?: string) {
    const channel = getAuthChannel();
    channel?.postMessage({ type: "SESSION_CLEARED", targetUrl });
}

export async function withCrossTabRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
    if (typeof window !== "undefined" && "locks" in navigator) {
        return await navigator.locks.request(REFRESH_LOCK_NAME, async () => {
            return await fn();
        });
    }
    return await fn();
}
