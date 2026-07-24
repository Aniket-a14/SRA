# Backend test suite

Run everything: `pnpm --filter backend test` (native ESM Jest, `MOCK_AI=true` so no real LLM calls).

| Type | Location | What it covers |
|---|---|---|
| **Unit** | `tests/unit/` | Pure service/agent logic in isolation — `modelDiscovery`, `providerKeyService`, `versioning`, `json_repair`, `graph_service`, `reconciliation_service`, chat dedup/stream, `BaseAgent` streaming, RAG, backup. Provider SDKs and Prisma are mocked via Jest's `unstable_mockModule`. |
| **Regression** | `tests/regression/` | Guards for specific bugs so they can't silently return. `response_envelope.regression.test.js` pins the `{success,message,data}` contract that the frontend version-view bugs violated; `provider_key_verify.regression.test.js` covers the BYOK verify→list-models→cache-on-save flow (auth-fail rejects, transient-fail still saves). |
| **Contract** | `tests/contract/` | API request/response shape checks against the route layer. |
| **E2E** | `tests/e2e/` | Full analysis golden-path through the orchestrator with mocked AI. |
| **Snapshots** | `tests/snapshots/` | Prompt-template snapshots — catch unintended prompt drift. |
| **Mutation** | `stryker.config.json` (run: `pnpm --filter backend test:mutation`) | Stryker mutates `modelDiscovery.js` + `response.js` and re-runs the fast unit/regression suites to measure how many mutants the tests actually kill (test *effectiveness*, not just coverage). Scoped narrowly on purpose — mutation testing re-runs the suite once per mutant. |

## Adding a regression test

When you fix a bug, add a test in `tests/regression/` named `<area>.regression.test.js` that would have failed before the fix. Reference the bug in a comment so the "why" survives.

## Native ESM mocking note

This is a `"type": "module"` codebase. Mock with `jest.unstable_mockModule('../../path.js', () => ({...}))` at the top of the file, then `await import(...)` the module under test *after* the mock is registered. `jest.mock` (the CJS hoisted form) does not work here.
