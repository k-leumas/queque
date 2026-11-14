---
phase: 11-multi-shell-trigger-support-bash-and-fish
plan: 07
subsystem: shell-integration
tags: [bash, readline, compgen, tool-handoff, zellij, fifo, prewarm, vitest, tmux, tdd]

requires:
  - phase: 11-03
    provides: "client tools.pending wait (TOOL_HANDOFF_PENDING, 500 ms budget), start-early/await-late handoff read"
  - phase: 11-06
    provides: "bash instant frame: _qq_write_pane_instant_frame, QQ_PANE_PAINT_SCRIPT, QQ_ZELLIJ_FRAME_COLUMNS"
provides:
  - "_qq_write_tool_handoff (compgen -c / -b / public functions + aliases), _qq_start_tool_handoff (tools.pending + silent detached writer)"
  - "two-flag _qq_cleanup (closed + tools.pending): the session dir is removed exactly once by whichever side finishes last"
  - "_qq_prewarm_daemon at source time; QQ_DAEMON_PREWARMED=1 skips it"
  - "bash Zellij floating-pane path: guarded mkfifo, read-write FIFO opened before launch, read -r -t QQ_RESULT_READ_TIMEOUT_S (30), launcher-failure sentinel"
  - "bash-widget b10-b23 (no b18-b20/b22-b23 gaps) and PTY handoff-quiet / hostile-env scenarios"
affects: [11-09, 11-10, 11-11, phase-12-fish]

actuals:
  tokens: 8700
  tasks: 2
  commits: 4
plan_head_before: 43c48611bae9eefdf77b96529763946bc217dca0
plan_head_after: 37bca15ddc03d0e68419bf7614d9548b952a5de5

tech-stack:
  added: []
  patterns:
    - "Detached shell work inside a bind -x function only in the ( { …; } </dev/null >/dev/null 2>&1 & ) form: no job notices"
    - "Two-flag cleanup: each side sets its own flag (closed / removes tools.pending) before checking the other's"
    - "FIFO result read: open read-write ({fd}<>) BEFORE the launch, read -r -t -u fd; the launcher writes a sentinel through 1<> on failure"

key-files:
  created:
    - .planning/phases/11-multi-shell-trigger-support-bash-and-fish/.red/11-07-task1-red.json
    - .planning/phases/11-multi-shell-trigger-support-bash-and-fish/.red/11-07-task2-red.json
  modified:
    - shell/bash/queque.bash
    - tests/bash-widget.test.ts
    - tests/shell-pty.test.ts

key-decisions:
  - "The FIFO read end is opened before zellij run, not after: FIFO data is dropped when no end is open, so a launcher that fails within microseconds would otherwise lose its sentinel and the shell would wait the full 30 s"
  - "A failed read-write FIFO open is handled like a failed mkfifo (restore, log 'fifo open failed', cleanup, return)"
  - "_qq_start_tool_handoff skips the writer when tools.pending cannot be created, so a marker-less writer can never race the client's immediate read"
  - "tests/bash-widget.test.ts cleanEnv sets QQ_DAEMON_PREWARMED=1 by default (b17 clears it), so sourcing the adapter in tests never starts a real daemon"
  - "OQ1: hash -r kept per D-05 inside the detached writer; freshness proven by b12, not by that line"
  - "OQ4: read-write FIFO open is bash-only; zsh unchanged this phase (follow-up candidate below)"

patterns-established:
  - "Session-dir pending marker on the adapter side: create tools.pending synchronously, writer removes it last, then removes the dir if closed exists"
  - "Fake zellij as a shell function in every Zellij test, asserted with type -t zellij"

requirements-completed: [BASH-01]

