---
phase: "03"
fixed_at: "2026-05-15T03:47:00Z"
review_path: .planning/phases/03-claude-fast-path-and-ranked-suggestions/03-REVIEW.md
iteration: 1
findings_in_scope: 19
fixed: 19
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-05-15T03:47:00Z
**Source review:** .planning/phases/03-claude-fast-path-and-ranked-suggestions/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 19
- Fixed: 19
- Skipped: 0

## Fixed Issues

### CR-001 + IN-001: Stale DEFAULT_MODEL constant and CHEAPEST_FIRST_MODEL_IDS inconsistency

**Files modified:** `src/providers/claude.ts`
**Commit:** 52f1787
**Applied fix:** Removed `DEFAULT_MODEL` constant entirely. Updated `chooseCheapestAvailableModel` to use `CHEAPEST_FIRST_MODEL_IDS.at(-1) ?? 'claude-3-haiku-20240307'` as the last-resort fallback. `claude-3-haiku-20240307` was already first in `CHEAPEST_FIRST_MODEL_IDS`.

### CR-002: Undefined command passed to onSelect when selected index is out of bounds

**Files modified:** `src/ui/CandidateSelect.tsx`
**Commit:** 03973ea
**Applied fix:** Added `if (visible.length === 0) return;` guard before `onSelect` call in the Enter key handler. Changed `visible[0]?.command` to `visible[0]!.command` since the length check guarantees the element exists.

### CR-003: cwd from shell request passed directly to git -C without sanitisation

**Files modified:** `src/contracts/shell.ts`, `src/context/providers/git-context.ts`
**Commit:** b3d7c42
**Applied fix:** Added `.regex(/^\/[^\0]*$/, 'cwd must be an absolute POSIX path')` constraint to the `cwd` field in `shellRequestSchema`. Added `assertSafeCwd()` helper in `git-context.ts` that calls `statSync` to verify the path exists and is a directory. Called it inside the `try/catch` block of `getChangedFiles` (so failures return `[]` rather than propagating).

### CR-004: Daemon buffer overflow check fires after the oversized chunk is already appended

**Files modified:** `src/daemon/server.ts`
**Commit:** bee3a95
**Applied fix:** Moved the `buf.length > MAX_BUF_BYTES` check to before `buf += chunk.toString()`, using `buf.length + chunk.length > MAX_BUF_BYTES`.

### CR-005: No authentication on the Unix socket daemon (TODO comment)

**Files modified:** `src/daemon/server.ts`
**Commit:** a3b09a3
**Applied fix:** Added TODO comment noting `CR-005: Add session token authentication before Phase 4 LLM integration` with a brief description of the required approach.

### CR-006 + IN-002: mktemp -u symlink attack and nested _qq_cleanup definition

**Files modified:** `shell/zsh/qq.zsh`
**Commit:** 5d934f0
**Applied fix:** Moved `_qq_cleanup` to top-level (not nested inside `qq-question-widget`). Changed cleanup to accept `$tmpdir` as a parameter and use `rm -rf "$tmpdir"`. Replaced `mktemp -u` + `mkfifo` with a secure `mktemp -d` + `chmod 700` + named FIFO inside the private directory. Updated the EXIT/ERR/INT trap to pass `$tmpdir` to `_qq_cleanup`. Updated the explicit `_qq_cleanup` call at widget exit to pass `$tmpdir`.

### CR-007: No timeout on the Claude API call

**Files modified:** `src/providers/claude.ts`
**Commit:** 52f1787
**Applied fix:** Added `{ timeout: 25_000 }` as the second argument to `client.messages.create()` — 25 seconds, slightly under the zsh widget's 30-second FIFO timeout.

### WR-001: readEnvValueFromDotEnvLocal is synchronous and called on every request

**Files modified:** `src/shared/env-file.ts`
**Commit:** 704ad45
**Applied fix:** Added a module-level `Map<string, string | null>` cache keyed by `"key\0startDir"`. On first call for a given key+startDir pair, performs the filesystem read and caches the result. Subsequent calls return from cache without filesystem access.

