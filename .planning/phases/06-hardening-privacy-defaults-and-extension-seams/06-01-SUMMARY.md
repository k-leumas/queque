---
phase: 06-hardening-privacy-defaults-and-extension-seams
plan: 01
subsystem: testing
tags: [privacy, vitest, zsh, redaction, cmd-04]

requires:
  - phase: 02-intent-router-and-context-pipeline
    provides: gatherContext pipeline and git context provider
provides:
  - Privacy filter regression tests (filterContextEnvelope, redactForLog, isFileReadAllowed, malformed config)
  - Debug log redaction tests via appendDebugLog mock
  - Pipeline integration test proving filterContextEnvelope runs after provider gather
  - CMD-04 zsh insertion-only grep and replace-buffer tests
  - Destructive command warn-only UI tests in CandidateSelect
affects:
  - 06-02-PLAN.md
  - 06-03-PLAN.md

tech-stack:
  added: []
  patterns:
    - "Verify-and-extend: existing privacy-filter implementation unchanged; tests close gaps"
    - "Pipeline integration test uses isolated mock provider after vi.resetModules + resetBootstrap"

key-files:
  created:
    - tests/debug-log.test.ts
  modified:
    - tests/privacy-filter.test.ts
    - tests/context-pipeline.test.ts
    - tests/candidate-select.test.tsx
    - tests/zsh-widget.test.ts

key-decisions:
  - "No production code changes — existing privacy-filter, debug-log, pipeline, and CandidateSelect already met plan requirements"
  - "Pipeline integration test resets module registry to avoid bootstrap provider shadowing mock git provider"

patterns-established:
  - "Debug log tests mock node:fs/promises appendFile and assert redactForLog output in written lines"
  - "gatherContext privacy integration test: resetBootstrap + clearContextProviders + single mock git provider"

requirements-completed: [CMD-04]

duration: 15min
completed: 2026-06-18
---

# Phase 06 Plan 01: Privacy Defaults and CMD-04 Safety Summary

**Privacy filter, debug-log redaction, pipeline envelope filtering, and CMD-04 insertion-only guards verified with 11 new regression tests — no production code changes required.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 3 (verify + extend tests only)
- **Files modified:** 5
- **Tests:** 188 passing (was 177; +11 new tests)

## Accomplishments

- Verified `src/shared/privacy-filter.ts` exports and behavior; extended `tests/privacy-filter.test.ts` with sensitive path coverage, nested/array redactForLog, malformed config fail-closed defaults, and destructive-command edge cases
- Created `tests/debug-log.test.ts` confirming `appendDebugLog` passes details through `redactForLog` before JSON.stringify (default redacts, `QQ_DEBUG_VERBOSE=1` preserves lbuffer)
- Added pipeline integration test proving `gatherContext` output excludes `.env` from git `changedFiles` via `filterContextEnvelope`
- Extended CMD-04 zsh tests (no eval/accept-line; replace-buffer sets LBUFFER only) and CandidateSelect destructive warning + warn-only onSelect tests

## Task Commits

Per user instruction: **no commits made** — verify-only execution with test extensions.

## Files Created/Modified

- `tests/debug-log.test.ts` — appendDebugLog redaction regression (default + verbose)
- `tests/privacy-filter.test.ts` — extended sensitive paths, nested redactForLog, malformed config defaults, destructive edge case
- `tests/context-pipeline.test.ts` — gatherContext filters `.env` from mock git provider; fixed execFile mock callback signature
- `tests/candidate-select.test.tsx` — destructive warning placement and onSelect not blocked
- `tests/zsh-widget.test.ts` — CMD-04 accept-line grep + replace-buffer insertion test

## Verification Performed

| Criterion | Status |
|-----------|--------|
| `debug-log.ts` calls `redactForLog(details)` in formatDetails path | Verified |
| `pipeline.ts` logs `queryLength` not lbuffer | Verified |
| `run-foreground.ts` logs `lbufferLength` not raw lbuffer | Verified |
| `filterContextEnvelope` in gatherContext return path | Verified |
| No file byte reads in `src/context/providers/` | Verified (grep clean) |
| `CandidateSelect.tsx` destructive warning text | Verified |
| `pnpm test:run` exits 0 | **188/188 pass** |

## Decisions Made

- Left production privacy implementation unchanged — quick-task work from 20260617 already satisfied plan must-haves
- Pipeline integration test uses `vi.resetModules()` + `resetBootstrap()` + mock provider to avoid real git provider returning empty changedFiles

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed execFile mock callback signature in context-pipeline tests**
- **Found during:** Task 2 (pipeline integration test)
- **Issue:** Mock passed `{ stdout: '' }` object instead of `(err, stdout, stderr)` tuple expected by `promisify(execFile)`
- **Fix:** Updated callback signature to `callback(null, '', '')`
- **Files modified:** `tests/context-pipeline.test.ts`

**2. [Rule 3 - Blocking] Pipeline integration test registry isolation**
- **Found during:** Task 2
- **Issue:** Mock git provider shadowed by bootstrapped real provider due to module/registry caching
- **Fix:** `vi.resetModules()` + `resetBootstrap()` + `clearContextProviders()` before registering mock-only provider
- **Files modified:** `tests/context-pipeline.test.ts`

---

**Total deviations:** 2 auto-fixed (both Rule 3 blocking test issues)
**Impact on plan:** Test infrastructure only; no production code changes.

## Issues Encountered

None in production code. Initial sandbox EPERM on daemon socket tests resolved by running with full permissions.

## User Setup Required

None.

## Next Phase Readiness

- CMD-04 auditable via tests; privacy filter operational in pipeline
- Ready for 06-02 (extension seams) and 06-03 plans

## Self-Check: PASSED

- `tests/debug-log.test.ts` — FOUND
- All 188 tests — PASS

---
*Phase: 06-hardening-privacy-defaults-and-extension-seams*
*Completed: 2026-06-18*