coverage:
  - id: D1
    description: "bash writes commands.txt / builtins.txt / functions.txt from compgen in the 0700 session dir, never chained on compgen status, fresh for binaries created after the hash table was primed, and QQ_TOOL_AWARENESS=0 writes nothing"
    requirement: BASH-01
    verification:
      - kind: integration
        ref: "tests/bash-widget.test.ts#b10, b11, b12, b15"
        status: pass
    human_judgment: false
  - id: D2
    description: "The writer runs detached (start returns in ~1 ms with tools.pending present), and the two-flag cleanup removes the session dir exactly once whichever side finishes last, including after a cancel result and a client crash"
    requirement: BASH-01
    verification:
      - kind: integration
        ref: "tests/bash-widget.test.ts#b13, b14 (2 cases), b21 (2 cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Hostile alias grep / alias rm / jq function corrupt neither the handoff files, request.json nor the cleanup; source-time prewarm runs once, quietly, and QQ_DAEMON_PREWARMED=1 skips it"
    requirement: BASH-01
    verification:
      - kind: integration
        ref: "tests/bash-widget.test.ts#b16, b17 (2 cases)"
        status: pass
      - kind: e2e
        ref: "tests/shell-pty.test.ts#bash hostile-env"
        status: pass
    human_judgment: false
  - id: D4
    description: "A bash ?? round trip with the writer and prewarm active prints no job notice and leaves no session dir"
    requirement: BASH-01
    verification:
      - kind: e2e
        ref: "tests/shell-pty.test.ts#bash handoff-quiet"
        status: pass
    human_judgment: false
  - id: D5
    description: "Inside Zellij bash launches the unchanged client in a floating pane with the instant-frame wrapper (query never in argv), applies the FIFO line, exports QQ_RESULT_FILE / QQ_PANE_WIDTH / QQ_PANE_HEIGHT, and returns cleanly on a dead pane, a failed mkfifo and a failed zellij run"
    requirement: BASH-01
    verification:
      - kind: integration
        ref: "tests/bash-widget.test.ts#b18 (2 cases), b19 (2 cases), b20, b22, b23"
        status: pass
    human_judgment: false
  - id: D6
    description: "Real Zellij floating pane on screen with bash (frame visible, pane closes, line comes back) and real-model not-installed flags from a bash ??"
    verification: []
    human_judgment: true
    rationale: "Tests fake zellij (never drive the user's real Zellij session) and run the client in fixture mode; plan 11-11 UAT covers the on-screen pane and live flags"

duration: 17min
completed: 2026-11-14
status: complete
---

# Phase 11 Plan 07: bash tool handoff, prewarm and Zellij pane Summary

**bash now matches zsh on D-05 and D-07. A detached compgen scan writes the installed-tool files alongside client startup behind a `tools.pending` marker, and a two-flag cleanup removes the session dir exactly once. Sourcing the adapter prewarms the daemon quietly. Inside Zellij, the picker opens in a floating pane, and the shell never hangs: not on a dead pane, a failed mkfifo or a failed `zellij run`.**

## Performance

- **Duration:** about 17 min
- **Started:** 2026-11-14T13:32:02Z
- **Completed:** 2026-11-14T13:49:00Z
- **Tasks:** 2, both TDD (RED then GREEN each)
- **Files modified:** 3 source/test files, plus 2 RED evidence records

## Accomplishments

- **D-05 writer.** `_qq_write_tool_handoff` runs `hash -r`, then writes `compgen -c`, `compgen -b`, and `compgen -A function | command grep -v '^_'` plus `compgen -a` into the three files. Nothing branches on compgen's exit status. Only an empty commands.txt removes all three files. The output stays unordered: no `sort` in the adapter.
- **Detached start.** `_qq_start_tool_handoff` creates `tools.pending`, then starts the writer in the `( { …; } </dev/null >/dev/null 2>&1 & )` form. When the writer finishes, it removes the marker, and then removes the dir if `closed` exists. `_qq_question` calls it right after request.json is written and logs `tool handoff started`.
- **Two-flag cleanup.** `_qq_cleanup` writes `closed`, then removes the dir only if the marker is gone. Every exit after the session dir exists goes through it: accepted, cancel, error, malformed or missing result, client crash, and the Zellij setup failures.
- **Prewarm.** `_qq_prewarm_daemon` ports zsh's. It sets the `QQ_DAEMON_PREWARMED` gate to 1 first, then runs the `QQ_DEV_ROOT` node bundle, or else `type -P qq`, with `daemon --ensure`, in the silent subshell form. It is called once after the bindings.
- **D-07 Zellij path.** The adapter calls `command mkfifo` and checks its status. It opens the FIFO with `exec {fd}<>` before the launch and exports the FIFO path as `QQ_RESULT_FILE` and the pane size. It writes the pane frame (width minus `QQ_ZELLIJ_FRAME_COLUMNS` when the width is all digits) and runs `zellij run --floating --close-on-exit --width W --height H --name qq -- /bin/sh -c "$QQ_PANE_PAINT_SCRIPT" queque-instant-frame <frame> <client argv>` detached. If the launcher exits non-zero, it writes `QQ_LAUNCH_FAILED` through `1<>`. The adapter then reads with `IFS= read -r -t "$QQ_RESULT_READ_TIMEOUT_S" -u "$fd"`. The 11-06 SC2034 disables are gone, because the constants are now read.
- **Hardening.** Every external tool is called through `command` except `zellij`, which stays bare by design so tests can fake it, as in zsh. The adapter's only grep is `command grep`.

