---
phase: 10-linux-distro-ci-harness-and-anonymous-telemetry
plan: 02
subsystem: testing
tags: [prewarm, claude-cli, vitest, zsh, zle, mktemp, sigstop]

requires:
  - phase: 09.1
    provides: one-slot claude -p prewarm pool, warm init deadline (WR-02), cold retry
provides:
  - D-04 stale-prewarm simulation against real fixture children in the default suite
  - widget guard for a failed `mktemp -d` (Defect 3) with a regression test
affects: [10-11 openwolf records, 10-05 ci, linux distro smoke]

actuals:
  tokens: 2861
  tasks: 2
  commits: 3
plan_head_before: a7bdf0bdb7a48125c349d0d7fb60fa7a2f2e04ca
plan_head_after: 73a9396af2d95c3abd6063095a3d60291e11ccd6

tech-stack:
  added: []
  patterns:
    - "Claude shim on PATH (`#!/bin/sh` exec node fixture) so the real runner and pool spawn fixture children"
    - "Fake only Date (`vi.useFakeTimers({ toFake: ['Date'] })`) to age a prewarmed child; real timers and child I/O"
    - "zsh function shadowing (`mktemp() { return 1 }`) to simulate a full /tmp in widget tests"

key-files:
  created:
    - tests/prewarm-sleep.test.ts
  modified:
    - shell/zsh/queque.zsh
    - tests/zsh-widget.test.ts

key-decisions:
  - "D-04 needed no product change: the WR-02 init deadline already detects a frozen child; the test is a characterization test, proven by a mutation run"
  - "Defect 3 GREEN commit typed fix(10-02), not feat: semantic-release would cut a minor release for a bug fix"

patterns-established:
  - "End-to-end prewarm tests: real pool + real runner + PATH shim; mock only debug-log"

requirements-completed: [P10-PREWARM, P10-FIX]

coverage:
  - id: D1
    description: "Sleep then wake (SIGSTOP + SIGCONT): the prewarmed child is still a hit, no cold retry, 2 candidates, slot refilled with a new pid"
    requirement: P10-PREWARM
    verification:
      - kind: integration
        ref: "tests/prewarm-sleep.test.ts#takes a child that was stopped and continued (sleep then wake) and refills the slot"
        status: pass
    human_judgment: false
  - id: D2
    description: "Still frozen past its boot allowance: prewarm hit, cli init timed out, prewarm retry cold, 2 candidates, stopped pid gone, new idle pid"
    requirement: P10-PREWARM
    verification:
      - kind: integration
        ref: "tests/prewarm-sleep.test.ts#detects a child still frozen past its boot allowance, kills it and runs cold"
        status: pass
    human_judgment: false
  - id: D3
    description: "Idle child SIGKILLed from outside: prewarm miss { reason: 'dead' }, cold result, slot refilled"
    requirement: P10-PREWARM
    verification:
      - kind: integration
        ref: "tests/prewarm-sleep.test.ts#misses with dead when the idle child was killed out from under the daemon"
        status: pass
    human_judgment: false
  - id: D4
    description: "Failed mktemp -d: widget returns 0, restores LBUFFER/RBUFFER, shows `queque: cannot create a temp dir in /tmp`, never writes request.json or starts the client"
    requirement: P10-FIX
    verification:
      - kind: integration
        ref: "tests/zsh-widget.test.ts#mktemp failure > restores the typed line, shows one message and never starts the client"
        status: pass
      - kind: other
        ref: "zsh -n shell/zsh/queque.zsh"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-10-29
status: complete
---

# Phase 10 Plan 02: Stale Prewarm Simulation and mktemp Guard Summary

**This plan adds a vitest simulation that runs the real prewarm pool and runner against fixture `claude` children that are stopped, left frozen with the clock aged, or killed (D-04). It also adds a guard so a failed `mktemp -d` keeps the typed line and no longer writes `/request.json` at the filesystem root (Defect 3).**

