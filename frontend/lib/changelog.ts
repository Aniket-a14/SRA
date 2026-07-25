// Types and helpers for the published release notes under `content/changelog`.
//
// The notes themselves are MDX: YAML frontmatter (typed as `ReleaseMeta` below, and
// exported by remark-mdx-frontmatter as `meta`) plus a hand-written body. They are
// the customer-facing record of a release, which is a different document from the
// engineering CHANGELOG.md at the repo root — that one stays a terse, exhaustive log
// of what changed; these explain what it means for someone using the platform.

export interface ReleaseMeta {
    /** Headline for the release — what it delivered, not the version number. */
    title: string
    /** One or two sentences shown under the headline. */
    description: string
    /** ISO `YYYY-MM-DD`. */
    date: string
    version: string
    /** Topic labels shown as pills. */
    tags?: string[]
    /** Marks the release as a milestone — rendered with a filled version badge. */
    milestone?: boolean
}

export interface Release extends ReleaseMeta {
    Content: (props: Record<string, unknown>) => React.JSX.Element
}

/**
 * Orders releases newest first. Date alone is not enough — four releases share
 * 2026-02-01 — so ties fall through to a numeric version comparison, which also
 * keeps 3.0.10 above 3.0.9 where a string comparison would invert them.
 *
 * Lives here rather than beside the registry so it stays testable: the registry
 * imports MDX, which the unit-test runner has no transform for.
 */
export function compareReleases(a: Pick<Release, "date" | "version">, b: Pick<Release, "date" | "version">): number {
    if (a.date !== b.date) return b.date.localeCompare(a.date)

    const left = a.version.split(".").map(Number)
    const right = b.version.split(".").map(Number)

    for (let i = 0; i < Math.max(left.length, right.length); i++) {
        const diff = (right[i] ?? 0) - (left[i] ?? 0)
        if (diff !== 0) return diff
    }

    return 0
}

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]

/**
 * Formats an ISO date for display without going through `Date`, whose UTC-midnight
 * parse renders the previous day west of Greenwich — a difference that would show
 * up as a hydration mismatch between the prerendered page and the browser.
 */
export function formatChangelogDate(iso: string): string {
    const [year, month, day] = iso.split("-").map(Number)
    if (!year || !month || !day) return iso

    return `${MONTHS[month - 1]} ${day}, ${year}`
}