## Measured handoff time (this machine, bash 5.3 MacPorts, 27 PATH dirs, 2319 names)

- `_qq_write_tool_handoff` alone: 53-77 ms over 5 runs (the spike measured 80-88 ms)
- `_qq_start_tool_handoff` returns in 1 ms. The marker is gone 64-74 ms after the start, well inside the client's 500 ms `tools.pending` budget, and Node startup alone takes longer than that.

## Task Commits

1. **Task 1: detached compgen scan, pending marker, two-flag cleanup, prewarm, hostile env**: RED `88ab475` (test), GREEN `a24b0ff` (feat)
2. **Task 2: Zellij floating pane with a guarded setup and a bounded FIFO read**: RED `432dd45` (test), GREEN `37bca15` (feat)

**Plan metadata:** the SUMMARY commit (docs)

## Files Created/Modified

- `shell/bash/queque.bash`: tool handoff section, prewarm section, Zellij constants (`QQ_RESULT_READ_TIMEOUT_S=30`, `QQ_ZELLIJ_LAUNCH_SENTINEL`), two-flag `_qq_cleanup`, and the Zellij branch in `_qq_question`
- `tests/bash-widget.test.ts`: b10-b17, b21 (Task 1), b18-b20, b22, b23 (Task 2); `cleanEnv` now defaults `QQ_DAEMON_PREWARMED=1` and drops exported adapter knobs
- `tests/shell-pty.test.ts`: bash `handoff-quiet` (prewarm on) and `hostile-env` scenarios, `expectSessionDirGone`
- `.red/11-07-task1-red.json`, `.red/11-07-task2-red.json`: RED evidence records

## TDD Gate Compliance

- **Task 1 RED** `88ab475`: target `tests/bash-widget.test.ts > bash adapter: tool handoff, cleanup and prewarm (bash 5) > b13: the writer runs detached: tools.pending at once, then the files and no marker`, run with `QQ_TEST_BASH=/opt/local/bin/bash CI=true pnpm --silent exec vitest run tests/bash-widget.test.ts -t "b13" --reporter=tap-flat` (exit 1). `gsd-tools check tdd-red-evidence`: `RED_EVIDENCE_OK` (`target_test_failed`).
  - **Semantic assessment:** the target ran and failed on its planned assertion. `_qq_start_tool_handoff` did not exist yet (status 127), so no marker was created. This is a missing implementation, not a load, syntax or fixture fault. 11 of 32 cases failed this way, and the PTY `handoff-quiet` / `hostile-env` cases failed only on `tool handoff started` missing from the log (both round trips worked).
  - The first capture was `invalid_record` (a multi-line `toContain` diff made the TAP malformed, cerebrum 2026-10-08). b13's first assertion was rewritten as a one-line scalar `toBe` before the RED commit.
- **Task 1 GREEN** `a24b0ff`: bash-widget 32/32, PTY 20/20, shellcheck clean.
- **Task 2 RED** `432dd45`: target `… > bash adapter: Zellij floating pane (bash 5) > b18: zellij run gets the pane argv with the frame wrapper and never the query` (exit 1, `RED_EVIDENCE_OK`).
  - **Semantic assessment:** the fake zellij was defined (`zellij=function`, and that assertion passed) and `_qq_question` completed. The planned assertion (an argv file exists) failed because the adapter had no Zellij branch and ran the client inline. 6 of 39 cases failed for that reason.
