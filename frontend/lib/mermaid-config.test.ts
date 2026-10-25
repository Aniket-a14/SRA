import fs from "node:fs"
import path from "node:path"
import { describe, it, expect } from "vitest"
import { MERMAID_BASE_CONFIG } from "./mermaid-config"

/**
 * The two export paths initialised mermaid with `securityLevel: "loose"`, and because
 * `mermaid.initialize()` is global, an export also left the on-screen renderer loose.
 * Every initialize() call must start from MERMAID_BASE_CONFIG, and "loose" must not appear.
 */
const ROOT = path.resolve(__dirname, "..")
const DIRS = ["app", "components", "lib"]

const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const full = path.join(dir, e.name)
        if (e.isDirectory()) return e.name === "node_modules" ? [] : walk(full)
        return /\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [full] : []
    })

const sources = DIRS.flatMap((d) => walk(path.join(ROOT, d))).map((f) => ({
    file: path.relative(ROOT, f),
    text: fs.readFileSync(f, "utf8"),
}))

describe("mermaid configuration", () => {
    it("is strict and keeps the pre-v12 layout and look", () => {
        expect(MERMAID_BASE_CONFIG).toEqual({
            startOnLoad: false,
            securityLevel: "strict",
            layout: "dagre",
            look: "classic",
        })
    })

    it("finds the three render paths it guards", () => {
        const callers = sources.filter((s) => /\.initialize\(\{/.test(s.text) && /mermaid/i.test(s.text))
        expect(callers.map((c) => c.file).sort()).toEqual([
            "components/mermaid-renderer.tsx",
            "lib/export-utils.ts",
            "lib/srs-export/capture.ts",
        ])
    })

    it("starts every initialize() call from MERMAID_BASE_CONFIG", () => {
        const offenders = sources.flatMap((s) =>
            [...s.text.matchAll(/\.initialize\(\{([\s\S]{0,80})/g)]
                .filter((m) => /mermaid/i.test(s.text) && !m[1].includes("...MERMAID_BASE_CONFIG"))
                .map(() => s.file)
        )
        expect(offenders).toEqual([])
    })

    it("never sets securityLevel to anything but strict", () => {
        const loose = sources.filter((s) => /securityLevel\s*:\s*['"](?!strict)/.test(s.text)).map((s) => s.file)
        expect(loose).toEqual([])
    })
})
