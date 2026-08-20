import { defineConfig, devices } from "@playwright/test"

const PORT = 3001
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
    testDir: "./tests/e2e",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",

    use: {
        baseURL,
        trace: "on-first-retry",
    },

    projects: [
        { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    ],

    webServer: {
        // Dev mode compiles each route on-demand, on first visit — the first test to hit a
        // given route pays that compile latency inline, which is what made
        // "starting an analysis" flake in CI (its own page snapshot showed Next's dev
        // overlay still reading "Compiling..." at the moment of the failed assertion). A
        // production build has every route pre-compiled, so CI runs against `build && start`
        // instead; local runs keep `dev` for fast iteration, where reuseExistingServer means
        // this rarely even launches a fresh server.
        command: process.env.CI ? "npm run build && npm run start" : "npm run dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: process.env.CI ? 240_000 : 120_000,
        env: {
            // Every request these specs make is mocked via page.route (see tests/e2e/mocks.ts).
            // Same-origin, deliberately: a cross-origin NEXT_PUBLIC_BACKEND_URL makes these
            // fetch() calls subject to CORS, and route.fulfill()'s mocked response still has
            // to satisfy the browser's CORS check like a real cross-origin response would — a
            // mock with no Access-Control-Allow-Origin header gets silently blocked, and the
            // app's own .catch() swallows it as an ordinary failed request. Same-origin sidesteps
            // that entirely. A spec that forgets to mock something still fails loudly: the
            // request lands on this app's own router, which has no matching API route and
            // returns its HTML 404 — a JSON parse error, not a silent pass — so it still can't
            // reach a real backend even if a developer's frontend/.env points at one.
            NEXT_PUBLIC_BACKEND_URL: baseURL,
            // `next start` has no equivalent of `dev`'s hardcoded `-p 3001` — it needs this
            // to bind the same port `baseURL` points at.
            PORT: String(PORT),
        },
    },
})
