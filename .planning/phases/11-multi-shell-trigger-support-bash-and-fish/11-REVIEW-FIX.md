---
phase: 11-multi-shell-trigger-support-bash-and-fish
fixed_at: 2026-11-15T08:36:59Z
review_path: .planning/phases/11-multi-shell-trigger-support-bash-and-fish/11-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 11: Code Review Fix Report

**Fixed at:** 2026-11-15T08:36:59Z
**Source review:** .planning/phases/11-multi-shell-trigger-support-bash-and-fish/11-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (WR-01 to WR-06; the Info items were out of scope)
- Fixed: 6
- Skipped: 0

**Where verification ran:** in the main checkout (`/Users/samuel/dev/tui-llm`, branch `spike/multi-shell-trigger`). No worktree was used. The caller named the main checkout as the working tree, the gates need its `node_modules`, and uncommitted `.wolf/` files there would have blocked a fast-forward from a worktree. Every number below can be reproduced from this tree.

**Gates after every fix:** `QQ_TEST_BASH=/opt/local/bin/bash PATH=/opt/local/bin:$PATH pnpm test:run` (the full suite, 66 files), `pnpm typecheck`, `pnpm exec biome check <changed files>` and `shellcheck -s bash shell/bash/queque.bash`. All passed after each fix, and no known flake showed up.

| Point | Tests passed |
|---|---|
| Baseline | 1849 |
| After WR-01 | 1850 |
| After WR-02 | 1851 |
| After WR-03 | 1855 |
| After WR-04 | 1858 |
| After WR-05 | 1862 |
| After WR-06 | 1872 |

Each new test was run before its fix and failed for the reason the review gives (TDD red, then green).

## Fixed Issues

### WR-01: The `en_US.UTF-8` locale fallback prints a setlocale warning into the user's terminal

**Files modified:** `shell/bash/queque.bash`, `tests/bash-widget.test.ts`
**Commit:** 456e2ea
**Applied fix:**
- The fallback is now `{ LC_ALL=en_US.UTF-8; } 2>/dev/null`, so the redirect covers the assignment.
- New test b24 rewrites the real `_qq_instant_frame` through `declare -f | sed` to use locale names that do not exist, then runs it under `LC_ALL=C`. It asserts that stderr is empty. Before the fix it showed the exact setlocale warning.
- The zsh widget needs no change: zsh does not print this warning.

### WR-02: A missing `jq` makes `??` a silent no-op that swallows both `?`

**Files modified:** `shell/bash/queque.bash`, `tests/bash-widget.test.ts`
**Commit:** c93a0cb
**Applied fix:**
- Right after the `qq` lookup and before the instant-frame paint, `type -P jq` is checked. If it fails, the adapter prints `queque: jq not found — install jq (see: qq doctor)` and returns with the line restored. Nothing has been painted at that point, so there is nothing to clear.
- `type -P` is used rather than `command -v` so that a user's `jq` function cannot hide a missing binary. This matches the adapter's `command jq` calls.
- New test b25 uses a PATH with no jq and a `jq` function defined. It checks for one stderr line, no paint, the line restored, and no client started.
- b8 now pins the check between the qq lookup and the paint.

### WR-03: `QQ_RESULT_FILE`, `QQ_PANE_WIDTH` and `QQ_PANE_HEIGHT` stay exported in the user's shell after every `??`

**Files modified:** `shell/bash/queque.bash`, `shell/zsh/queque.zsh`, `shell/README.md`, `tests/bash-widget.test.ts`, `tests/zsh-widget.test.ts`
**Commit:** 59876a6
**Applied fix:**
- Both adapters now use `local -x` instead of `export`. In bash and zsh this covers `QQ_RESULT_FILE` on both the inline path and the Zellij path, plus the pane size. zsh has `local -x` too, so the parity fix applies there.
- The client and the pane still inherit the values. When the function returns, the shell gets back its own value and export state.
- New bash test b26 covers the inline path and the Zellij path. It also checks that a `QQ_PANE_WIDTH=100` the user exported comes back unchanged.
- New zsh test "session env scope (WR-03)" runs the real widget on the inline path and also checks the source of the Zellij branch.
- `shell/README.md` now tells adapter authors to scope the export.

### WR-04: Client stderr is appended to a fixed, predictable path in world-writable `/tmp`

