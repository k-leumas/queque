---
phase: 01-shell-bridge-and-result-contract
fixed_at: 2026-05-01T17:00:00Z
review_path: .planning/phases/01-shell-bridge-and-result-contract/01-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-05-01T17:00:00Z
**Source review:** .planning/phases/01-shell-bridge-and-result-contract/01-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8
- Fixed: 8
- Skipped: 0

## Fixed Issues

### CR-01: Shell injection in zsh JSON construction via unquoted `$PWD` and `$tty_path`

**Files modified:** `shell/zsh/qq.zsh`
**Commit:** 0cdf9f7
**Applied fix:** Added `tty_json` and `cwd_json` local variables that pipe `$tty_path` and `$PWD` through `printf '%s' | jq -Rs .` before interpolating them into the heredoc JSON. Both scalars are now escaped identically to the pre-existing `lbuffer`/`rbuffer` handling.

---

### CR-02: Path traversal / arbitrary script execution in daemon bootstrap

**Files modified:** `src/daemon/bootstrap.ts`
**Commit:** c52f958
**Applied fix:** Added `assertSafeSocketPath()` function that resolves the path and validates it starts under `os.tmpdir()` (portable across macOS and Linux), has a basename starting with `qq-`, and ends with `.sock`. Called at the top of `ensureDaemon()` before any `fs.unlinkSync` or `spawn` call. Used `os.tmpdir()` instead of the hardcoded `/tmp/` from the review suggestion so the validation holds on all POSIX systems and matches the patterns used by the test suite.

---

### CR-03: Unbounded buffer growth in daemon socket data handler

**Files modified:** `src/daemon/server.ts`
**Commit:** 0b693af
**Applied fix:** Added a `MAX_BUF_BYTES = 64 * 1024` constant and a guard after each `data` append that calls `socket.destroy()` if the buffer exceeds the limit. Also refactored the `while ((nl = buf.indexOf('\n')) !== -1)` assignment-in-expression pattern (which biome flagged as an error on staged files) to a two-statement form with `nl` initialized before the loop and updated at the end of each iteration.

---

### WR-01: Race condition in daemon bootstrap — TOCTOU between `tryConnect` and `unlinkSync`

**Files modified:** `src/daemon/bootstrap.ts`
**Commit:** a06a608
**Applied fix:** Added a detailed code comment above the `unlinkSync` call documenting the TOCTOU window, its risk (destroying a live socket from a concurrent terminal tab), its acceptability for the MVP single-session assumption, and that a file-based lock (O_EXCL) will be needed before multi-window use is supported.

---

### WR-02: Daemon bootstrap `qqScript` path resolved without existence check

**Files modified:** `src/daemon/bootstrap.ts`, `tests/daemon-bootstrap.test.ts`
**Commit:** 4726543
**Applied fix:** Added `fs.existsSync(qqScript)` guard before `spawn` that throws a clear error message if the built script is absent. Updated `daemon-bootstrap.test.ts` to mock `node:fs` so `existsSync` returns `true` for paths ending in `main.js` (the qqScript check) while delegating all other calls to the real `fs.existsSync` so existing socket/file operations in tests are unaffected.

---

### WR-03: `run-foreground.ts` opens `/dev/tty` but never uses the file descriptor

**Files modified:** `src/client/run-foreground.ts`
**Commit:** 92bce4b
**Applied fix:** Replaced the misleading "the foreground client owns the TTY" comment with a clear Phase 1 / Phase 4 framing: the handle is a pre-flight accessibility check only, no I/O is performed on it in Phase 1, and Phase 4 will pass the handle to the Ink TUI for interactive I/O.

---

### WR-04: `resultMode` silently defaults to `cancel` for any unknown value

**Files modified:** `src/cli/commands/client.ts`
**Commit:** cda875d
**Applied fix:** Extracted a `parseResultMode()` helper with explicit branches for each valid mode. Unknown values now emit `console.error("Warning: unknown --result-mode ...")` before returning `'cancel'`. Added `VALID_MODES` const tuple and `ResultMode` type for future extensibility.

---

### WR-05: `writeShellResult` performs a non-atomic write

**Files modified:** `src/client/result-writer.ts`
**Commit:** 5d92a94
**Applied fix:** Replaced the direct `fsp.writeFile(resultFile, ...)` with a write-to-tmp-then-rename pattern: write to `${resultFile}.tmp`, then `fsp.rename(tmpFile, resultFile)`. On the same filesystem, `rename(2)` is atomic. Updated the JSDoc to describe the invariant and the crash-recovery behaviour (no result file appears, zsh falls back to cancel).

---

_Fixed: 2026-05-01T17:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
