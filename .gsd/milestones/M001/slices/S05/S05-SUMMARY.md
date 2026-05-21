---
id: S05
parent: M001
milestone: M001
provides:
  - TDD RED tests for FIFO-aware write in result-writer.ts (Plan 02 target)
  - TDD RED tests for ZELLIJ env guard in run-foreground.ts (Plan 02 target)
  - TDD RED tests for Zellij detection and FIFO launch in qq.zsh widget (Plan 03 target)
  - Passthrough vi.fn() wrappers for fsp.writeFile and fsp.rename in mock factory
  - runZshWithoutZellij() helper for clean Zellij env isolation in shell tests
  - FIFO-aware writeShellResult: stat().isFIFO() branch selecting direct write vs atomic rename
  - Zellij branch in runForegroundClient: inZellij detection, no /dev/tty open, no scroll hack, empty renderOptions
requires: []
affects: []
key_files: []
key_decisions:
  - ESM non-configurable property limitation: add writeFile/rename to vi.mock factory as vi.fn() passthroughs instead of relying on vi.spyOn on ...original spread
  - vi.hoisted() used to capture original implementations before factory runs, enabling afterEach restoration without losing passthrough behavior
  - grep -c used for /dev/tty absence assertion because macOS grep -qL has non-standard exit code behavior (exits 0 even when pattern found)
  - TDD RED state for Tests A and C in client-result and all Phase 3.2 widget tests is intentional Wave 1 foundation
  - Guard ttyHandle construction with inZellij ? null so the null handle is explicit and optional chaining in finally handles both paths safely
  - Keep ensureDaemon() call unconditionally in Zellij path — near-zero cost when daemon is warm, provides resilience
  - modalHeight hardcoded to 14 (was MODAL_CHROME_LINES + 5 = 9 + 5) in remaining non-Zellij scroll hack — constant removed, value inlined
  - Test env isolation: vi.clearAllMocks() in Zellij describe beforeEach prevents vi.spyOn call history leakage from preceding tests running inside a Zellij session
patterns_established:
  - Pattern: capture real fsp implementations via vi.hoisted before vi.mock factory, restore in afterEach via mockImplementation
  - Pattern: runZshWithoutZellij() helper strips ZELLIJ from env copy using delete operator — does not mutate process.env
observability_surfaces: []
drill_down_paths: []
duration: 7min
verification_result: passed
completed_at: 2026-05-14
blocker_discovered: false
---
# S05: Zellij Floating Pane Integration For Best Ux

**# Phase 3.2 Plan 01: Wave 1 TDD Foundation — Test Contracts for FIFO and Zellij Integration Summary**

## What Happened

# Phase 3.2 Plan 01: Wave 1 TDD Foundation — Test Contracts for FIFO and Zellij Integration Summary

**TDD RED test contracts for FIFO-aware write (result-writer.ts), ZELLIJ env guard (run-foreground.ts), and Zellij widget detection/FIFO launch (qq.zsh) using vi.hoisted passthrough pattern for ESM mock safety**

## Performance

- **Duration:** 22 min
- **Started:** 2026-05-14T08:26:00Z
- **Completed:** 2026-05-14T08:48:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Extended `vi.mock('node:fs/promises')` with `stat: vi.fn()` returning `isFIFO() => false` by default, plus passthrough `vi.fn()` wrappers for `writeFile` and `rename` to enable per-test interception
- Added `writeShellResult — FIFO path` describe block with Test A (RED: rename not called for FIFO) and Test B (GREEN: atomic rename for regular files)
- Added `runForegroundClient: Zellij branch` describe block with Test C (RED: fsp.open('/dev/tty') skipped when ZELLIJ=0)
- Added `runZshWithoutZellij()` helper and Zellij detection describe block to zsh-widget.test.ts
- Added static content assertions for `mkfifo`, `zellij run`, and `/dev/tty` absence in widget

## Task Commits

1. **Task 1: Extend client-result.test.ts** - `2cec1c0` (test)
2. **Task 2: Extend zsh-widget.test.ts** - `480807a` (test)

## Files Created/Modified

