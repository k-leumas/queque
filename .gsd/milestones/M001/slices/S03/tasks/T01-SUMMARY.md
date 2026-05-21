---
id: T01
parent: S03
milestone: M001
provides:
  - LLMAdapter interface (src/providers/provider.ts)
  - Claude implementation behind LLMAdapter (claudeAdapter export)
  - fetchCandidates named function for backward compat
  - shellResultSchema error variant (kind: 'error', message: string)
requires: []
affects: []
key_files: []
key_decisions: []
patterns_established: []
observability_surfaces: []
drill_down_paths: []
duration: 15min
verification_result: passed
completed_at: 2026-05-15
blocker_discovered: false
---
# T01: 03 01

**# Phase 03 Plan 01: LLMAdapter Contract, Claude Fast Path, and shellResultSchema Error Variant Summary**

## What Happened

# Phase 03 Plan 01: LLMAdapter Contract, Claude Fast Path, and shellResultSchema Error Variant Summary

**LLMAdapter interface established, Claude refactored to haiku-4-5 default without model polling, and shellResultSchema extended with error variant**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-15T04:32:00Z
- **Completed:** 2026-05-15T04:37:00Z
- **Tasks:** 3 (TDD: RED → GREEN)
- **Files modified:** 5

## Accomplishments

- Created `src/providers/provider.ts` with `LLMAdapter` interface (single `fetchCandidates` method, import-type only)
- Refactored `claude.ts`: removed model-list polling, replaced with `resolveModel()` using `claude-haiku-4-5-20251001` default or `QQ_MODEL` env override
- Deleted `suggestShellResult` (zero callers), added `claudeAdapter: LLMAdapter` named const export
- Extended `shellResultSchema` with `error` variant (`{ kind: 'error', message: string }`)
- Tests updated: removed `modelListMock` entirely, added QQ_MODEL override test, error variant positive/negative tests — all 112 tests green

## Task Commits

Each task was committed atomically:

1. **Task 1: Update failing tests (RED)** - `353655c` (test)
2. **Task 2: Create LLMAdapter interface** - `dc14eec` (feat)
3. **Task 3: Refactor claude.ts + extend shellResultSchema (GREEN)** - `330c416` (feat)

## Files Created/Modified

- `src/providers/provider.ts` — New file: `LLMAdapter` interface with `fetchCandidates(envelope: ContextEnvelope): Promise<CandidateList>`
- `src/providers/claude.ts` — Removed model polling loop, added `resolveModel()`, deleted `suggestShellResult`, added `claudeAdapter` export, updated system prompt
- `src/contracts/shell.ts` — Added `error` variant to `shellResultSchema` discriminated union
- `tests/claude-provider.test.ts` — Removed `modelListMock`, added `QQ_MODEL` override test, updated model assertion to `claude-haiku-4-5-20251001`
- `tests/shell-contract.test.ts` — Added two error variant tests (positive + missing message)

## Decisions Made

- `claude-haiku-4-5-20251001` as default: fast, cheap, no API poll needed at cold start
- `suggestShellResult` deleted rather than deprecated: confirmed zero external callers via grep
- `claudeAdapter` as named const (not class): matches standalone function export, minimal overhead
- `fetchCandidates` kept as named export for backward compatibility with `run-foreground.ts` direct import

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- Vitest requires running from worktree directory with `--root` flag since worktree shares node_modules with main repo but has its own test files; used `"$ROOT/node_modules/.bin/vitest" run --root "$WT"` pattern successfully

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 02 is unblocked: `shellResultSchema` error variant enables `writeShellResult` to accept `{ kind: 'error' }` without schema changes
- Plan 03 is unblocked: ZSH widget can now handle the `error` kind returned in FIFO
- `claudeAdapter` exported and typed as `LLMAdapter` — ready for `registerProviderBackend` wiring in bootstrap
- All 112 tests green; full suite passes

## Self-Check: PASSED

- src/providers/provider.ts: FOUND
- src/providers/claude.ts: FOUND
- src/contracts/shell.ts: FOUND
- 03-01-SUMMARY.md: FOUND
- commit 353655c (test RED): FOUND
- commit dc14eec (feat provider.ts): FOUND
- commit 330c416 (feat GREEN): FOUND
- All 112 tests green

---
*Phase: 03-claude-fast-path-and-ranked-suggestions*
*Completed: 2026-05-15*
