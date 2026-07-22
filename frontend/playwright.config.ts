import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for SRA Frontend E2E tests.
 */
export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    use: {
        baseURL: 'http://localhost:3001',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
        },
        {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
        },
    ],
    webServer: {
        command: 'pnpm run dev',
        url: 'http://localhost:3001',
        reuseExistingServer: !process.env.CI,
        timeout: 300 * 1000,
        env: {
            // Scoped via Playwright's own `env` (only the spawned dev-server child
            // process for this E2E run, not the whole shell/other processes) instead of
            // `set VAR=val && cmd`, which is Windows-only shell syntax and silently
            // failed to set anything on Linux/Mac CI runners anyway.
            NODE_TLS_REJECT_UNAUTHORIZED: '0',
        },
    },
});
