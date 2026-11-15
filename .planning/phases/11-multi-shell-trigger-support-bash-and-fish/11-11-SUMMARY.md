---
phase: 11-multi-shell-trigger-support-bash-and-fish
plan: 11
subsystem: shell-integration
tags: [bash, uat, ci, phase-gate, openwolf, macos, zellij]

requires:
  - phase: 11-multi-shell-trigger-support-bash-and-fish
    provides: "bash adapter (01, 06, 07), request shell fields (02), tools.pending (03), registry and qq init (04), telemetry (05), doctor --shell (08), distro smoke and bash-versions CI (09), docs and invariant test (10)"
provides:
  - "Phase 11 gate green with bash 5 present: 66 files, 1849/1849 tests, typecheck, lint, shellcheck, actionlint, build"
  - "BASH-01 confirmed by hand on macOS (MacPorts bash 5.3.20, inline and Zellij, live Ollama model) and on Linux in CI"
  - "Interactive-bash tests run without a controlling tty (NO_TTY), so the pre-push hook matches CI"
  - "Final D-12: bash older than 5.0 prints one startup line and binds nothing"
affects: [phase-12-fish, verify-work-11]

actuals:
  tokens: 13000
  tasks: 2
  commits: 7
plan_head_before: a76cda8fdbef62fbcfe6aa0a25050bf28dd62c9d
plan_head_after: 69e3e810dd0d9cedba7303cf537a8c8805d44093

tech-stack:
  added: []
  patterns:
    - "Spawn interactive shells in tests with `detached: true` (new session, no controlling tty) so hook and CI runs behave alike"

key-files:
  created: []
  modified:
    - tests/helpers/shells.ts
    - tests/bash-widget.test.ts
    - tests/instant-frame-parity.test.ts
    - .wolf/anatomy.md
    - .wolf/cerebrum.md
    - .wolf/memory.md
    - .wolf/buglog.json

key-decisions:
  - "D-12 final: bash < 5.0 prints `queque: the ?? trigger needs bash 5.0+ (found <version>)` and binds nothing. A `??` warning binding was tried (cab3e59) and reverted (5d5c69f) because it delayed rendering of the first `?` on bash 3.2"
  - "For unsupported environments, prefer a no-op plus one clear line over workarounds that cost typing UX"
  - "Test-only fix for the pre-push failure: spawn `bash -i` in a new session (`NO_TTY = { detached: true }`) instead of changing the adapter or the hook"

patterns-established:
  - "Test helpers that spawn `bash -i` spread `NO_TTY` into spawnSync options"

requirements-completed: [BASH-01]

coverage:
  - id: G1
    description: "Full gate with bash 5 present: tests, typecheck, lint, shellcheck, actionlint, build; Docker bash 3.2/4.4 refuse, 5.0 accepts"
    requirement: BASH-01
    verification:
      - kind: unit
        ref: "QQ_TEST_BASH=/opt/local/bin/bash PATH=/opt/local/bin:$PATH pnpm test:run (66 files, 1849/1849) on 69e3e81"
        status: pass
      - kind: other
        ref: "pnpm typecheck, pnpm lint, shellcheck -s bash shell/bash/queque.bash, actionlint, pnpm build; scripts/ci/bash-version-check.sh in bash:3.2, bash:4.4, bash:5.0"
        status: pass
    human_judgment: false
  - id: U1
    description: "macOS bash UAT: inline ??, Esc restore, history entry, missing-tool flag, Zellij pane, old-bash refusal line, doctor --shell bash"
    requirement: BASH-01
    verification:
      - kind: manual
        ref: "UAT steps 1-6, route A, MacPorts bash 5.3.20, Ollama provider; developer replied \"approved\""
        status: pass
    human_judgment: true
    rationale: "Feel parity with zsh (D-04) and the on-screen instant frame are perceptual; macOS has no CI runner"
  - id: C1
    description: "GitHub CI green on 69e3e81: ci-ok, checks, bash-versions, six distro test and smoke legs"
    requirement: BASH-01
    verification:
      - kind: other
        ref: "https://github.com/k-leumas/queque/actions/runs/43634554226"
        status: pass
    human_judgment: false

duration: about 5h40m wall clock (08:12 to 13:52 CST, mostly UAT round trips)
completed: 2026-11-14
status: complete
---

# Phase 11 Plan 11: Final gate, macOS bash UAT and CI Summary

