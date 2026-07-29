import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"

import { useAnalysisProgress } from "./hooks"

/**
 * The progress stream is a long-lived response, and anything may end it early: a backgrounded
 * tab on iOS, a sleeping laptop, the serverless function hitting its own time limit part-way
 * through a run. Ending it used to be permanent — the effect re-ran only when the id, the
 * token or `active` changed, none of which a dropped connection touches — so coming back to
 * the tab showed a page frozen on whichever stage it had last heard about, for a run that had
 * often already finished.
 */

const token = "test-token"
vi.mock("./auth-context", () => ({ useAuth: () => ({ token }) }))

/** A text/event-stream Response carrying `events`, then ending. */
const sseResponse = (events: object[], { ok = true, status = 200 } = {}) => ({
    ok,
    status,
    body: new ReadableStream<Uint8Array>({
        start(controller) {
            const encoder = new TextEncoder()
            for (const event of events) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
            }
            controller.close()
        }
    })
}) as unknown as Response

const setVisibility = (state: "visible" | "hidden") => {
    Object.defineProperty(document, "visibilityState", { value: state, configurable: true })
    document.dispatchEvent(new Event("visibilitychange"))
}

beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    setVisibility("visible")
})

describe("useAnalysisProgress", () => {
    it("reconnects when the stream ends without the run finishing", async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(sseResponse([{ stage: "developer_shell", message: "Drafting..." }]))
            .mockResolvedValue(sseResponse([{ stage: "reflection", message: "Reviewing..." }]))
        vi.stubGlobal("fetch", fetchMock)

        const { result } = renderHook(() => useAnalysisProgress("a1", true))

        await waitFor(() => expect(result.current.event?.stage).toBe("developer_shell"))

        // The body ended with no terminal event, so the run is still going: pick it back up.
        await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
        await waitFor(() => expect(result.current.event?.stage).toBe("reflection"))
        expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2)
    })

    it("stops reconnecting once the run reports a terminal event", async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            sseResponse([{ stage: "completed", message: "Done", terminal: true }])
        )
        vi.stubGlobal("fetch", fetchMock)
        const onTerminal = vi.fn()

        renderHook(() => useAnalysisProgress("a1", true, onTerminal))

        await waitFor(() => expect(onTerminal).toHaveBeenCalled())

        await act(async () => { await vi.advanceTimersByTimeAsync(30000) })
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("does not retry a stream the server refused to authorise", async () => {
        // Reconnecting cannot fix a 401, and hammering it would just repeat the rejection.
        const fetchMock = vi.fn().mockResolvedValue(sseResponse([], { ok: false, status: 401 }))
        vi.stubGlobal("fetch", fetchMock)

        renderHook(() => useAnalysisProgress("a1", true))

        await act(async () => { await vi.advanceTimersByTimeAsync(30000) })
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("reconnects immediately when the tab comes back into view", async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            sseResponse([{ stage: "developer_features", message: "Writing features..." }])
        )
        vi.stubGlobal("fetch", fetchMock)

        renderHook(() => useAnalysisProgress("a1", true))
        await waitFor(() => expect(fetchMock).toHaveBeenCalled())
        const beforeReturn = fetchMock.mock.calls.length

        setVisibility("hidden")
        await act(async () => { setVisibility("visible") })

        await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(beforeReturn))
    })

    it("keeps finished sections when an abandoned attempt is rewound", async () => {
        const fetchMock = vi.fn().mockResolvedValue(sseResponse([
            { stage: "drafting", token: "Section one is settled." },
            { stage: "drafting", sectionBreak: true },
            { stage: "drafting", token: "A partial attempt." },
            { stage: "drafting", tokenReset: true },
            { stage: "drafting", token: "The retry's text." }
        ]))
        vi.stubGlobal("fetch", fetchMock)

        const { result } = renderHook(() => useAnalysisProgress("a1", true))

        await waitFor(() => expect(result.current.text).toContain("The retry's text."))
        // A rate limit late in the run used to clear the whole document off the page.
        expect(result.current.text).toContain("Section one is settled.")
        expect(result.current.text).not.toContain("A partial attempt.")
    })

    it("does not open a stream when there is nothing running", async () => {
        const fetchMock = vi.fn()
        vi.stubGlobal("fetch", fetchMock)

        renderHook(() => useAnalysisProgress("a1", false))

        await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
        expect(fetchMock).not.toHaveBeenCalled()
    })
})