## Performance

- **Duration:** 6 min
- **Started:** 2026-10-29T19:36:18Z
- **Completed:** 2026-10-29T19:42:06Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- The `tests/prewarm-sleep.test.ts` cases run on every PR through `pnpm test:run`:
  - **Wake:** a child that was stopped and continued is still a hit.
  - **Frozen and stale:** a child still frozen with `Date` aged 60 s misses its 1500 ms init deadline. It is SIGTERMed, then SIGKILLed after the grace period. The query then runs cold and the slot gets a new pid.
  - **Killed:** a SIGKILLed idle child gives `prewarm miss { reason: 'dead' }`.
- A mutation run showed the tests guard real behaviour. With `isStalePrewarmFailure` changed to ignore `stale-prewarm`, the frozen case fails. The source was then restored.
- The widget now stops when `mktemp -d` fails, before `request.json`, the tool handoff, the cleanup trap or the client launch. It clears the inline instant frame if it was painted, restores the buffers and calls `zle -M "queque: cannot create a temp dir in /tmp"`.

## Task Commits

1. **Task 1: D-04 stale-prewarm simulation:** `6111353` (test)
2. **Task 2: guard for a failed mktemp (Defect 3):** RED `cd1fef4` (test), GREEN `73a9396` (fix)

## Files Created/Modified
- `tests/prewarm-sleep.test.ts`: the three D-04 cases, using real children through a PATH shim.
- `shell/zsh/queque.zsh`: `mktemp -d /tmp/qq-sess.XXXXXX 2>/dev/null`, plus an empty or non-directory guard before `chmod 700`.
- `tests/zsh-widget.test.ts`: the `describe('mktemp failure')` regression case.

## Decisions Made
- Task 1 is a characterization test. The WR-02 behaviour in `src/providers/claude-cli.ts` already detects all three cases, so the plan's "fix detection in src/providers" branch was not needed.
- The GREEN commit is typed `fix(10-02)` rather than `feat(10-02)`, because semantic-release maps `feat` to a minor release.

## TDD Gate Compliance

- **Task 1:** The plan marks it `tdd="true"`, but it is test-only and the behaviour already existed, so RED was an expected "unexpected GREEN": the feature already exists. The test was checked with a mutation instead: after removing `stale-prewarm` from `isStalePrewarmFailure`, Case B fails (1 of 3 failed). Single commit `test(10-02)`.
- **Task 2:**
  - **RED** (`cd1fef4`): `pnpm exec vitest run tests/zsh-widget.test.ts -t "mktemp failure" --reporter=tap-flat` exited 1. `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK` (`target_test_failed`).
  - **Semantic check of the RED:** the target test ran and failed on its first planned assertion (`existsSync(marker)` was true). With mktemp failing, the widget still launched the client with `/request.json`, which is Defect 3. There were no load or fixture errors.
  - **GREEN** (`73a9396`, typed `fix` rather than `feat`, see Decisions Made): all 57 widget tests pass.
  - **REFACTOR:** none.

## Deviations from Plan

None that affect behaviour. Two notes on how criteria were checked:
- The plan's criterion `grep -c 'chmod 700 "$tmpdir"'` prints 0 on macOS, because BSD grep treats a `$` in the middle of a pattern as an anchor. `grep -cF` prints 1, and the line is unchanged.
- `pnpm lint` (`biome check .`) exits 1 inside this worktree with "No files were processed". biome.json excludes `!!**/.claude`, and the worktree path is under `.claude/worktrees/`. This is environmental and was already true before this plan. `pnpm exec biome check <the three files>` is clean, and so is the pre-commit lint hook.

**Total deviations:** 0 auto-fixed.

## Issues Encountered
None.

## Plan-level verification
- `pnpm test:run`: 44 files and 1087 tests passed.
- `pnpm typecheck`: exit 0.
- `pnpm lint`: see the worktree note above. The changed files lint clean.
- `zsh -n shell/zsh/queque.zsh`: clean.

