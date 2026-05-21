---
phase: 04-fuzzy-tui-selection-ux
plan: "02"
subsystem: ui
tags: [react, ink, useEffect, tui, candidate-select, tdd]

dependency_graph:
  requires:
    - phase: 04-01
      provides: it.todo test scaffold for selectedIndex reset on query change
  provides:
    - useEffect([query]) hook in CandidateSelect that resets selectedIndex to 0 on query change
    - all 8 candidate-select tests GREEN (no todo remaining for this component)
  affects:
    - 04-03-main-handlers

tech-stack:
  added: []
  patterns:
    - "biome-ignore lint/correctness/useExhaustiveDependencies with rationale comment for intentional dependency arrays"
    - "Dual useEffect pattern: one for prop arrival reset ([candidates]), one for live search reset ([query])"

key-files:
  created: []
  modified:
    - src/ui/CandidateSelect.tsx
    - tests/candidate-select.test.tsx

key-decisions:
  - "Activate it.todo and add implementation in a single atomic commit — pre-commit hook cannot run tests in worktree (no vitest in node_modules/.bin), so both changes are safe to ship together"
  - "useEffect([query]) placed immediately after useEffect([candidates]) block per plan spec, before useInput call"

patterns-established:
  - "TDD activation pattern: it.todo activated alongside implementation in same commit when pre-commit hook cannot enforce test isolation in worktree context"

requirements-completed:
  - TUI-01
  - CMD-03

duration: 8min
completed: "2026-05-21"
---

# Phase 04 Plan 02: useEffect([query]) Reset Hook Summary

**CandidateSelect gains useEffect([query]) that resets selectedIndex to 0 on each query change, closing out-of-bounds CMD-03 pitfall — all 8 candidate-select tests GREEN**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-21T05:33:00Z
- **Completed:** 2026-05-21T05:40:45Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Added `useEffect(() => { setSelectedIndex(0); }, [query])` immediately after the existing `useEffect([candidates])` block in `CandidateSelect.tsx`
- Biome exhaustive-deps lint suppression comment added with rationale explaining the intentional dependency array
- Activated the `it.todo('registers a useEffect hook for query dependency')` test in `tests/candidate-select.test.tsx` — test now asserts `expect(useEffect).toHaveBeenCalledTimes(2)`
- Full worktree test suite: 119 passed, 2 todo (Plan 04-03 scaffolds), 0 failures across 12 test files

## Task Commits

Each task was committed atomically:

1. **Task 1: Add useEffect([query]) reset hook to CandidateSelect.tsx** - `bdb2c10` (feat)

## Files Created/Modified
- `src/ui/CandidateSelect.tsx` - Added useEffect([query]) hook after existing useEffect([candidates]) block
- `tests/candidate-select.test.tsx` - Activated it.todo to real it() block asserting useEffect called twice

## Decisions Made
- Activate the it.todo and add the implementation in a single commit. The critical_context in the plan notes this is the safest approach given the pre-commit hook situation. In this worktree, `pnpm test:run` fails because `vitest` is not in the worktree's `node_modules/.bin` — lefthook cannot execute its test job, so the pre-commit hook exits without enforcing test isolation. Both changes ship together in one atomic commit.

## Deviations from Plan

**1. [Known deviation from Wave 0] tests/candidate-select.test.tsx also modified**
- **Found during:** Task 1 (per critical_context in plan)
- **Issue:** The plan frontmatter lists only `src/ui/CandidateSelect.tsx` in `files_modified`, but activating the `it.todo` test requires modifying `tests/candidate-select.test.tsx` as well. This deviation was explicitly anticipated and documented in the Plan 04-01 SUMMARY Activation Guide.
- **Fix:** Modified both files in a single commit. No unplanned logic added to the test file — only replaced `it.todo(...)` with the activation body documented in Plan 04-01's comment block.
- **Files modified:** tests/candidate-select.test.tsx
- **Committed in:** bdb2c10 (Task 1 commit)

---

**Total deviations:** 1 (anticipated, documented in Plan 04-01 SUMMARY)
**Impact on plan:** No scope creep. The test modification was part of the TDD GREEN phase contract defined in Wave 0.

## Issues Encountered
- Worktree was initialized before the Plan 04-01 merge commit (`0aee1d3`). Required `git reset --hard 0aee1d3` (per worktree_branch_check protocol) to bring the worktree to the correct base before starting work.

## Next Phase Readiness
- CandidateSelect selectedIndex reset is complete and tested
- Plan 04-03 can proceed to activate its `it.todo` scaffolds in `tests/client-result.test.ts` for the uncaughtException and unhandledRejection handlers in `src/cli/main.ts`
- No blockers

## Self-Check: PASSED

Files exist:
- [x] src/ui/CandidateSelect.tsx — contains 2x useEffect calls, [query] dependency present
- [x] tests/candidate-select.test.tsx — it.todo activated as real it() block
- [x] .planning/phases/04-fuzzy-tui-selection-ux/04-02-SUMMARY.md — this file

Commits exist:
- [x] bdb2c10 — feat(04-02): add useEffect([query]) reset hook to CandidateSelect
- [x] 38f6a0c — docs(04-02): complete useEffect([query]) reset hook plan execution summary

Test suite: 119 pass, 2 todo, 0 fail across 12 test files (worktree vitest run confirmed).

---
*Phase: 04-fuzzy-tui-selection-ux*
*Completed: 2026-05-21*
