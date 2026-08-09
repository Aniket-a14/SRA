# Frontend Reference

Detailed frontend conventions for the SRA Next.js application.

## Live progress stream

`useAnalysisProgress` reads `GET /analyze/:id/stream` with fetch (not `EventSource`, which cannot send the Authorization header). It reconnects on a body that ends without a `terminal` event, backs off while unavailable, reconnects immediately on `visibilitychange`, and does not retry 401/403.

Drafting text is kept as **committed + live**: `sectionBreak` settles a section, `tokenReset` rewinds only the section in flight. A retry must not clear the reader's whole document.

Filtering: `jsonTextStream.js`'s skip list and `tokenStream.js`'s per-section repeat filter prevent the model replaying earlier content (the appendices prompt carries the whole document so far).

## Changelog / release notes

`/changelog` publishes customer-facing release notes — a different document from the repo-root `CHANGELOG.md` (terse engineering log). Both need updating for a release.

Notes are MDX under `frontend/content/changelog/`, one file per release named `YYYY-MM-DD-vX.Y.Z.mdx`. YAML frontmatter (`title`, `description`, `date`, `version`, optional `tags`, `milestone`) is typed as `ReleaseMeta`.

**A new note must be registered in `content/changelog/index.ts`** — imports are static, not globbed. Ordering is `compareReleases` in `lib/changelog.ts` (date, then numeric version).

## MDX plumbing

`@next/mdx` in `next.config.ts` with `remark-gfm`, `remark-frontmatter`, `remark-mdx-frontmatter`. Turbopack requires **plugins named as strings, not imported** — function references fail the build. Element styling in `mdx-components.tsx`; no `@tailwindcss/typography` or `prose` class. Inline code styled in `globals.css` under `.release-note code`.

`frontend/lib/changelog.test.ts` uses its own frontmatter parser (vitest has no MDX transform). Keep pure logic in `lib/`, not beside the registry.

## Testing

Frontend tests run under vitest in **jsdom** environment (`pnpm --filter frontend test`). Test through exported surface, not by exporting internals. Don't configure a JSX transform (vitest 4 uses oxc). `tests/setup-dom.ts` stubs `matchMedia` and `ResizeObserver`.

## Privacy policy coupling

`frontend/app/privacy/page.tsx` names the sub-processors the backend actually calls, the retention periods in `reconciliationService`, and endpoints that exist. Changing any of those means changing that page.
