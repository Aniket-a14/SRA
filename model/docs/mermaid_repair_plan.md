# Implementation Plan - Mermaid Syntax Repair Refinement

This plan outlines the steps to resolve the remaining Mermaid parsing errors in the SFT datasets (`train_sft.jsonl` and `test_sft.jsonl`) by refining the `repair_dataset.js` script.

## 1. Analysis of Current Failures

Based on `mermaid_audit.results.log`, the current failures fall into several categories:

### A. ERD Symbol Fragmentation
- **Error:** `erDiagramEmployee ||--o {ChildComment`
- **Diagnose:** Global repair logic split `{` into ` {\n`, breaking cardinality symbols like `o{` or `|{`.
- **Fix:** Cardinality symbols must be treated as atomic tokens during repair.

### B. Header Concatenation
- **Error:** `erDiagramUSER` instead of `erDiagram\nUSER`.
- **Diagnose:** AI generation or previous repair pass combined the diagram type with the first entity.
- **Fix:** Explicitly ensure a newline or space after the diagram declaration.

### C. Attribute/Block Malformation
- **Error:** `Expecting 'ATTRIBUTE_WORD', got 'BLOCK_STOP'` (e.g., `VOUCHER_TEMPLATE {}}`).
- **Diagnose:** Double braces or empty blocks are failing.
- **Fix:** Sanitize block closures to ensure they only exist where a block was actually opened.

### D. Flowchart Arrow Syntax
- **Error:** `CheckPermits -- Yes` (got 'SQE').
- **Diagnose:** `graph` syntax relies on `-->` for directed edges. `--` is used for labels but often misused by Gemini.
- **Fix:** Standardize on `-->|label|` or ensure labels are properly quoted.

## 2. Refined Repair Strategy

The `repairMermaidCode` function will be updated to use a **Context-Aware Pass** approach:

1.  **Normalization Pass**: Standardize capitalization and headers.
2.  **Symbol Protection Pass**: Temporarily replace ERD cardinality symbols (`o{`, `|{`, etc.) with placeholders to prevent global brace-splitting from breaking them.
3.  **Structural Pass**: Fix unclosed quotes/brackets at the block level.
4.  **Diagram-Specific Pass**:
    - **ERD**: Convert quoted entity names with spaces to underscores. Standardize attribute types.
    - **Flowchart**: Fix arrow labels (e.g., `--> "text" -->` to `-->|text|`).
    - **Sequence**: Fix `else if` and activation/deactivation markers.
5.  **Restoration Pass**: Restore protected symbols.

## 3. Implementation Tasks

- [ ] Task 1: Update `repair_dataset.js` with placeholders for ERD cardinality symbols.
- [ ] Task 2: Implement rigorous newline enforcement for Mermaid headers.
- [ ] Task 3: Refine the attribute/block closure logic in ERDs to handle double braces.
- [ ] Task 4: Run repair and validate against Playwright tests.

## 4. Verification Plan

- Run `node scripts/repair_dataset.js`.
- Execute Playwright audit: `npx playwright test tests/e2e/validate_mermaid_dataset.spec.ts`.
- Review `mermaid_audit.results.log` to confirm 0 failures.
