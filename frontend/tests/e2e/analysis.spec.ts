import { test, expect, type Page } from "@playwright/test"
import { mockAuth, mockProjectsList, mockRecentAnalyses, MOCK_USER } from "./mocks"

const json = (body: unknown, status = 200) => ({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
})

/** A single active Gemini key is enough for the composer to leave its "no keys" state and
 *  populate a default model — see buildModelOptions in lib/models.ts. */
async function mockProviderKeys(page: Page) {
    await page.route("**/settings/provider-keys", (route) =>
        route.fulfill(json({ success: true, data: [{ provider: "GEMINI", isActive: true, availableModels: null }] }))
    )
    await page.route("**/settings/model-quota", (route) => route.fulfill(json({ success: true, data: [] })))
}

async function signIn(page: Page) {
    await page.goto("/auth/login")
    await page.locator("#email").fill(MOCK_USER.email)
    await page.locator("#password").fill("correct-horse-battery-staple")
    await page.getByRole("button", { name: "Sign in", exact: true }).click()
    await expect(page).toHaveURL(/\/projects$/)
}

/** Reaches the analysis composer via the in-app button, not `page.goto`.
 *
 *  The access token lives only in memory (see auth-context.tsx) — a real page.goto is a hard
 *  navigation that reloads the whole app from zero, and the fresh load's silent
 *  refresh-via-cookie has no real cookie to redeem in this mocked test, so it silently wipes
 *  the token before the composer ever gets a chance to submit. Clicking through, like an
 *  actual user, keeps the same in-memory session across the client-side route change.
 */
async function goToNewAnalysis(page: Page) {
    await page.getByRole("button", { name: "New analysis" }).first().click()
    await expect(page).toHaveURL(/\/analysis\/new$/)
}

test.describe("starting an analysis", () => {
    test("submits a brief and lands on the draft review screen", async ({ page }) => {
        await mockAuth(page)
        await mockRecentAnalyses(page)
        await mockProjectsList(page, [])
        await mockProviderKeys(page)

        await signIn(page)

        const analysisId = "an_e2e_0001"
        const draftData = {
            details: {
                projectName: {
                    content: "E2E Password Reset",
                    metadata: { section_id: "1", subsection_id: "1.1", domain_type: "web", is_required: true, completion_status: "complete" },
                },
                fullDescription: {
                    content: "Users need to reset their password via an emailed link that expires after 30 minutes.",
                    metadata: { section_id: "1", subsection_id: "1.2", domain_type: "web", is_required: true, completion_status: "complete" },
                },
            },
        }

        await page.route("**/analyze", (route) => {
            if (route.request().method() === "POST") {
                return route.fulfill(json({ success: true, data: { id: analysisId, status: "draft" } }))
            }
            return route.fallback()
        })
        await page.route(`**/analyze/${analysisId}/validate`, (route) =>
            route.fulfill(json({
                success: true,
                data: { metadata: { validationResult: { validation_status: "PASS", issues: [] } } },
            }))
        )
        await page.route(`**/analyze/${analysisId}`, (route) => {
            if (route.request().method() === "GET") {
                return route.fulfill(json({
                    success: true,
                    data: {
                        id: analysisId,
                        status: "DRAFT",
                        isFinalized: false,
                        metadata: { status: "DRAFT", draftData },
                    },
                }))
            }
            return route.fallback()
        })

        await goToNewAnalysis(page)
        await page
            .getByPlaceholder("Describe what the system should do…")
            .fill("Users need to reset their password via an emailed link that expires after 30 minutes.")
        const startButton = page.getByRole("button", { name: "Start analysis" })
        await expect(startButton).toBeEnabled()
        await startButton.click()

        await expect(page).toHaveURL(new RegExp(`/analysis/${analysisId}$`))
    })
})