- **Task 2 GREEN** `37bca15`: bash-widget 39/39, PTY + parity 77/77.
- **REFACTOR:** none needed.

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The FIFO read end is opened before the launch**
- **Found during:** Task 2 (design of the sentinel path)
- **Issue:** the plan opens the FIFO read-write at read time, after the detached launch. A FIFO drops its data once no end is open, so a launcher that fails before the adapter opens its descriptor would lose the sentinel, and b23 would wait the full 30 s.
- **Fix:** `exec {fd}<>"$fifo"` runs before `zellij run`. The launcher subshell closes its inherited copy (`exec {fd}<&-`). A failed open restores the line, logs `fifo open failed` and cleans up, the same as a failed mkfifo.
- **Files modified:** `shell/bash/queque.bash`
- **Verification:** b23 returns in well under 5 s, and b19 applies the FIFO line.
- **Committed in:** `37bca15`

**2. [Rule 1 - Bug, test] BSD printenv prints only one variable**
- **Found during:** Task 2 GREEN
- **Issue:** the fake zellij's `printenv QQ_PANE_WIDTH QQ_PANE_HEIGHT` printed only the width on macOS, so b19 failed even though both values were exported.
- **Fix:** one `printenv` call per name.
- **Files modified:** `tests/bash-widget.test.ts`
- **Committed in:** `37bca15`

**3. [Rule 3 - Blocking] b21 as two explicit `it()` calls**
- **Found during:** Task 1 acceptance check
- **Issue:** b21 was written with `it.each`, so the acceptance grep `it\('b21` found 0 matches.
- **Fix:** two `it('b21: …')` cases share one helper. The behaviour is unchanged.
- **Committed in:** `a24b0ff`

**4. [Rule 2 - Missing critical, test] Tests never start a real daemon or inherit adapter knobs**
- **Issue:** sourcing the adapter now prewarms. With a real `qq` on the developer's PATH, every bash-widget case would have started or replaced the daemon. Exported `QQ_PANE_*`, `QQ_INSTANT_FRAME` or `QQ_TOOL_AWARENESS` would also change the argv and the file assertions.
- **Fix:** `cleanEnv` sets `QQ_DAEMON_PREWARMED=1` (b17 deletes it) and removes those knobs.
- **Committed in:** `88ab475`

---

**Total deviations:** 4 auto-fixed (2 bugs, 1 blocking, 1 missing critical). **Impact:** all of them keep the plan's contract. Deviation 1 is what makes the plan's own b23 time bound hold.

## Issues Encountered

- PTY `handoff-quiet` runs with the prewarm on (`QQ_DAEMON_PREWARMED=0` in its rc), so it runs `node <scratch>/dist/cli/main.js daemon --ensure`. Fixture mode already ensures the daemon (research Pitfall 9), so a local run swaps the dev daemon once, as before.
- No timing flake hit this run: full `pnpm test:run` 1755/1755.

## zsh follow-up candidate

zsh (shell/zsh/queque.zsh, Zellij branch) has none of these three protections today, and this phase does not change the zsh widget:
1. **Read-write FIFO open before the launch.** zsh's `read -r -t 30 result < "$fifo_path"` blocks in open() until a writer appears, so a pane that never starts hangs the widget with no timeout.
2. **mkfifo status check.** zsh assumes mkfifo succeeds. If it fails, the read targets a missing path, or a regular file created by the client.
3. **Launcher-failure sentinel.** A `zellij run` that exits non-zero leaves zsh waiting the full 30 s.

## Known Stubs

None.

## Threat Flags

None. The writer writes only fixed names inside the 0700 session dir, and the Zellij path adds no new trust boundary beyond the plan's threat model (T-11-21 to T-11-24 are mitigated and tested).

## Verification

- `CI=true QQ_TEST_BASH=/opt/local/bin/bash pnpm exec vitest run tests/bash-widget.test.ts`: 39 passed, 0 skipped
- `CI=true QQ_TEST_BASH=/opt/local/bin/bash pnpm exec vitest run tests/shell-pty.test.ts tests/instant-frame-parity.test.ts`: 77 passed, 0 skipped
- `pnpm test:run`: 1755 passed. `pnpm typecheck`: clean. `pnpm lint`: 166 files, clean. `shellcheck -s bash shell/bash/queque.bash`: clean
- Acceptance greps, Task 1: `tools.pending` 8, `closed` 6, `hash -r` 1, `compgen -A function` 1, `it('b1[0-7]` 10, `it('b21` 2, PTY `it('(handoff-quiet|hostile-env)` 2, grep lines 1 = `command grep` 1, non-comment `sort` 0
- Acceptance greps, Task 2: `zellij run --floating --close-on-exit` 1, `command zellij` 0, `QQ_RESULT_READ_TIMEOUT_S=30` 1, `read -r -t` 1, `it('b(18|19|20|22|23)` 7, `type -t zellij` 2, `mkfifo failed` 1, `zellij run failed` 1

