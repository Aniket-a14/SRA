import { formatDistanceToNow, format } from "date-fns";

/** "3 days ago" — the one relative-date convention used across the app. */
export function formatRelative(date: string | Date): string {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
}

/** "Aug 21, 2026, 3:45 PM" — the one absolute-date convention used across the app. */
export function formatAbsolute(date: string | Date): string {
    return format(new Date(date), "MMM d, yyyy, h:mm a");
}
