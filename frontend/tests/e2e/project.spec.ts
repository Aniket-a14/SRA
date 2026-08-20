import { test, expect } from "@playwright/test"
import { mockAuth, mockProjectsList, mockRecentAnalyses, makeProject } from "./mocks"

/** Signs in and lands on /projects — every spec in this file needs a session first. */
async function signIn(page: import("@playwright/test").Page) {
    await page.goto("/auth/login")
    await page.locator("#email").fill("e2e@example.com")
    await page.locator("#password").fill("correct-horse-battery-staple")
    await page.getByRole("button", { name: "Sign in", exact: true }).click()
    await expect(page).toHaveURL(/\/projects$/)
}

test.describe("projects", () => {
    test("creates a project and navigates into it", async ({ page }) => {
        await mockAuth(page)
        await mockRecentAnalyses(page)
        await mockProjectsList(page, [])

        await signIn(page)

        const created = makeProject({ name: "New E2E Project" })
        await page.route("**/projects", (route) => {
            if (route.request().method() === "POST") {
                return route.fulfill({
                    status: 201,
                    contentType: "application/json",
                    body: JSON.stringify({ success: true, data: created }),
                })
            }
            return route.fallback()
        })

        // Two "New project" buttons render when the list is empty (header + empty-state
        // prompt) — .first() takes the always-present header one.
        await page.getByRole("button", { name: "New project" }).first().click()
        await page.getByPlaceholder("Name your project…").fill("New E2E Project")
        await page.getByRole("button", { name: "Create" }).click()

        await expect(page.getByText("New E2E Project")).toBeVisible()

        // Mock the detail page this card links to before following it.
        await page.route(`**/projects/${created.id}`, (route) => {
            if (route.request().method() === "GET") {
                return route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify({ success: true, data: { ...created, analyses: [] } }),
                })
            }
            return route.fallback()
        })

        await page.getByText("New E2E Project").click()
        await expect(page).toHaveURL(new RegExp(`/projects/${created.id}$`))
    })

    test("lists existing projects on load", async ({ page }) => {
        await mockAuth(page)
        await mockRecentAnalyses(page)
        const existing = makeProject({ name: "Already There" })
        await mockProjectsList(page, [existing])

        await signIn(page)

        await expect(page.getByText("Already There")).toBeVisible()
    })
})
