import { test, expect } from "@playwright/test"
import { mockAuth, mockProjectsList, MOCK_USER } from "./mocks"

test.describe("authentication", () => {
    test("logs in and lands on the projects list", async ({ page }) => {
        await mockAuth(page)
        await mockProjectsList(page, [])

        await page.goto("/auth/login")
        await page.locator("#email").fill(MOCK_USER.email)
        await page.locator("#password").fill("correct-horse-battery-staple")
        await page.getByRole("button", { name: "Sign in", exact: true }).click()

        await expect(page).toHaveURL(/\/projects$/)
    })

    test("signs up and lands on the projects list", async ({ page }) => {
        await mockAuth(page)
        await mockProjectsList(page, [])

        await page.goto("/auth/signup")
        await page.locator("#fullname").fill(MOCK_USER.name)
        await page.locator("#email").fill(MOCK_USER.email)
        await page.locator("#password").fill("correct-horse-battery-staple")
        await page.getByRole("button", { name: "Sign up", exact: true }).click()

        await expect(page).toHaveURL(/\/projects$/)
    })

    test("shows an error toast on invalid credentials without navigating", async ({ page }) => {
        await mockAuth(page)
        await page.route("**/api/auth/login", (route) =>
            route.fulfill({
                status: 401,
                contentType: "application/json",
                body: JSON.stringify({ message: "Invalid email or password" }),
            })
        )

        await page.goto("/auth/login")
        await page.locator("#email").fill(MOCK_USER.email)
        await page.locator("#password").fill("wrong-password")
        await page.getByRole("button", { name: "Sign in", exact: true }).click()

        await expect(page.getByText("Invalid email or password")).toBeVisible()
        await expect(page).toHaveURL(/\/auth\/login$/)
    })
})
