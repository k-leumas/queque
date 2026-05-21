---
id: T01
parent: S05
milestone: M001
provides:
  - TDD RED tests for FIFO-aware write in result-writer.ts (Plan 02 target)
  - TDD RED tests for ZELLIJ env guard in run-foreground.ts (Plan 02 target)
  - TDD RED tests for Zellij detection and FIFO launch in qq.zsh widget (Plan 03 target)
  - Passthrough vi.fn() wrappers for fsp.writeFile and fsp.rename in mock factory
  - runZshWithoutZellij() helper for clean Zellij env isolation in shell tests
requires: []
affects: []
key_files: []
key_decisions: []
patterns_established: []
observability_surfaces: []
drill_down_paths: []
duration: 22min
verification_result: passed
completed_at: 2026-05-14
blocker_discovered: false
---
# T01: 03.2 01

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