- `tests/client-result.test.ts` — Extended with stat mock, FIFO-path describe block, Zellij branch describe block
- `tests/zsh-widget.test.ts` — Added runZshWithoutZellij helper, updated /dev/tty test, added Zellij detection + static content describe blocks

## Decisions Made

- Used `vi.hoisted()` to capture `original.writeFile` and `original.rename` before the `vi.mock` factory runs. This is the only way to restore passthrough implementations in `afterEach` when the mock factory installs `vi.fn()` wrappers — `mockRestore()` on a plain `vi.fn()` does not revert to the original.
- Used `grep -c` (count matches) instead of `grep -qL` (files without match) for the `/dev/tty` absence assertion because macOS `grep -qL` exits 0 even when the pattern is present — non-standard behavior that would silently pass the test before the widget is rewritten.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ESM vi.spyOn limitation on non-configurable exports**
- **Found during:** Task 1 (FIFO path tests)
- **Issue:** The plan called for `vi.spyOn(fsp, 'writeFile')` and `vi.spyOn(fsp, 'rename')`. Both properties come from `...original` spread in the mock factory, making them non-configurable ESM namespace bindings. `vi.spyOn` on non-configurable properties throws "Cannot redefine property: writeFile".
- **Fix:** Added `writeFile` and `rename` to the `vi.mock` factory as `vi.fn().mockImplementation(passthrough)` wrappers. Used `vi.hoisted()` to capture the real implementations before the factory runs. `afterEach` restores the passthrough via explicit `mockImplementation`. Tests use `vi.mocked(fspMock.writeFile)` on dynamic imports instead of `vi.spyOn`.
- **Files modified:** `tests/client-result.test.ts`
- **Verification:** All 6 previously passing client-result tests still pass; Test A goes RED as expected; Test B passes GREEN
- **Committed in:** `2cec1c0`

**2. [Rule 1 - Bug] macOS grep -qL non-standard exit code**
- **Found during:** Task 2 (static content assertions)
- **Issue:** The plan specified `spawnSync('grep', ['-qL', '>/dev/tty', widgetPath])` with `expect(result.status).toBe(0)` to assert the pattern is absent. On macOS, `grep -qL` exits 0 even when the pattern IS found — the test incorrectly passed while `>/dev/tty` is present in the widget.
- **Fix:** Changed to `grep -c '>/dev/tty' widgetPath`, parsed the count from stdout, asserted `count === 0`.
- **Files modified:** `tests/zsh-widget.test.ts`
- **Verification:** Test correctly fails RED (count is 1, not 0) while `>/dev/tty` remains in the widget
- **Committed in:** `480807a`

---

**Total deviations:** 2 auto-fixed (2x Rule 1 - Bug)
**Impact on plan:** Both fixes required for test correctness. No scope creep. The plan's stated test shapes are preserved; only the implementation mechanism changed to work within Vitest ESM constraints and macOS grep behavior.

## Issues Encountered

None beyond the auto-fixed deviations above.

## Next Phase Readiness

- Plan 02 (Wave 2) can now run: `src/client/result-writer.ts` FIFO branch + `src/client/run-foreground.ts` ZELLIJ gate tests are in place and RED
- Plan 03 (Wave 2) can now run: `shell/zsh/qq.zsh` rewrite tests are in place and RED
- Test isolation confirmed: all 102 pre-existing tests pass; new RED tests have clear assertion errors (not import/syntax errors)

---
*Phase: 03.2-zellij-floating-pane-integration-for-best-ux*
*Completed: 2026-05-14*

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

# Phase 03.2 Plan 03: qq-question-widget Zellij FIFO Rewrite Summary

**One-liner:** Rewrote qq-question-widget to use mkfifo + zellij run --floating IPC pattern, replacing the inline /dev/tty launch path, with a self-resetting EXIT/ERR/INT trap for cleanup.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rewrite qq-question-widget in shell/zsh/qq.zsh | 5251bdd | shell/zsh/qq.zsh |
| 2 | (Checkpoint: human-verify) | — | awaiting verification |

## What Was Built

**Task 1 — Widget rewrite (5251bdd):**

The `qq-question-widget` function in `shell/zsh/qq.zsh` was completely rewritten. The old pattern launched `qq client` directly with `/dev/tty` redirections. The new pattern:

1. Early-returns on single `?` (condition inverted to `!= *\?`)
2. Guards with `[[ -z "$ZELLIJ" ]]` — prints to stderr + `zle -M`, returns 1 (D-01)
3. Creates `req_file` via `mktemp` and `fifo_path` via `mktemp -u` + `mkfifo` (D-03, D-07)
4. Sets EXIT/ERR/INT trap calling `_qq_cleanup` which removes both temp files and resets itself (Pitfall 5)
5. Builds request JSON via jq -Rs . escaping (identical to prior implementation)
6. Backgrounds `zellij run --floating --close-on-exit --width 80 --height 24 -- qq client ... &!` (D-06)
7. Blocks on `IFS= read -r -t 30 result < "$fifo_path" || true` (D-05, Pitfall 3)
8. Applies result inline via jq from `$result` variable (Option B — no temp result file)
9. Calls `_qq_cleanup; zle -R; return 0`

All other functions preserved verbatim: `_qq_log`, `_qq_prewarm_daemon`, `_qq_capture_buffers`, `_qq_apply_result`, register+bind block.

## Test Results

All 109 tests pass (12 test files). The 5 RED tests introduced in Wave 1 are now GREEN:

- `widget launches floating pane via zellij run per D-06` — PASS
- `widget invokes qq client --request-file and --result-file` — PASS
- `widget contains mkfifo for FIFO creation per D-03` — PASS
- `widget launches with zellij run per D-06` — PASS
- `widget does not contain /dev/tty redirect per D-02` — PASS
- `Zellij detection: prints a message referencing Zellij when ZELLIJ env var is not set` — PASS

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Added stderr output for Zellij detection message**

- **Found during:** Task 1 verification (test run)
- **Issue:** `zle -M` can only be called from a ZLE widget context. When `qq-question-widget` is called in a non-interactive test environment (as `runZshWithoutZellij` does), `zle -M` fails silently and the "Zellij" string never appears in stdout/stderr. The test `expect(combined.toLowerCase()).toContain('zellij')` failed.
- **Fix:** Added `print -r -u2 "Que-Que requires Zellij — see https://zellij.dev"` before `zle -M ... 2>/dev/null || true`. In a live ZLE context, `zle -M` shows it cleanly below the prompt. In tests, `print -u2` writes to stderr which is captured in the combined output. The `2>/dev/null || true` on `zle -M` suppresses the "can only be called from widget function" error in non-ZLE contexts.
- **Files modified:** shell/zsh/qq.zsh
- **Commit:** included in 5251bdd

**2. [Rule 3 - Blocking issue] Symlinked node_modules for worktree test execution**

- **Found during:** Task 1 verification (initial test run attempt from worktree)
- **Issue:** The worktree has no `node_modules`. The pre-commit hook runs `pnpm test:run` from the worktree directory, which fails with "vitest: command not found".
- **Fix:** Created `node_modules` symlink in the worktree pointing to the main repo's `node_modules`. The symlink is excluded from git tracking via the existing `.gitignore` `node_modules/` entry.
- **Files modified:** node_modules (symlink, not tracked)
- **Commit:** not committed (runtime artifact, excluded by .gitignore)

## Checkpoint: Task 2 Pending Human Verification

Task 2 is a `checkpoint:human-verify` — see CHECKPOINT REACHED signal below.

## Known Stubs

None. The widget rewrite is complete and wired to the full IPC chain established in Plans 01 and 02.

## Threat Surface Scan

No new security surface introduced beyond what is already documented in the plan's threat model. The cleanup trap (T-3.2-03 mitigation) is implemented via `_qq_cleanup` with `trap - EXIT ERR INT` reset. The fifo_path is generated by `mktemp -u` inside the widget, not derived from LBUFFER (T-3.2-02 mitigation). jq -Rs . escaping applied to all user-controlled values in the JSON build block.

## Self-Check

Files:
- [x] shell/zsh/qq.zsh — FOUND and modified
- [x] .planning/phases/03.2-zellij-floating-pane-integration-for-best-ux/03.2-03-SUMMARY.md — this file

Commits:
- [x] 5251bdd — feat(03.2-03): rewrite qq-question-widget with Zellij FIFO IPC

## Self-Check: PASSED
