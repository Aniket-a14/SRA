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
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
            // Every request these specs make is mocked via page.route (see tests/e2e/mocks.ts).
            // Pointing this at an address nothing listens on means any request a spec forgot to
            // mock fails loudly (connection refused) instead of silently reaching a real
            // backend — which matters here specifically because a developer's real
            // frontend/.env often points NEXT_PUBLIC_BACKEND_URL at a live deployment.
            NEXT_PUBLIC_BACKEND_URL: "http://127.0.0.1:65535",
        },
    },
})
