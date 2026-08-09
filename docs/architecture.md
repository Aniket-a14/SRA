# Architecture Reference

Detailed reference for the SRA analysis pipeline, reflection loop, and reliability layer.
This document is the canonical source for "why" behind architectural constraints
summarized in `CLAUDE.md`.

## Analysis pipeline — full lifecycle

1. **Enqueue** — `queueService.js: addAnalysisJob` creates an `Analysis` row (`status: 'PENDING'`), hashes input (MD5) for idempotency (returns existing PENDING job on duplicate), then publishes to QStash (prod) or fires in-process (`MOCK_QSTASH`/dev).
2. **Worker** — QStash → `POST /api/worker/process` → `workerController.processJob`. Atomically transitions `PENDING → IN_PROGRESS` via `updateMany` (guards duplicate QStash deliveries — `count === 0` means already handled or wrong user), then calls `analysisService.performAnalysis`.
3. **Orchestration** (`analysisService.js`, single large function):
   - `ProductOwnerAgent` refines raw input into scope/features.
   - Multi-query RAG retrieval per feature (`ragService.retrieveContext`, pgvector cosine similarity) via `Promise.all`.
   - `ArchitectAgent` designs system using RAG context.
   - `DeveloperAgent` generates SRS **sectionally** (shell → features in chunks of 2 → requirements/glossary → appendices/diagrams), with deliberate `sleep()` cooldowns between calls (Gemini rate-limit throttle — not dead code).
   - **Reflection loop** (max 2 passes, threshold 85): `ReviewerAgent` (approve/reject) + `CriticAgent` (6Cs score). On failure, `DeveloperAgent.refineSRS` does **surgical** refinement of only the flagged section.
   - Diagrams get heuristic pre-checks + AI self-repair (`validateAndAutoRepairDiagrams`) before reflection scoring.
   - `evalService.evaluateRAG` runs RAGAS-style faithfulness/relevancy as final benchmark.
   - Everything persisted in a single Prisma `$transaction`; async knowledge-graph extraction follows.
4. **Versioning** — `Analysis.rootId`/`parentId` form a tree (not mutable history). Every refinement/chat edit creates a new row.

## Checkpointed pipeline (Vercel execution budget)

The pipeline needs ~360s; a Vercel function is killed at 300s (`backend/vercel.json`). `pipelineBudget.js` lets one invocation run as many *checkpointed* stages as fit, then persist and re-enqueue itself.

- `checkpointAndYield` pairs writing a checkpoint with re-enqueuing. Yielding where no checkpoint was written loses work.
- The budget check is `assertBudgetFor(stage, STAGE_COST_MS.next)` — being 1s inside the deadline is not permission to begin 90s of reflection.
- Every stage after the draft (`diagram_repair`, each reflection pass, `audit_complete`) is a boundary.
- `checkpoint.diagramsRepaired` / `checkpoint.reflection` prevent re-buying AI calls an earlier invocation already paid for.

**Production incident that motivated this:** A run checkpointed its draft at 220s of a 240s budget, entered a reflection loop with no yield point, and was killed at 300s — leaving the row `IN_PROGRESS` behind a stale checkpoint with a silent progress stream.

## Reflection / quality-gate details

The quality gate compares against 85 on a 0–100 scale. `normalizeScore` in `reflectionStage.js` rescales provider outputs:

- BYOK means OpenAI, Claude, Grok answer from prompt alone (no response schema), and models return `0.86`, `8.6`, or `86` interchangeably.
- A bare `10` is deliberately *not* rescaled without corroboration from the six 6Cs sub-scores (it could be 10/10 or 10/100).
- An unreadable audit defers to the Reviewer rather than reading as 0 (`undefined >= 85` was false, which spent a refinement pass on nonexistent feedback).
- Reviewer status goes through `isApprovedStatus` (not `=== "APPROVED"`), because `"APPROVED_WITH_COMMENTS"` exists.

## Surgical refinement schema invariant

`REFINEMENT_SCHEMAS` must have an entry for every section the reflection loop can target. An unmapped section throws rather than falling back to `SRSSchema`.

**Why this matters:** Before the fix, Appendices fell back to the full `SRSSchema`, so the model was shown one section, asked for a whole SRS, and its answer overwrote everything — finished documents came out with no diagrams. Appendices is the branch selected most often (`hasAppendicesFeedback` tested first, matches any diagram-related feedback). `mergeRefinedAppendices` now replaces a diagram only with one that has code.

## Backend module conventions

- `routes/` → `controllers/` → `services/` is the standard flow.
- Agents are only invoked from `analysisService.js` and `chatService.js`.
- `middleware/` includes rate limiting (Redis-backed sliding window), audit logging, and JWT auth.
- Route mounting and middleware order is defined in `app.js`.

## Data model

Postgres with `pgvector` + `uuid-ossp`. Key models: `User` → `Project` → `Analysis` (tree via `rootId`/`parentId`, `resultJson` holds the SRS, `vectorSignature` for similarity), `ChatMessage`, `KnowledgeChunk` (shredded requirement fragments for RAG, GIN-indexed), `GraphNode`/`GraphEdge`, `ApiKey`, `Session`.

## Reliability layer — BaseAgent

`BaseAgent.js` is the shared base for all 5 agents + `ChatAgent`:
- 6-minute timeout
- Jittered exponential backoff on 429/5xx/timeout
- Multi-stage JSON repair pipeline in `parseJSON` (strip markdown fences → balance braces on truncation → `jsonrepair` library → raw `JSON.parse` fallback)

## ChatAgent prompt compaction

`ChatAgent` + `promptCompaction.js` handle conversational refinement without re-sending the full SRS JSON: `createChatSnapshot()` / `createReviewSnapshot()` build small, character-token-counted context payloads.

## Provider adapter registry

`BaseAgent` and `ChatAgent` route all calls through a shared adapter interface per provider:
- `GeminiAdapter`, `OpenAIAdapter`, `ClaudeAdapter`, `GrokAdapter` — all BYOK.
- Platform `GEMINI_API_KEY` funds only **embeddings** (`embeddingService.js`), because `vector(768)` is dimensioned to that model and mixing providers corrupts similarity scores.
- `providerKeyService.js` resolves `(userId, provider)` → decrypted key via AES-256-GCM field-level encryption.

## Drafting conventions per SRS format

`utils/prompt_templates/srs_drafting_standard.js` is the single source for how a requirement is worded per format:
- **IEEE 830 / ISO 29148**: shall-based (`draftingConventionFor` returns normative-language rules)
- **Volere**: testability in **fit criterion**; descriptions may use words IEEE bans; `qualityAttributeRulesFor` is empty
- **Agile PRD**: user stories with Given/When/Then, never "The system shall"
- `ReviewerAgent`/`CriticAgent` take an optional `spec` — without it they default to IEEE 830 and mark other formats down for missing sections their method never defined.
- `tests/unit/srs_drafting_standard.test.js` guards cross-contamination.
- Identifier prefixes: `deriveProjectPrefix` (e.g., `FTP-REQ-001`), imported by both `v2_2_0` and agents.

## Prompt versioning

Prompts are versioned in `backend/src/utils/versions/` (`v1_0_0` … `v2_2_0`). Shared fragments in `prompt_templates/`. Old versions are kept for reproducibility, not deleted. Check which version is active before editing agent behavior.