**Files modified:** `shell/bash/queque.bash`, `shell/zsh/queque.zsh`, `CONTRIBUTING.md`, `tests/bash-widget.test.ts`, `tests/zsh-widget.test.ts`
**Commit:** 9333ea1
**Applied fix:**
- The `2>>` redirect now defaults to `$tmpdir/client.err` in the 0700 session dir, instead of `/tmp/qq-${UID}-debug.log`. `QQ_DEBUG_LOG_FILE` still takes precedence when set.
- This applies to bash (`qq_log_file`, used by the Zellij launcher and the inline client) and to both zsh launches.
- New bash test b27 and new zsh test "client stderr target (WR-04)" both use a fake client that writes a unique line to stderr and then reads `<session>/client.err`. The tests check that the line is there and not in the fixed `/tmp` log. b27 also checks that `QQ_DEBUG_LOG_FILE` still collects the line.
- Trade-off: without `QQ_DEBUG_LOG_FILE`, the client's raw stderr (crash messages) is deleted along with the session dir. `CONTRIBUTING.md` now says to set `QQ_DEBUG_LOG_FILE` when chasing a client crash. The Node debug log (`src/shared/debug-log.ts`) still writes to `/tmp/qq-<uid>-debug.log`. That path has the same symlink exposure but was not part of this finding (see Notes).

### WR-05: The production client reads the test-only `QQ_TEST_RESULT_MODE`, and an empty or unknown value silently cancels every `??`

**Files modified:** `src/cli/commands/client.ts`, `tests/client-result.test.ts`, `CONTRIBUTING.md`
**Commit:** 59390e6
**Applied fix:**
- New exported `resolveResultMode(flag, envMode)`. The `--result-mode` flag wins and keeps its existing rules (an unknown flag value still means cancel).
- The env var counts only for `cancel` and `replace-buffer-fixture`. Any other value, including an empty one, is written to the debug log and ignored, so the real `llm` path runs.
- `tests/shell-pty.test.ts` still drives both fixture modes through the env var and stays green. New unit cases are under "resolveResultMode (WR-05)". The `CONTRIBUTING.md` table row is updated.

### WR-06: A commented-out source line counts as installed in `qq init`, the `integration` check and the `bash_profile` check

**Files modified:** `src/shared/shell-registry.ts`, `src/cli/commands/init.ts`, `tests/init-command.test.ts`, `tests/shell-registry.test.ts`, `tests/doctor.test.ts`
**Commit:** f308e2e
**Status:** fixed: requires human verification (the matching rules changed)
**Applied fix:**
- New `stripShellComments()` in the shell registry. It works line by line and keeps the line count. It cuts from the first unquoted `#` that starts a word. A `#` inside quotes or in the middle of a word stays.
- `hasShellIntegration` (used by `qq init` and the doctor `integration` row) and `loginFileSourcesBashrc` (the init hint and the doctor `bash_profile` row) now match on the stripped text.
- Per the review, the `# queque shell integration` marker alone no longer counts. `qq init` has always written the marker together with the source line (checked back to ef82529), so a marker on its own means the source line was deleted or commented out. In that case `qq init` now adds the integration again instead of printing "already present".
- The old test "returns true when the integration marker comment is present" now asserts `false` for a lone marker and `true` for marker plus source line.
- Please confirm the marker change. One user could see a duplicate: someone who loads the adapter in a way the regex does not recognise (for example `source "${HOME}"/x/queque.zsh`) would get a second source line from `qq init`. Sourcing the adapter twice is harmless, because it is built to be re-sourced.
- New tests cover these commented forms: `#`, `#source`, indented `#`, a trailing comment, and `;#`. They also check that a trailing comment after a real source line still counts, that a `#` inside a quoted or bare path still counts, that `qq init` re-adds a commented integration, and that doctor warns on both rows.

## Notes

- **Project rules kept:** D-12 is untouched (bash below 5 prints one startup line and binds nothing). The instant-frame parity test stayed green after every fix. Interactive shells in the new bash tests go through `spawnBash`, which spreads `...NO_TTY`.
- **Commits:** none has a Co-Authored-By trailer, and nothing was pushed. commitlint's subject-case rule rejected a subject that started with `WR-01`, so each finding id is in the commit body (`Review WR-0N.`).
- **`.wolf/` files:**
  - Each commit staged `buglog.json`, `memory.md` and `anatomy.md` by name. Buglog entries are bug-540, bug-541 and bug-549 to bug-552.
  - The OpenWolf hook added `auto-detected` noise entries to `buglog.json`. They were dropped before each commit, which is why ids 542 to 548 are missing.
  - The hook also rewrote anatomy entries for edited files. Each commit's anatomy diff was rebuilt from HEAD plus a one-line change.
  - `.wolf/cerebrum.md` got three Do-Not-Repeat entries and one Key Learning. It is uncommitted, left for the orchestrator to commit with this report. `.wolf/hooks/_session.json` is also modified by the hook and left alone.
- **Related exposures not changed (out of scope):**
  - `src/shared/debug-log.ts` appends to `/tmp/qq-<uid>-debug.log` with `appendFileSync`, which has the same symlink and FIFO exposure as WR-04.
  - zsh still exports `QQ_ZSH_VERSION` with `export`. It is harmless (it is not a path), but it is the same pattern as WR-03.
  - zsh has no jq pre-check like WR-02.

---

_Fixed: 2026-11-15T08:36:59Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