## User Setup Required

None.

## Next Phase Readiness

- Bash not-installed flags and steering now work end to end (the 11-03 gap is closed). 11-11 UAT should check a real `??` in bash for a flagged candidate, and the floating pane in a real Zellij session.
- Phase 12 (fish) can reuse the marker protocol and the two-flag cleanup. fish has no `read -t` (cerebrum 2026-11-13), so its FIFO timeout needs another mechanism.

## Wolf entries

Not committed from the worktree; for the orchestrator (plan 11) to apply.

**anatomy.md**
- Update `shell/bash/queque.bash`: now also has the installed-tool handoff (`_qq_write_tool_handoff`, `_qq_start_tool_handoff`, `tools.pending`), two-flag `_qq_cleanup`, `_qq_prewarm_daemon`, and the Zellij branch (`QQ_RESULT_READ_TIMEOUT_S=30`, `QQ_ZELLIJ_LAUNCH_SENTINEL`, read-write FIFO). About 560 lines (~5500 tok).
- Update `tests/bash-widget.test.ts`: b1-b23 (b10-b17, b21 handoff, cleanup, prewarm, hostile env; b18-b20, b22, b23 Zellij with a fake `zellij` function). About 960 lines (~9500 tok).
- Update `tests/shell-pty.test.ts`: adds the bash `handoff-quiet` and `hostile-env` scenarios.

**cerebrum.md, Key Learnings**
- FIFO data is dropped once no end is open. A shell that waits for a sentinel from a detached launcher must open its read end (`exec {fd}<>fifo`) BEFORE launching, or a launcher that fails fast loses the sentinel.
- `{ exec {fd}<>"$f"; } 2>/dev/null` keeps the new fd open after the group and restores stderr. It is a quiet, checkable open. A bare `exec {fd}<>"$f" 2>/dev/null` would redirect the shell's stderr for good.
- macOS (BSD) `printenv A B` prints only A. Use one `printenv` per name in tests.
- bash `( { …; } </dev/null >/dev/null 2>&1 & )` inside a `bind -x` function gives no job notice on 5.3 either (PTY handoff-quiet). Research assumption A1 is confirmed.
- bash 5.3 `compgen -c` lists a binary created after the hash table was primed (b12). Research assumption A2 is confirmed, so `hash -r` is not needed for freshness.

**cerebrum.md, Do-Not-Repeat**
- [2026-11-14] A vitest RED target whose first assertion is `toContain` on a multi-line string makes `--reporter=tap-flat` output malformed (`actual:` spans lines), and tdd-red-evidence returns `invalid_record`. Assert a one-line scalar with `toBe` first.
- [2026-11-14] The worktree Bash guard refuses `node "$S/script.mjs" …` with a computed script path. Put multi-step helper calls in a scratchpad `.sh` and run it with `sh FILE`.

**buglog.json**
- bug: b19 failed `expected [ '80' ] to deeply equal [ '80', '24' ]`. Root cause: BSD printenv prints only its first argument. Fix: one printenv per variable in the fake zellij. Tags: test, macos, printenv, zellij.
- bug: Task 1 RED evidence `invalid_record` (Non-TAP data). Root cause: a multi-line `toContain` actual in the tap-flat output. Fix: a one-line scalar `toBe` as b13's first assertion. Tags: tdd, tap, vitest.

## Self-Check: PASSED

- FOUND: shell/bash/queque.bash, tests/bash-widget.test.ts, tests/shell-pty.test.ts, .red/11-07-task1-red.json, .red/11-07-task2-red.json
- FOUND commits: 88ab475, a24b0ff, 432dd45, 37bca15 (all on this branch, all subjects carry `(11-07)`)

---
*Phase: 11-multi-shell-trigger-support-bash-and-fish*
*Completed: 2026-11-14*
