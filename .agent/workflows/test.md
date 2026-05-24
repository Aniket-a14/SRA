---
description: Run the full test suite for the SRA project
---

Use this workflow to ensure code quality, type-safety, and prevent regressions across the SRA monorepo workspaces.

1. **Backend Tests (Unit, Integration, and Contract)**:
   - To run the backend tests from the monorepo root:
     ```bash
     pnpm test:backend
     # or specifically target the backend workspace
     pnpm --filter backend test
     ```
   - **Testing Architecture note**: Testing in a native ES Module (ESM) environment introduces read-only binding constraints. SRA uses Jest dynamic mock orchestration:
     - Leverages `jest.unstable_mockModule` at the top of the test file to mock native modules (`child_process`, `fs/promises`) before imports occur.
     - Resolves dependencies using dynamic `await import` directives.
     - Runs on the node experimental VM engine via: `cross-env NODE_OPTIONS=--experimental-vm-modules jest`.

2. **Quality Audit & Linting**:
   - SRA maintains a strict **zero-warning standard** across both frontend and backend.
   - Run the linting suite monorepo-wide from the root directory:
     ```bash
     pnpm lint:all
     ```

3. **Pre-Commit Checks validation**:
   - Developers must test pre-commit validation gates locally before pushing code:
     ```bash
     pre-commit run --all-files
     ```
