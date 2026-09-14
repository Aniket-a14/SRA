import { describe, expect, it } from "vitest"
import { NextRequest } from "next/server"
import { proxy, proxyConfig } from "@/proxy"

describe("Next.js proxy CSP", () => {
    it("creates a per-request nonce and forwards the same policy", () => {
        const first = proxy(new NextRequest("http://localhost/analysis"))
        const second = proxy(new NextRequest("http://localhost/analysis"))

        const firstPolicy = first.headers.get("Content-Security-Policy") || ""
        const secondPolicy = second.headers.get("Content-Security-Policy") || ""

        expect(firstPolicy).toContain("script-src 'self' 'nonce-")
        expect(firstPolicy).toContain("'strict-dynamic'")
        expect(first.headers.get("x-middleware-next")).toBe("1")
        expect(first.headers.get("Content-Security-Policy")).toBe(firstPolicy)
        expect(secondPolicy).not.toBe(firstPolicy)
        expect(proxyConfig.matcher).toHaveLength(1)
    })
})
