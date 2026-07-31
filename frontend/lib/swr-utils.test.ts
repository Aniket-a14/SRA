import { describe, expect, it, vi } from "vitest"
import { createAuthFetcher } from "./swr-utils"

const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    })

describe("createAuthFetcher", () => {
    it("delegates requests to the shared auth fetch and unwraps API data", async () => {
        const authFetch = vi.fn().mockResolvedValue(jsonResponse({ data: { id: "a1" } }))
        const fetcher = createAuthFetcher(authFetch)

        await expect(fetcher(["https://api.example/analyze/a1", "stale-token"])).resolves.toEqual({ id: "a1" })
        expect(authFetch).toHaveBeenCalledWith("https://api.example/analyze/a1")
    })

    it("surfaces the replay response when the shared auth fetch cannot recover", async () => {
        const authFetch = vi.fn().mockResolvedValue(jsonResponse({ message: "Unauthorized" }, 401))
        const fetcher = createAuthFetcher(authFetch)

        await expect(fetcher(["https://api.example/projects", "stale-token"])).rejects.toMatchObject({
            message: "Unauthorized",
            status: 401,
        })
    })
})