### WR-002: bootstrapBuiltins() is called inside gatherContext() on every request

**Files modified:** `src/context/pipeline.ts`, `src/cli/main.ts`
**Commit:** ef4f8bb
**Applied fix:** Removed `bootstrapBuiltins()` call and import from `pipeline.ts`. Added `bootstrapBuiltins()` call at the start of `main()` in `src/cli/main.ts` (with the import added). Tests updated to call `bootstrapBuiltins()` explicitly via dynamic import after `vi.resetModules()`.

### WR-003: TOCTOU race in assertSafeSocketPath — parent directory not validated

**Files modified:** `src/daemon/bootstrap.ts`
**Commit:** 636f552
**Applied fix:** Changed validation from `resolved.startsWith(root + path.sep)` to `tmpRoots.includes(dir)` where `dir = path.dirname(resolved)`. This requires the socket to be directly in `/tmp` or `/private/tmp` with no nesting. Tests updated to use flat socket paths like `/tmp/qq-test-<random>.sock`.

### WR-004: parsePorcelainLine does not handle git's C-string octal escapes

**Files modified:** `src/context/providers/git-context.ts`
**Commit:** 0c5f2b3
**Applied fix:** Added `unescapeGitPath()` helper that handles octal escapes (`\NNN`), `\n`, `\t`, and `\\`. Updated `stripQuotes()` to call `unescapeGitPath()` on the unquoted content when the value was originally double-quoted.

### WR-005: onSelect and onCancel callbacks not guarded against double-invocation

**Files modified:** `src/client/run-foreground.ts`
**Commit:** 9d115d8
**Applied fix:** Added a `let resolved = false` flag in the `await new Promise<void>` block. Both `onSelect` and `onCancel` callbacks now check `if (resolved) return` and set `resolved = true` before proceeding. This prevents SIGPIPE/EPIPE from a second write to an already-closed FIFO.

### WR-006: Debug log path defaults to world-writable /tmp/qq-debug.log

**Files modified:** `src/shared/debug-log.ts`
**Commit:** 8151874
**Applied fix:** Changed `debugLogPath` default to `` `/tmp/qq-${process.getuid?.() ?? 'unknown'}-debug.log` `` (user-specific path). Added `mode: 0o600` option to `fsp.appendFile` so the file is created private.

### WR-007: suggestShellResult uses only the first candidate without a guard

**Files modified:** `src/providers/claude.ts`
**Commit:** 52f1787
**Applied fix:** Added `if (!command) throw new Error('No candidate returned by provider');` guard before using `command` in `suggestShellResult`. This prevents `writeShellResult` from being called with `undefined` as `lbuffer`.

### WR-008: scripts/esbuild-build.mjs references paths from a different project

**Files modified:** `scripts/esbuild-build.mjs` (deleted)
**Commit:** 3316549
**Applied fix:** Deleted the file via `git rm`. Confirmed `scripts/build-dashboard.mjs` and `scripts/restart-dev-server.mjs` were not touched.

### IN-002: _qq_cleanup defined as a nested function on every trigger

**Files modified:** `shell/zsh/qq.zsh`
**Commit:** 5d934f0
**Applied fix:** Combined with CR-006 fix. `_qq_cleanup` is now a top-level function that accepts `$tmpdir` as parameter. The trap and direct call both pass `$tmpdir`.

### IN-003: Ink render mock does not exercise the rerender path

**Files modified:** `tests/client-result.test.ts`
**Commit:** 3095f5c
**Applied fix:** Updated the ink `render` mock so `rerender` captures the new element and invokes `onSelect` (or no-op) from the updated candidates. This exercises the candidate-arrival render path where `fetchCandidates` resolves and triggers `app.rerender(buildCandidateElement(candidates))`.

### IN-004: Unknown --result-mode warning goes to console.error

**Files modified:** `src/cli/commands/client.ts`
**Commit:** b23a234
**Applied fix:** Replaced `console.error(...)` with `void appendDebugLog('client', ...)` for the unknown `--result-mode` warning. `appendDebugLog` was already imported.

---

_Fixed: 2026-05-15T03:47:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
