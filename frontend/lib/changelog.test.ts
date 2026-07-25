import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync } from "fs"
import path from "path"
import { compareReleases, formatChangelogDate } from "./changelog"

const CONTENT_DIR = path.join(__dirname, "..", "content", "changelog")
const NOTES = readdirSync(CONTENT_DIR).filter((file) => file.endsWith(".mdx"))

// Frontmatter is read here with a deliberately small parser rather than by importing
// the MDX, which vitest would need the whole Next/MDX toolchain to compile. The point
// of these tests is the metadata contract, not the rendering.
const frontmatter = (file: string): Record<string, string> => {
    const source = readFileSync(path.join(CONTENT_DIR, file), "utf8")
    const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source)
    if (!block) return {}

    const fields: Record<string, string> = {}
    for (const line of block[1].split(/\r?\n/)) {
        const match = /^(\w+):\s*(.*)$/.exec(line)
        if (match) fields[match[1]] = match[2].trim().replace(/^"|"$/g, "")
    }
    return fields
}

describe("release notes", () => {
    it("ships at least one note", () => {
        expect(NOTES.length).toBeGreaterThan(0)
    })

    it.each(NOTES)("%s declares the metadata the timeline renders", (file) => {
        const meta = frontmatter(file)

        expect(meta.title, "title").toBeTruthy()
        expect(meta.description, "description").toBeTruthy()
        expect(meta.date, "date").toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(meta.version, "version").toMatch(/^\d+\.\d+\.\d+$/)
    })

    it.each(NOTES)("%s is named for the release it documents", (file) => {
        // The filename carries the date and version so the directory sorts usefully and
        // a mismatch between the two is visible without opening the file.
        const meta = frontmatter(file)
        expect(file).toBe(`${meta.date}-v${meta.version}.mdx`)
    })

    it("has no duplicate versions", () => {
        const versions = NOTES.map((file) => frontmatter(file).version)
        expect(new Set(versions).size).toBe(versions.length)
    })
})

describe("compareReleases", () => {
    const release = (version: string, date: string) => ({ version, date })

    it("orders by date, newest first", () => {
        expect(compareReleases(release("1.0.0", "2026-07-25"), release("9.9.9", "2026-01-15"))).toBeLessThan(0)
    })

    it("breaks a shared date on version — four releases share 2026-02-01", () => {
        expect(compareReleases(release("3.1.1", "2026-02-01"), release("3.1.0", "2026-02-01"))).toBeLessThan(0)
    })

    it("compares version segments numerically, so 3.0.10 outranks 3.0.9", () => {
        // A string comparison puts "3.0.10" before "3.0.9", which is the wrong release order.
        expect(compareReleases(release("3.0.10", "2026-02-01"), release("3.0.9", "2026-02-01"))).toBeLessThan(0)
    })
})

describe("formatChangelogDate", () => {
    it("formats without a timezone-sensitive Date parse", () => {
        expect(formatChangelogDate("2026-07-25")).toBe("July 25, 2026")
        expect(formatChangelogDate("2026-01-01")).toBe("January 1, 2026")
    })

    it("returns the input unchanged when it isn't a date", () => {
        expect(formatChangelogDate("unreleased")).toBe("unreleased")
    })
})
