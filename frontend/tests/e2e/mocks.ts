import type { Page } from "@playwright/test"

/**
 * Every request these specs make is mocked at the browser network layer — no live backend
 * is involved. This matters beyond speed/determinism: a developer's real frontend/.env
 * commonly points NEXT_PUBLIC_BACKEND_URL at a live deployment (see playwright.config.ts),
 * so an un-mocked request must fail loudly, never fall through to production.
 */

export const MOCK_USER = {
    id: "usr_e2e_0001",
    email: "e2e@example.com",
    name: "E2E Test User",
}

export const MOCK_TOKEN = "e2e-mock-access-token"

const json = (body: unknown, status = 200) => ({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
})

/** Auth endpoints go through the same-origin Next.js proxy (/api/auth/*). */
export async function mockAuth(page: Page) {
    await page.route("**/api/auth/login", (route) =>
        route.fulfill(json({ user: MOCK_USER, token: MOCK_TOKEN }))
    )
    await page.route("**/api/auth/signup", (route) =>
        route.fulfill(json({ user: MOCK_USER, token: MOCK_TOKEN }, 201))
    )
    // Mount-time silent refresh (auth-context.tsx) — no cookie exists in a fresh browser
    // context, so the real backend would 401 anyway; mocking it the same way keeps every
    // spec's console free of an expected-but-noisy failed request.
    await page.route("**/api/auth/refresh", (route) =>
        route.fulfill(json({ message: "No active session" }, 401))
    )
    await page.route("**/api/auth/logout", (route) => route.fulfill(json({ message: "Logged out" })))
}

/** Project/analysis/settings endpoints call NEXT_PUBLIC_BACKEND_URL directly (cross-origin in dev). */
export async function mockProjectsList(page: Page, projects: unknown[] = []) {
    await page.route("**/projects", (route) => {
        // "**/projects" also matches this app's own /projects page navigation (the
        // post-login redirect target), not just the backend's list-projects call — CI runs
        // with NEXT_PUBLIC_BACKEND_URL same-origin (see playwright.config.ts), so the two are
        // indistinguishable by URL alone. Only intercept the API fetch; let the document
        // request through to Next's own router.
        if (route.request().resourceType() === "document") {
            return route.fallback()
        }
        if (route.request().method() === "GET") {
            return route.fulfill(json({ success: true, data: projects }))
        }
        return route.fallback()
    })
}

/** The projects list page's "recent activity" rail — a separate SWR call to GET /analyze. */
export async function mockRecentAnalyses(page: Page, items: unknown[] = []) {
    await page.route("**/analyze", (route) => {
        if (route.request().method() === "GET") {
            return route.fulfill(json({ success: true, data: items }))
        }
        return route.fallback()
    })
}

export function makeProject(overrides: Record<string, unknown> = {}) {
    return {
        id: "proj_e2e_0001",
        name: "E2E Test Project",
        description: "Created by a Playwright spec",
        userId: MOCK_USER.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _count: { analyses: 0 },
        ...overrides,
    }
}
