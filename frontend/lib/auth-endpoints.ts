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

export type OAuthProvider = "google" | "github"

/**
 * Absolute URL of the backend route that starts an OAuth sign-in. Throws when the backend URL
 * is missing or not absolute: the old inline template turned an unset variable into the
 * relative path "undefined/auth/google/start", so the button quietly navigated to a 404.
 */
export function oauthStartUrl(provider: OAuthProvider, backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL): string {
    const base = (backendUrl || "").trim().replace(/\/+$/, "")
    if (!/^https?:\/\/[^/]/i.test(base)) {
        throw new Error("Sign-in is unavailable: the backend URL is not configured.")
    }
    return `${base}/auth/${provider}/start`
}

/** Full-page navigation to the backend origin; OAuth cannot run through router.push. */
export function startOAuth(provider: OAuthProvider): void {
    window.location.assign(oauthStartUrl(provider))
}