**The phase 11 gate is green with bash 5 present: 1849 of 1849 tests pass, along with typecheck, lint, shellcheck, actionlint and build. In Docker, bash 3.2 and 4.4 are refused and bash 5.0 is accepted. On macOS the developer approved the bash UAT: inline `??`, Zellij, the old-bash refusal line and `qq doctor --shell bash`, on MacPorts bash 5.3.20 with a live Ollama model. CI run 43634554226 on 69e3e81 is fully green. Two problems came up during the checkpoint and were fixed. The developer tried a `??` warning for old bash, then had it reverted. The pre-push hook failed because tests that spawn `bash -i` inherited the terminal; they now start in a new session with no controlling tty.**

## Performance

- **Started:** 2026-11-14T08:12:01-06:00 (base a76cda8)
- **Completed:** 2026-11-14T13:52:30-06:00 (69e3e81)
- **Tasks:** 2 of 2 (Task 1 gate, Task 2 UAT checkpoint approved)
- **Files modified:** 3 test files, 4 `.wolf/` records (see "Wolf housekeeping" for two stray `.wolf/` files)

## Task 1: Phase gate

The gate was re-run after every change. The last run was on 69e3e81.

| Check | Command | Result |
|---|---|---|
| Full suite | `QQ_TEST_BASH=/opt/local/bin/bash PATH=/opt/local/bin:$PATH pnpm test:run` | 66 files, 1849/1849 pass |
| Full suite under a real tty | pty harness that copies the lefthook pre-push hook (vitest in a background process group on a tty) | pass |
| Typecheck | `pnpm typecheck` | pass |
| Lint | `pnpm lint` | pass |
| Adapter lint | `shellcheck -s bash shell/bash/queque.bash` | pass |
| Workflow lint | `actionlint` | pass |
| Build | `pnpm build` | pass |
| bash version policy (Docker) | `scripts/ci/bash-version-check.sh` | bash:3.2 refuse, bash:4.4 refuse, bash:5.0 accept (rc 0) |

Task 1 itself made no commit. The OpenWolf entries from plans 02-10 were applied in a76cda8 (wave 4 tracking) and moved to their real paths in 24d0785.

## Task 2: macOS bash UAT (checkpoint:human-verify): APPROVED

**Environment:** bash 5.3.20 from MacPorts (`/opt/local/bin/bash`, not Homebrew). `/bin/bash` is 3.2.57. Provider: Ollama. tmux 3.6a, zellij 0.44.1.

**Startup route: A** for every step: `/opt/local/bin/bash --noprofile --rcfile ~/.bashrc -i`. `~/.bash_profile` does not source `~/.bashrc`, so doctor's `bash_profile` row warns, which is the expected result.

| Step | What was checked | Route | Result |
|---|---|---|---|
| 1-3 | Inline `??`: the first `?` shows at once, the instant frame appears, the pick lands in the line without running, Esc restores the line, Up shows the original query in history, and a missing tool shows the not-installed mark | A | pass |
| 4 | Inside Zellij: `??` opens the floating pane and the pick lands in the bash line | A | pass |
| 5 | `/bin/bash --noprofile --rcfile ~/.bashrc -i` prints exactly one line, `queque: the ?? trigger needs bash 5.0+ (found 3.2.57(1)-release)`, binds nothing, and `??` types two literal `?` | A (required) | pass, refusal line seen |
| 6 | `qq doctor --shell bash`: bash 5.3.20 ok, `~/.bashrc` ok, binding ok, `bash_profile` warn | n/a | pass |
| 7 | CI on the pushed branch | n/a | green (see below) |

The developer replied **"approved"**.

## CI

https://github.com/k-leumas/queque/actions/runs/43634554226 on 69e3e81: **success**.

- `ci-ok` green
- `checks` (zsh and bash PTY harness) green
- `bash-versions`: 3.2 refuses, 4.4 refuses, 5.0 accepts
- `test-distro` and `smoke` green on alpine:3.24, debian:13, ubuntu:22.04, ubuntu:24.04, fedora:44 and archlinux:latest

## Gate fixes (files outside `.wolf/`)

| File | Change | Commit |
|---|---|---|
| tests/helpers/shells.ts | new `NO_TTY = { detached: true }` export | 69e3e81 |
| tests/bash-widget.test.ts | `...NO_TTY` in `spawnBash` spawnSync options | 69e3e81 |
| tests/instant-frame-parity.test.ts | `...NO_TTY` in `runAdapter` spawnSync options | 69e3e81 |

The adapter files (`shell/bash/queque.bash`, `scripts/ci/bash-version-check.sh`, `docs/INSTALL.md`, `shell/README.md`, `ci.yml`) and the two test files that cab3e59 touched were changed and then reverted to their state at the plan base. Their net diff is zero.

