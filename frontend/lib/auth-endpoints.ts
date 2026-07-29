/**
 * The auth endpoints that set or read the refresh cookie.
 *
 * These go through this app's own origin (see app/api/auth/[...path]/route.ts) rather than
 * straight to the backend, because the two are separate sites and a cookie set cross-site is
 * a third-party cookie — blocked by Safari, and by Chrome in Incognito. Everything else in
 * the app calls NEXT_PUBLIC_BACKEND_URL directly and authenticates with a bearer header.
 */
export type CookieAuthEndpoint = "login" | "signup" | "refresh" | "logout" | "exchange"

export const authEndpoint = (name: CookieAuthEndpoint) => `/api/auth/${name}`
