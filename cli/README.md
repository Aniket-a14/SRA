# SRA CLI

> **Bridging requirements and code through spec-driven development.**

The SRA CLI connects a source repository to a Software Requirements Specification generated
on the [SRA platform](https://github.com/Aniket-a14/SRA). It can start an analysis, follow it
live, pull the resulting document down, trace requirements to the files that implement them,
and publish that traceability back — in either direction, including generating a specification
*from* an existing codebase.

---

## Installation

```bash
pnpm install -g @sra-srs/sra-cli     # global
pnpm dlx @sra-srs/sra-cli doctor     # or run without installing
```

### Prerequisites

- **Node.js** >= 18 (the monorepo itself targets >= 20.19).
- **A platform API key.** Generate one under Settings in the web app; use the `rawKey` value
  (`sra_live_…`), which is shown once.
- **A provider API key configured on your account.** Generation is BYOK on every provider,
  including Gemini — the platform's own key funds embeddings only, so `analyze` and `reverse`
  cannot run without one. `sra doctor` reports whether you have one.

```env
# .env in your repository root
SRA_API_KEY=sra_live_your_key_here
```

`sra init` adds `sra.config.json` to `.gitignore` automatically. A key supplied through the
environment is never written to that file.

---

## Quick start

### Working from an existing specification

```bash
sra init                 # link this folder to an analysis
sra check --suggest      # propose which files implement each requirement
sra review               # approve or reject AI-generated requirements
sra push                 # publish traceability and decisions back
```

### Starting from prose

```bash
sra analyze requirements.md --format iso29148
```

### Starting from code that already exists

```bash
sra reverse --notes "Internal billing tool for the finance team."
```

---

## Commands

| Command | What it does |
|---|---|
| `sra init` | Links the folder to an analysis; writes `sra.config.json` and syncs. |
| `sra analyze [source]` | Starts an analysis from a file or stdin and follows it to completion. |
| `sra reverse` | Generates a specification from the codebase in this directory. |
| `sra sync` | Pulls the latest document into `sra.spec.json`. |
| `sra check` | Verifies requirements trace to files in the working tree. |
| `sra review` | Steps through requirements and records a human decision on each. |
| `sra push` | Publishes verification results and review decisions. |
| `sra status` | Shows the linked analysis; `--watch` follows a running one. |
| `sra list` / `sra projects` | Lists analyses / projects on the account. |
| `sra formats` | Shows the specification formats the platform can generate. |
| `sra doctor` | Diagnoses setup, credentials, connectivity and provider keys. |

Every read-only command accepts `--json` for scripting; in that mode stdout carries the payload
and nothing else. Add `--verbose` (or set `DEBUG`) for request-level tracing.

### `sra analyze [source]`

Reads a file, or stdin when passed `-` or piped to. Queues the analysis, then streams the
pipeline's real stages — product owner, RAG retrieval, architect, drafting, review — over the
platform's SSE channel, falling back to polling when live progress is unavailable. On success
it syncs the result automatically.

```bash
sra analyze spec.md --format volere --provider openai --model gpt-4o
cat notes.txt | sra analyze - --no-wait
```

### `sra reverse`

Reduces the repository to a structural digest — dependency manifests, module layout, HTTP
interface, data entities, exported symbols — and runs it through the same multi-agent pipeline
the web app uses. Generation stays server-side deliberately: it runs on your own provider key,
so a CLI-local model path would need a second key and would drift from what the platform
produces.

File discovery uses `git ls-files`, so `.gitignore` is respected; outside a repository it falls
back to a heuristic ignore list. Nothing is uploaded but the digest, which is bounded to fit
the platform's 50,000-character input limit.

```bash
sra reverse --dry-run              # write sra.digest.txt locally, call nothing
sra reverse --format agile-prd -y  # generate without the confirmation prompt
```

After generation it proposes `verification_files` for each requirement group by matching the
requirement's own terms back against the files it read — the document was written *from* this
code, so those links exist by construction. They are marked `proposed`, never `verified`, until
`sra check` confirms them.

### `sra check`

Two levels, answering different questions:

- **default** — do the linked files exist? Cheap enough for a pre-commit hook.
- **`--deep`** — do those files actually mention the requirement's own identifiers? Catches a
  link that pointed somewhere real and then rotted as the code moved.

Neither is a correctness proof, and the output says so. `--suggest` proposes files for groups
that have none; `--strict` exits non-zero on anything unlinked, missing or stale.

### `sra push`

Publishes verification results **format-aware**. For formats with a feature section (IEEE 830),
it patches `verification_files` onto the matching feature objects, preserving every field the
CLI never sees. For formats without one (Volere, ISO 29148, Agile PRD) it writes only the
format-independent `metadata.cliTraceability` record — inventing an IEEE section to hold CLI
state would corrupt the document with a section the format does not define.

Either way, the web app renders the traceability for every format. Updates are in place by
default and skip the paid alignment check, since a verification push changes no requirement
content; `--new-version` records the results as a new version instead.

---

## Files

| File | Purpose | Committed? |
|---|---|---|
| `sra.config.json` | Platform URL and the linked analysis/project ids. May hold a token. | No — auto-gitignored |
| `sra.spec.json` | The synced specification plus local verification state. | Yes — it is the traceability record |
| `sra.digest.txt` | Only written by `sra reverse --dry-run`. | No |

---

## Environment

| Variable | Effect |
|---|---|
| `SRA_API_KEY` / `SRA_TOKEN` | Platform credential. |
| `SRA_BACKEND_URL` | Override the platform URL (config file takes precedence). |
| `SRA_TRUSTED_HOSTS` | Comma-separated extra hosts the bearer token may be sent to. |
| `SRA_ALLOW_UNTRUSTED_HOST` | Set to `true` to disable the host allowlist entirely. |
| `SRA_USER` | Identity recorded on review decisions (defaults to `git config user.name`). |
| `DEBUG` | Request-level logging. |

The token is only ever sent to an allowlisted host. A `sra.config.json` that arrives with a
repository cannot redirect your credential to a third party.

---

## Development

```bash
pnpm --filter @sra-srs/sra-cli test    # Jest, native ESM
pnpm --filter @sra-srs/sra-cli lint
node bin/sra.js <command>              # run from the workspace
```

Layout: `src/api` (HTTP client with retry, `Retry-After` handling and SSE), `src/lib`
(spec/format/scanner/progress logic, where the testable behaviour lives), `src/commands`
(one file per command), `src/config`, `src/utils`.

---

## License

ISC © [SRA Team](https://github.com/Aniket-a14/SRA)