## Task Commits

1. **Task 1: Phase gate**: no commit (gate only). The OpenWolf path fix landed during the checkpoint as `24d0785` (chore).
2. **Task 2: UAT checkpoint deviations**:
   - `cab3e59` fix: `??` warning on old bash, merged in `012bef1`, wolf record `5d03e1e`
   - `5d5c69f` revert of cab3e59, wolf record `f6b5837`
   - `69e3e81` fix: interactive bash in tests without a controlling tty

**Plan metadata:** this SUMMARY commit (docs).

## Decisions Made

See `key-decisions` in the frontmatter. UAT confirmed D-09 (doctor rows), D-12 (old-bash refusal, final form) and D-14 (version floor and refusal behaviour).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Anatomy entries recorded under worktree paths**
- **Found during:** checkpoint (after wave merges)
- **Issue:** the `.wolf/anatomy.md` entries for phase 11 files were recorded under `.claude/worktrees/...` paths.
- **Fix:** re-recorded under the real repo paths.
- **Files modified:** .wolf/anatomy.md, .wolf/memory.md, .wolf/buglog.json
- **Commit:** 24d0785

**2. [User request, then reverted] `??` warning on bash older than 5.0**
- **Found during:** UAT step 5. The developer said "the second ? fails silently" and asked for a warning when `??` is typed on old bash.
- **Attempt:** cab3e59 (merged in 012bef1, wolf 5d03e1e) bound `??` in emacs and vi-insert to a quoted-insert macro plus a private chord that ran a one-line hint.
- **Problem:** on bash 3.2 the first `?` did not render until the next key was pressed.
- **Resolution:** the developer asked "can we just not install on unsupported versions?" and chose "one startup line, bind nothing", which is the original D-12. Reverted in 5d5c69f; decision recorded in f6b5837.
- **Lesson:** for unsupported environments, prefer a no-op plus one clear line over workarounds that cost typing UX.

**3. [Rule 1 - Bug] Pre-push hook failed 6 bash-widget tests (bug-538)**
- **Found during:** the developer's push for step 7
- **Issue:** stderr showed `bash: initialize_job_control: no job control in background: Bad file descriptor`, or the shell hung on SIGTTOU. The tests spawned `bash -i`, which inherited the developer's controlling tty from lefthook. The agent's Bash tool has no tty, so the gate never hit this.
- **Fix:** `NO_TTY = { detached: true }` in tests/helpers/shells.ts, spread into spawnSync in tests/bash-widget.test.ts and tests/instant-frame-parity.test.ts. Verified with a pty harness that copies the hook.
- **Files modified:** tests/helpers/shells.ts, tests/bash-widget.test.ts, tests/instant-frame-parity.test.ts
- **Commit:** 69e3e81

**Total deviations:** 3. **Impact:** test-only code change. The adapter behaviour is unchanged from plans 01-10.

## Wolf housekeeping (found while writing this summary, not fixed here)

- 69e3e81 also committed `.wolf/anatomy.md.orig` (1217 lines, a merge leftover) and a cut-down `.wolf/hooks/_session.json`. The `.orig` file should be removed in a follow-up chore commit.
- The escaping in `.wolf/buglog.json` flipped from `\u` escapes to literal characters in 24d0785 and back in 69e3e81. At HEAD it uses `\u` escapes again, as the base did, so the net diff from a76cda8 is append-only (+230 lines).

## Follow-ups

- Todos already tracked: `2026-11-14-fuzz-single-input-budget.md`, `2026-11-14-zsh-zellij-fifo-hardening.md`.
- Possible: `qq init bash` could prefer a PATH bash 5 or newer when the login shell is macOS `/bin/bash` 3.2. The current refusal matches D-14.
- Prune stale `.claude/worktrees` sections from `.wolf/anatomy.md`.
- Known load flakes that pass when run alone: the command-words-fuzz single-input case and the zsh-widget prewarm case.

## Next Phase Readiness

- BASH-01 is satisfied on macOS by hand and on Linux in CI. The phase is ready for `/gsd-verify-work 11`.

## Self-Check: PASSED

- FOUND: .planning/phases/11-multi-shell-trigger-support-bash-and-fish/11-11-SUMMARY.md, tests/helpers/shells.ts, tests/bash-widget.test.ts, tests/instant-frame-parity.test.ts
- FOUND commits (`git cat-file -t` = commit): 24d0785, cab3e59, 012bef1, 5d03e1e, 5d5c69f, f6b5837, 69e3e81
- `git rev-list --count a76cda8..69e3e81` = 7
