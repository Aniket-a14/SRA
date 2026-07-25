# CLI test suite

Run: `pnpm --filter @sra-srs/sra-cli test` (or `pnpm test:cli` from the repo root).

Native ESM Jest, same setup as the backend, minus `MOCK_AI` — the CLI makes no model calls of
its own. Generation always happens server-side, because BYOK puts the user's provider key on
the platform.

| File | What it covers |
|---|---|
| `spec.test.js` | Requirement extraction per format (descriptor-driven and shape-fallback), and `mergeLocalState` — the merge that must keep local verification and review decisions across a re-sync while still taking requirement *text* from the platform. |
| `push.test.js` | The round-trip contract. Most importantly: `push` must never write IEEE's `systemFeatures` into a format that has no such section, and must not flatten structured user stories into prose. Also covers name-based recovery when the remote document was reordered. |
| `scanner.test.js` | Term extraction, evidence ranking, and the digest budget — the digest is submitted to an endpoint that rejects oversized input outright, so exceeding the budget is a hard failure, not a degradation. |
| `progress.test.js` | SSE frame parsing (including a frame split across chunk boundaries) and every fallback-to-polling path. A stream that ends without a terminal event means the run is still going, not that it succeeded. |
| `config-manager.test.js` | Legacy `projectId` → `analysisId` migration, and that an environment-supplied token is never written to disk. |

## What gets mocked

**Only the network.** `sra.spec.json` and `sra.config.json` are written to a real temp directory
that the test `process.chdir`s into, so file handling is exercised rather than stubbed — that is
where the format round-trip bugs actually live.

Mock with `jest.unstable_mockModule('../src/path.js', () => ({...}))` at the top of the file,
then `await import(...)` the module under test *after* the mock is registered. `jest.mock` (the
CJS hoisted form) does not work in a `"type": "module"` package.

## Testing a command that can fail

Commands signal failure by setting `process.exitCode`, not by throwing. A test that asserts on
that must reset it in `afterAll`, or the flag leaks out of the suite and fails the whole Jest
run even though every test passed.
