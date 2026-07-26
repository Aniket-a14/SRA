import { NextRequest, NextResponse } from "next/server";

/**
 * Per-request CSP nonce.
 *
 * The policy previously carried `script-src 'unsafe-inline'`, which is the one directive
 * that makes the rest of a CSP largely decorative: with it, an injected `<script>` executes
 * like any other, so the policy stops being a defence against XSS and becomes a list of
 * hosts. That mattered here more than usual, because the access token lives in localStorage
 * and is readable by any script that runs.
 *
 * A nonce cannot be a static header — it must differ per response, or it is just a password
 * an attacker can read off the page — so the policy moves out of next.config.ts and is built
 * here. Next.js reads the nonce back out of this header and stamps it on its own bootstrap
 * and hydration scripts.
 *
 * `'strict-dynamic'` lets a script that was allowed by the nonce load the chunks it needs,
 * which is what makes this work with Next's dynamic imports without allowlisting every path.
 * In browsers that honour it, the host allowlist is ignored; the hosts stay for older ones.
 *
 * COST, stated plainly: reading a per-request value opts pages out of static rendering. For
 * an app whose main surfaces are already dynamic and behind auth this is the right trade,
 * but the marketing page pays for it too.
 *
 * `style-src 'unsafe-inline'` deliberately remains. React sets inline styles, and there is
 * no nonce path for those short of restructuring the component layer — a much larger change
 * for a much smaller gain, since injected CSS is not injected script.
 */
const isProd = process.env.NODE_ENV === "production";

export function middleware(request: NextRequest) {
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

    // 'unsafe-eval' is required by Next's dev-mode Fast Refresh; production never needs it.
    const devOnlyScript = isProd ? "" : " 'unsafe-eval'";
    const devOnlyConnect = isProd ? "" : " http://localhost:*";

    const csp = [
        `default-src 'self'`,
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${devOnlyScript} https://vercel.live https://*.vercel.live`,
        `style-src 'self' 'unsafe-inline'`,
        `img-src 'self' data: https:`,
        `font-src 'self'`,
        `connect-src 'self' https://generativelanguage.googleapis.com https://sra-backend-six.vercel.app https://vercel.live https://*.vercel.live${devOnlyConnect}`,
        `frame-src 'self' https://vercel.live https://*.vercel.live`,
        `frame-ancestors 'none'`,
        `base-uri 'self'`,
        `form-action 'self'`,
        `object-src 'none'`,
        `upgrade-insecure-requests`,
    ].join("; ");

    // The nonce goes back on the *request* headers so the App Router can read it during
    // render (via headers().get('x-nonce')) and hand it to any inline script of our own.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", csp);

    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("Content-Security-Policy", csp);
    return response;
}

export const config = {
    matcher: [
        /*
         * Everything except static assets and prefetches. Static files are served straight
         * from the CDN and carry no script of ours; running middleware for them would spend
         * a request generating a nonce nothing reads.
         */
        {
            source: "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)",
            missing: [
                { type: "header", key: "next-router-prefetch" },
                { type: "header", key: "purpose", value: "prefetch" },
            ],
        },
    ],
};
