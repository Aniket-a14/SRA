// Registry of published release notes.
//
// Static imports rather than a filesystem glob: it keeps every note type-checked and
// bundled at build time, and a note that is added but never registered here shows up
// as an unused file in review instead of silently never appearing on the site.
//
// To publish a release, add `YYYY-MM-DD-vX.Y.Z.mdx` beside this file and register it
// below. Order here does not matter — the exported list is sorted.

import { compareReleases, type Release } from "@/lib/changelog"

import v421, { meta as m421 } from "./2026-08-30-v4.2.1.mdx"
import v420, { meta as m420 } from "./2026-07-25-v4.2.0.mdx"
import v410, { meta as m410 } from "./2026-07-23-v4.1.0.mdx"
import v403, { meta as m403 } from "./2026-05-24-v4.0.3.mdx"
import v400, { meta as m400 } from "./2026-02-18-v4.0.0.mdx"
import v321, { meta as m321 } from "./2026-02-14-v3.2.1.mdx"
import v320, { meta as m320 } from "./2026-02-12-v3.2.0.mdx"
import v311, { meta as m311 } from "./2026-02-01-v3.1.1.mdx"
import v310, { meta as m310 } from "./2026-02-01-v3.1.0.mdx"
import v3010, { meta as m3010 } from "./2026-02-01-v3.0.10.mdx"
import v309, { meta as m309 } from "./2026-02-01-v3.0.9.mdx"
import v300, { meta as m300 } from "./2026-01-31-v3.0.0.mdx"
import v220, { meta as m220 } from "./2026-01-30-v2.2.0.mdx"
import v210, { meta as m210 } from "./2026-01-29-v2.1.0.mdx"
import v200, { meta as m200 } from "./2026-01-28-v2.0.0.mdx"
import v100, { meta as m100 } from "./2026-01-15-v1.0.0.mdx"

const registry: Release[] = [
    { ...m421, Content: v421 },
    { ...m420, Content: v420 },
    { ...m410, Content: v410 },
    { ...m403, Content: v403 },
    { ...m400, Content: v400 },
    { ...m321, Content: v321 },
    { ...m320, Content: v320 },
    { ...m311, Content: v311 },
    { ...m310, Content: v310 },
    { ...m3010, Content: v3010 },
    { ...m309, Content: v309 },
    { ...m300, Content: v300 },
    { ...m220, Content: v220 },
    { ...m210, Content: v210 },
    { ...m200, Content: v200 },
    { ...m100, Content: v100 },
]

/** Newest first — see `compareReleases` for why date alone is not enough. */
export const releases: Release[] = [...registry].sort(compareReleases)