## Folded todos
- `.planning/todos/pending/2026-10-13-09.1-stale-prewarm-after-sleep.md` is folded into this plan and covered by `tests/prewarm-sleep.test.ts`. Plan 11 moves it to done.

## OpenWolf entries

Plan 11 applies these. Wave 1 commits no `.wolf/` file.

- **anatomy.md** (tests/):
  `- \`prewarm-sleep.test.ts\` — D-04 stale-prewarm simulation (Phase 10): real pool + real runner via a \`claude\` PATH shim that execs fake-claude-stream.mjs; wake (SIGSTOP+SIGCONT → hit), frozen + Date aged 60 s (hit → cli init timed out → prewarm retry cold, pid gone, new idle pid), SIGKILLed idle (miss dead); only Date faked (~2400 tok)`
- **anatomy.md** (shell/zsh/queque.zsh, append to the existing line): `Phase 10 Defect 3: \`mktemp -d ... 2>/dev/null\` + empty/non-dir guard → clear the instant frame, restore buffers, \`zle -M "queque: cannot create a temp dir in /tmp"\`, return 0 before request.json`
- **anatomy.md** (tests/zsh-widget.test.ts, append): `mktemp failure (Defect 3: shadowed mktemp, stubbed zle, client marker)`
- **buglog.json:**
  ```json
  {
    "id": "bug-NNN",
    "timestamp": "2026-10-29T19:42:00Z",
    "error_message": "mktemp -d failed on a full /tmp; widget wrote /request.json",
    "file": "shell/zsh/queque.zsh",
    "root_cause": "tmpdir=$(mktemp -d /tmp/qq-sess.XXXXXX) was unguarded; an empty tmpdir made req_file /request.json and the tool handoff target /, and the client then failed with ENOENT",
    "fix": "silence mktemp stderr and, before chmod 700, return 0 on an empty or non-directory tmpdir: clear the instant frame if painted, restore LBUFFER/RBUFFER, zle -M 'queque: cannot create a temp dir in /tmp'",
    "tags": ["zsh", "widget", "mktemp", "tmp", "linux", "phase-10", "defect-3"],
    "related_bugs": [],
    "occurrences": 1,
    "last_seen": "2026-10-29T19:42:00Z"
  }
  ```
- **cerebrum.md Key Learnings:**
  - [2026-10-29] To test the real claude-cli prewarm path end to end, put an executable `claude` shim (`exec node fake-claude-stream.mjs success "$@"`) first on `process.env.PATH`. The runner and pool spawn `CLAUDE_COMMAND` with `process.env`. Age a prewarmed child with `vi.useFakeTimers({ toFake: ['Date'] })` plus `vi.setSystemTime`. A SIGSTOPped child still counts as `isRunning`, so it is a hit, and only the init deadline catches it.
  - [2026-10-29] macOS BSD grep treats a `$` in the middle of a pattern as an anchor: `grep -c 'chmod 700 "$tmpdir"'` prints 0. Use `grep -F` for literal shell snippets in acceptance criteria.
  - [2026-10-29] In a `.claude/worktrees/*` worktree, `pnpm lint` (`biome check .`) processes 0 files and fails, because biome.json excludes `!!**/.claude`. Lint explicit file paths there.

## Next Phase Readiness
- D-04 and Defect 3 are closed. `qq doctor` (plan 03) still owns the "/tmp writable" diagnosis.

## Self-Check: PASSED
- Found: tests/prewarm-sleep.test.ts, shell/zsh/queque.zsh, tests/zsh-widget.test.ts
- Commits on this branch: 6111353, cd1fef4, 73a9396 (`git rev-list --count a7bdf0b..HEAD` = 3)

---
*Phase: 10-linux-distro-ci-harness-and-anonymous-telemetry*
*Completed: 2026-10-29*
