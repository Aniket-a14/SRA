import { test, expect } from '@playwright/test';

test.describe('SRA Basic Flow', () => {
    test('should load the landing page', async ({ page }) => {
        await page.goto('/');

        // Check for main title or branding
        const title = page.locator('h1');
        await expect(title).toContainText(/Requirements/i);
    });

    test('should navigate to login page', async ({ page }) => {
        await page.goto('/');
        const loginLink = page.locator('a:has-text("Login"), button:has-text("Login")').first();

        if (await loginLink.isVisible()) {
            await loginLink.click();
            await expect(page).toHaveURL(/.*auth/);
        }
    });

    test('should have valid page title', async ({ page }) => {
        await page.goto('/');

        // Verify page loaded by checking title
        await expect(page).toHaveTitle(/SRA|Smart Requirements Analyzer/i);
    });
});
