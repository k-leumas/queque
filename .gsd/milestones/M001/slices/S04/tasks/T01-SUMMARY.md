---
id: T01
parent: S04
milestone: M001
provides: []
requires: []
affects: []
key_files: []
key_decisions: []
patterns_established: []
observability_surfaces: []
drill_down_paths: []
duration: 
verification_result: passed
completed_at: 
blocker_discovered: false
---
# T01: 03.1 01

**# Phase 03.1 Plan 01: Wave 0 Test Infrastructure Summary**

## What Happened

# Phase 03.1 Plan 01: Wave 0 Test Infrastructure Summary

**One-liner:** Vitest TSX discovery enabled, ink mocked for modal-always path, and CandidateSelect Wave 2 test contracts scaffolded with it.skip.

## What Was Built

Wave 0 establishes the test infrastructure for Phase 03.1 before any source changes begin.

### Task 1: vitest.config.ts — TSX test discovery

Added `tests/**/*.test.tsx` to the `test.include` array. The new `candidate-select.test.tsx` file is now discovered and run by vitest.

### Task 2: client-result.test.ts — ink mock for modal-always path

Added `vi.mock('ink', ...)` that immediately invokes `onSelect` with the first candidate's command via `Promise.resolve().then()`. This prevents the "emits a replace-buffer result in llm mode" test from hanging when Wave 2 removes the single-candidate fast-accept bypass (D-03). The "Que-Que is thinking..." assertion was already absent from the HEAD version.

### Task 3: tests/candidate-select.test.tsx — Wave 2 contract scaffold

Created the test file with 4 test cases (1 active smoke test, 3 skipped contracts):
- **Loading state smoke test** (active, passes): creates element with `candidates=null`, must not throw
- **filterCandidates logic** (skipped): Wave 2 must only accept "git status" when `initialQuery='git'`
- **Keyboard navigation** (skipped): Wave 2 must call `onCancel` when Escape is pressed via `useInput`
- **D-01 pre-filter** (skipped): Wave 2 must filter by `initialQuery` prop; only matching candidate selected on Enter

The 3 skipped tests use `it.skip` rather than being active RED tests, so the pre-commit hook (`pnpm test:run`) continues to exit 0 at Wave 0. Wave 2 changes `.skip` to regular `it` as it implements each feature.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Constraint] Used it.skip instead of active RED tests**

- **Found during:** Task 3 commit attempt
- **Issue:** The pre-commit hook runs `pnpm test:run` (full suite). Active failing tests would block all subsequent commits in this wave. The plan's `must_haves` says `pnpm test:run exits 0` which conflicts with keeping tests actively RED.
- **Fix:** Changed the 3 Wave 2 contract tests to `it.skip`. They are documented test contracts (not deleted), the file exists as required, and `pnpm test:run` exits 0. Wave 2 will remove `.skip` when implementing.
- **Files modified:** `tests/candidate-select.test.tsx`
- **Commit:** 048cd76

## Test Results

```
Test Files  12 passed (12)
Tests       98 passed | 3 skipped (101)
```

All existing tests continue to pass. The 3 skipped tests are Wave 2 contracts.

## Known Stubs

None — this plan only modifies test infrastructure, not production code.

## Self-Check

Files exist:
- [x] `tests/candidate-select.test.tsx` — FOUND
- [x] `vitest.config.ts` — FOUND (modified)
- [x] `tests/client-result.test.ts` — FOUND (modified)

Commits exist:
- [x] 8d826c4 — chore(03.1-01): extend vitest include to discover .test.tsx files
- [x] 59c43e7 — test(03.1-01): add ink mock to client-result tests for modal-always behavior
- [x] 048cd76 — test(03.1-01): scaffold candidate-select tests targeting Wave 2 behavior

## Self-Check: PASSED
