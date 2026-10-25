import { test, expect } from "@playwright/test"
import path from "node:path"
import { MERMAID_BASE_CONFIG } from "../../lib/mermaid-config"

/**
 * Real-browser check of the shipped mermaid build with the app's shared config:
 * - every diagram kind the pipeline generates still renders on mermaid 12 with the pinned
 *   dagre layout and classic look (a jsdom unit test cannot lay out SVG);
 * - `securityLevel: "strict"` neutralises HTML and click callbacks in LLM-written diagram
 *   source. The export paths used to run "loose".
 * Needs no app route: the page is a blank document with mermaid's own browser bundle.
 */
const MERMAID_BUNDLE = path.resolve(__dirname, "../../node_modules/mermaid/dist/mermaid.min.js")

const DIAGRAMS: Record<string, string> = {
    flowchart: "flowchart TD\n  A[Submit request] --> B{Valid?}\n  B -- yes --> C[Queue analysis]\n  B -- no --> D[Show errors]",
    sequence: "sequenceDiagram\n  participant U as User\n  participant S as SRA\n  U->>S: Upload vision\n  S-->>U: SRS draft",
    er: "erDiagram\n  USER ||--o{ PROJECT : owns\n  PROJECT ||--|{ ANALYSIS : contains",
    class: "classDiagram\n  class Analysis {\n    +String id\n    +status()\n  }\n  Project <|-- Analysis",
    state: "stateDiagram-v2\n  [*] --> PENDING\n  PENDING --> IN_PROGRESS\n  IN_PROGRESS --> COMPLETED\n  COMPLETED --> [*]",
}

// A diagram a prompt-injected model could emit: an HTML label with an inline handler, and a
// click directive that calls a page function.
const HOSTILE = [
    "flowchart TD",
    '  A["<img src=x onerror=window.__pwned=\'label\'>"] --> B',
    "  click B call window.__pwnedByClick()",
].join("\n")

test.describe("mermaid 12 with MERMAID_BASE_CONFIG", () => {
    test.beforeEach(async ({ page }) => {
        await page.setContent("<!doctype html><html><body><div id=out></div></body></html>")
        await page.addScriptTag({ path: MERMAID_BUNDLE })
        await page.evaluate((config) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const w = window as any
            w.__pwnedByClick = () => { w.__pwned = "click" }
            w.mermaid.initialize({ ...config, theme: "base" })
        }, MERMAID_BASE_CONFIG)
    })

    for (const [kind, code] of Object.entries(DIAGRAMS)) {
        test(`renders a ${kind} diagram`, async ({ page }) => {
            const result = await page.evaluate(async ({ code, kind }) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { svg } = await (window as any).mermaid.render(`d-${kind}`, code)
                document.getElementById("out")!.innerHTML = svg
                const el = document.querySelector("#out svg") as SVGSVGElement
                const box = el.getBBox()
                return { svg: svg.length, width: box.width, height: box.height, error: svg.includes("Syntax error") }
            }, { code, kind })
            expect(result.error).toBe(false)
            expect(result.svg).toBeGreaterThan(500)
            expect(result.width).toBeGreaterThan(10)
            expect(result.height).toBeGreaterThan(10)
        })
    }

    test("strict mode neutralises HTML labels and click callbacks", async ({ page }) => {
        const outcome = await page.evaluate(async (code) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const w = window as any
            const { svg, bindFunctions } = await w.mermaid.render("hostile", code)
            const out = document.getElementById("out")!
            out.innerHTML = svg
            bindFunctions?.(out)
            out.querySelectorAll("g.node, .node, a").forEach((n) => (n as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true })))
            await new Promise((r) => setTimeout(r, 300))
            return {
                pwned: w.__pwned ?? null,
                liveImg: !!out.querySelector("img[onerror]"),
                rendered: svg.includes("<svg"),
            }
        }, HOSTILE)
        expect(outcome.rendered).toBe(true)
        expect(outcome.liveImg).toBe(false)
        expect(outcome.pwned).toBeNull()
    })
})
