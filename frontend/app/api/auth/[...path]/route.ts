import { NextRequest, NextResponse } from "next/server"

/**
 * Same-origin proxy for the auth endpoints that set or read the refresh cookie.
 *
 * Frontend and backend are separate Vercel deployments — sra-xi.vercel.app and
 * sra-backend-six.vercel.app. `vercel.app` is on the Public Suffix List, so those are not
 * merely different hosts, they are different *sites*, and a cookie the backend sets is a
 * third-party cookie. Safari blocks those outright and Chrome blocks them in Incognito and
 * for anyone who has turned third-party cookies off. The refresh cookie then never reaches
 * `POST /auth/refresh`, which answers "no active session", and the user is signed out roughly
 * every fifteen minutes — the reported "the refresh token expires too soon".
 *
 * Routing these five through the frontend's own origin makes the cookie first-party, so it is
 * stored and sent under the same rules as any cookie the site sets for itself. Everything
 * else keeps talking to the backend directly: every other endpoint authenticates with a
 * bearer header, which no cookie policy touches.
 */

const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || "").replace(/\/$/, "")

/**
 * Only the endpoints that need it. Without this the route is an open relay to the backend
 * that also attaches the caller's cookie — the allowlist is what keeps it a proxy for five
 * known paths rather than for the whole API.
 */
const PROXIED = new Set(["login", "signup", "refresh", "logout", "exchange"])

/** Headers worth carrying upstream. The rest are the platform's and belong to this hop. */
const FORWARDED = ["content-type", "authorization", "cookie", "origin", "referer", "user-agent"]

/**
 * The cookie is same-site now, so None is both unnecessary and the attribute browsers treat
 * with most suspicion. Lax also means a cross-site POST cannot carry it at all, which is the
 * same protection the backend's origin check gives, applied one layer earlier.
 */
const asSameSiteLax = (cookie: string) =>
    /;\s*samesite=/i.test(cookie)
        ? cookie.replace(/;\s*samesite=\s*none/i, "; SameSite=Lax")
        : `${cookie}; SameSite=Lax`

async function proxy(request: NextRequest, path: string[]) {
    const segment = path.join("/")
    if (!PROXIED.has(segment)) {
        return NextResponse.json({ message: "Not found" }, { status: 404 })
    }
    if (!BACKEND_URL) {
        return NextResponse.json({ message: "Backend URL is not configured" }, { status: 500 })
    }

    const headers = new Headers()
    for (const name of FORWARDED) {
        const value = request.headers.get(name)
        if (value) headers.set(name, value)
    }
    // The backend derives req.ip from this for rate limiting and session geolocation; without
    // it every request would look like it came from this function.
    const forwardedFor = request.headers.get("x-forwarded-for")
    if (forwardedFor) headers.set("x-forwarded-for", forwardedFor)

    let upstream: Response
    try {
        upstream = await fetch(`${BACKEND_URL}/auth/${segment}`, {
            method: request.method,
            headers,
            body: request.method === "GET" ? undefined : await request.text(),
            redirect: "manual",
        })
    } catch {
        // A 502 and not a 401: the client must be able to tell "could not reach the server"
        // from "your session is over", because only the second one ends a session.
        return NextResponse.json({ message: "Could not reach the authentication service" }, { status: 502 })
    }

    const response = new NextResponse(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
    })

    const contentType = upstream.headers.get("content-type")
    if (contentType) response.headers.set("content-type", contentType)

    // getSetCookie, not get: rotation can emit more than one and get() would join them into a
    // single malformed header.
    for (const cookie of upstream.headers.getSetCookie()) {
        response.headers.append("set-cookie", asSameSiteLax(cookie))
    }

    return response
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
    const { path } = await context.params
    return proxy(request, path)
}
