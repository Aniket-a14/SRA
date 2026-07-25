/**
 * Browser notification support for finished analyses.
 *
 * A run takes minutes and continues server-side whether or not the tab is open, so the
 * moment it finishes is almost never a moment the user is watching. The Notifications API
 * covers the realistic case — the tab is open but backgrounded, or the user is on another
 * page of the app.
 *
 * Note the limit: this reaches the user while the *browser* is running. Delivery to a fully
 * closed browser needs the Push API with a service worker and VAPID keys, which is separate
 * infrastructure and not what this module does.
 */

const PERMISSION_ASKED_KEY = "sra:notification-permission-asked";

export function notificationsSupported(): boolean {
    return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission(): NotificationPermission | "unsupported" {
    if (!notificationsSupported()) return "unsupported";
    return Notification.permission;
}

/**
 * Ask for permission, at most once per browser unless the user asks again explicitly.
 *
 * Prompting on page load is the reliable way to get permanently denied, so callers should
 * trigger this from a deliberate action (starting a run, toggling the setting) rather than
 * on mount.
 *
 * @param force - ask again even if we have asked before
 */
export async function requestNotificationPermission(force = false): Promise<NotificationPermission | "unsupported"> {
    if (!notificationsSupported()) return "unsupported";
    if (Notification.permission !== "default") return Notification.permission;

    if (!force && localStorage.getItem(PERMISSION_ASKED_KEY) === "1") {
        return Notification.permission;
    }

    try {
        localStorage.setItem(PERMISSION_ASKED_KEY, "1");
        return await Notification.requestPermission();
    } catch {
        // Older Safari exposes only the callback form; treat a throw as "not granted"
        // rather than breaking the caller.
        return Notification.permission;
    }
}

/**
 * Show a completion notification. Silently does nothing when unsupported or not granted —
 * notifications are an enhancement and must never interrupt the surrounding flow.
 *
 * @param title - analysis title
 * @param body - short status line
 * @param onClick - invoked when the user activates the notification (usually navigation)
 */
export function showNotification(title: string, body: string, onClick?: () => void): void {
    if (!notificationsSupported() || Notification.permission !== "granted") return;

    try {
        const notification = new Notification(title, {
            body,
            icon: "/favicon.ico",
            // Collapses repeat notifications for the same analysis instead of stacking a
            // fresh one on every re-render or reconnect.
            tag: `sra-analysis-${title}`,
        });

        if (onClick) {
            notification.onclick = () => {
                window.focus();
                notification.close();
                onClick();
            };
        }
    } catch {
        // Some browsers throw when constructing notifications outside a service worker
        // context; the in-app toast still fires, so this is safe to swallow.
    }
}
