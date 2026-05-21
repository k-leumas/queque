---
id: T02
parent: S05
milestone: M001
provides:
  - FIFO-aware writeShellResult: stat().isFIFO() branch selecting direct write vs atomic rename
  - Zellij branch in runForegroundClient: inZellij detection, no /dev/tty open, no scroll hack, empty renderOptions
requires: []
affects: []
key_files: []
key_decisions: []
patterns_established: []
observability_surfaces: []
drill_down_paths: []
duration: 7min
verification_result: passed
completed_at: 2026-05-14
blocker_discovered: false
---
# T02: 03.2 02

**# Phase 3.2 Plan 02: Wave 2 — FIFO-Aware Write and Zellij Branch Implementation Summary**

## What Happened

# Phase 3.2 Plan 02: Wave 2 — FIFO-Aware Write and Zellij Branch Implementation Summary

**FIFO-aware writeShellResult using stat().isFIFO() branching, and Zellij env-gated run-foreground.ts that skips /dev/tty open and scroll hack when inside a Zellij pane**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-14T15:50:21Z
- **Completed:** 2026-05-14T15:57:09Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Extended `writeShellResult` in `result-writer.ts` with a `fsp.stat().isFIFO()` pre-check; FIFO paths get direct `fsp.writeFile()`, regular file paths retain the original atomic rename (tmp + rename) strategy
- Added `inZellij = process.env['ZELLIJ'] !== undefined` detection to `runForegroundClient`; gated `/dev/tty` open, TTY stream construction, and scroll hack behind `!inZellij`; removed `MODAL_CHROME_LINES` constant entirely
- Updated `renderOptions` to `{}` in Zellij path (D-09: pane PTY is process.stdout, no explicit stdin/stdout needed)
- Updated finally block to `ttyHandle?.close()` to safely handle null handle when `inZellij` is true
- Added `inZellij` to the `appendDebugLog` foreground-start payload for debuggability

## Task Commits

1. **Task 1: FIFO-aware writeShellResult** - `f44478a` (feat)
2. **Task 2: Zellij branch in run-foreground.ts** - `4b2b993` (feat)

## Files Created/Modified

- `src/client/result-writer.ts` — Added stat/isFIFO branch; updated JSDoc to describe dual-write strategy
- `src/client/run-foreground.ts` — Removed MODAL_CHROME_LINES; added inZellij detection + all gating changes
- `tests/client-result.test.ts` — Auto-fix: added ZELLIJ env isolation to non-Zellij path test and vi.clearAllMocks() to Zellij describe beforeEach

## Decisions Made

- Kept `ensureDaemon()` unconditional in the Zellij path — the daemon is pre-warmed by `_qq_prewarm_daemon` in the widget, so `ensureDaemon` returns in ~1ms when warm. Provides resilience if daemon was killed.
- `ttyHandle` typed as `fsp.FileHandle | null` implicitly; `?.close()` in finally block handles both cases without an explicit type annotation or conditional.
- `vi.clearAllMocks()` added to the Zellij branch `beforeEach` — running inside Zellij means `process.env.ZELLIJ` is set, so the "opens /dev/tty" test (non-Zellij path) requires ZELLIJ to be deleted temporarily. Without `clearAllMocks()`, the mock call history from that test leaked into the Zellij branch test's spy.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vi.spyOn call history leakage from non-Zellij path test**
- **Found during:** Task 2 (Zellij branch verification)
- **Issue:** The existing "opens /dev/tty for interactive stdio" test (plan 01, `runForegroundClient` describe) needed ZELLIJ deleted to test the non-Zellij path. After that test ran, `vi.spyOn` in the subsequent Zellij-branch test inherited stale `/dev/tty` calls in `mock.calls`. The Zellij test therefore failed even though the implementation was correct.
- **Root cause:** Tests running in Zellij session mean ZELLIJ env is set globally; the "opens /dev/tty" test deleted ZELLIJ but didn't clear mock history. The Zellij-branch test's `openSpy.mock.calls` was non-empty before the test ran.
- **Fix 1:** Added `vi.clearAllMocks()` to `beforeEach` in the `runForegroundClient: Zellij branch skips /dev/tty open` describe block.
- **Fix 2:** Added ZELLIJ env isolation (`save/delete/finally-restore`) to the "opens /dev/tty" test in `runForegroundClient` describe to prevent it from leaking ZELLIJ deletion state.
- **Files modified:** `tests/client-result.test.ts`
- **Commit:** `4b2b993`

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Test isolation fix required for correctness in Zellij development environments. No production code changes beyond plan scope.

## Test Results

### After Plan 02 implementation

| Test | Before | After |
|------|--------|-------|
| writes directly to FIFO path without rename when isFIFO() is true | RED (Plan 01 gate) | GREEN |
| uses atomic rename (tmp + rename) for regular file paths when isFIFO() is false | GREEN | GREEN |
| does not call fsp.open("/dev/tty") when process.env.ZELLIJ is defined | RED (Plan 01 gate) | GREEN |
| opens /dev/tty for interactive stdio instead of using inherited stdio | GREEN | GREEN |
| writes {kind: "cancel"} JSON to the result file | GREEN | GREEN |
| writes {kind: "replace-buffer"} JSON with lbuffer and rbuffer | GREEN | GREEN |
| emits a replace-buffer result in replace-buffer-fixture mode | GREEN | GREEN |
| emits a replace-buffer result in llm mode | GREEN | GREEN |

### Intentionally RED (Plan 03 targets)
- widget launches floating pane via zellij run per D-06
- prints a message referencing Zellij when ZELLIJ env var is not set
- widget contains mkfifo for FIFO creation per D-03
- widget launches with zellij run per D-06 (static content)
- widget does not contain /dev/tty redirect per D-02

**Overall: 104 passing / 5 failing (all failures are Plan 03 widget-rewrite targets)**

## Issues Encountered

None beyond the auto-fixed deviation above.

## Next Phase Readiness

- Plan 03 (Wave 2) can now proceed: `src/client/result-writer.ts` correctly writes to FIFO paths; `src/client/run-foreground.ts` renders Ink to pane PTY without /dev/tty setup
- The 5 remaining RED tests in `zsh-widget.test.ts` are the acceptance gate for Plan 03's widget rewrite

## Known Stubs

None — all implementations are fully wired with real behavior.

## Threat Flags

No new security surface beyond what is covered in the plan's threat model. The FIFO write path (`fsp.writeFile(resultFile, ...)`) and ZELLIJ env detection (`process.env['ZELLIJ'] !== undefined`) operate within the trust boundaries already documented in T-3.2-01 through T-3.2-04.

---
*Phase: 03.2-zellij-floating-pane-integration-for-best-ux*
*Completed: 2026-05-14*
