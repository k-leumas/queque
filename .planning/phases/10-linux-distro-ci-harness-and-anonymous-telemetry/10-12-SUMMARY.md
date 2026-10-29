---
phase: 10-linux-distro-ci-harness-and-anonymous-telemetry
plan: 12
subsystem: infra
tags: [github-actions, ci, docker, distro-matrix, auto-revert, zsh, locale]

requires:
  - phase: 10-linux-distro-ci-harness-and-anonymous-telemetry
    provides: "ci.yml / distro.yml six-image matrix (plan 05), auto-revert job (plan 07), consent smoke pass (plan 11)"
provides:
  - "First real GitHub run of ci.yml on the phase head: six smoke legs green, four test-distro legs red on one zsh-widget test"
  - "D-21 repo setting confirmed (Actions may create PRs; default token read)"
  - "Observed proof that auto-revert ignores test-distro-only failures (no PR opened)"
affects: [phase-10-gaps, ci, zsh-widget, instant-frame]

actuals:
  tokens: 9000
  tasks: 1
  commits: 0  # measured at SUMMARY write (docs-only plan; the docs commit itself is excluded)
plan_head_before: 9401eba1e3bdb88bbe1778f72336b4f040f5785a
plan_head_after: 9401eba1e3bdb88bbe1778f72336b4f040f5785a

tech-stack:
  added: []
  patterns:
    - "CI gap protocol: on a red leg, record job, image and log tail; never patch code inside the verify plan"

key-files:
  created:
    - .planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-12-SUMMARY.md
  modified:
    - .wolf/memory.md

key-decisions:
  - "Verify run red on test-distro, so the revert drill was skipped per plan; the fix goes through /gsd-plan-phase 10 --gaps"
  - "No code was patched in this plan even though the failure is a single, well-localised test"

patterns-established:
  - "Run the full ci.yml on a ci/* scratch branch before relying on its gates"

requirements-completed: []

coverage:
  - id: D1
    description: "D-21: Actions may create PRs while the default workflow token stays read"
    requirement: P10-REVERT
    verification:
      - kind: other
        ref: "gh api repos/k-leumas/queque/actions/permissions/workflow -> {default_workflow_permissions: read, can_approve_pull_request_reviews: true}"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-14: phase head green on all six distros (checks, 6 test-distro, 6 smoke, ci-ok)"
    requirement: P10-CI
    verification:
      - kind: integration
        ref: "https://github.com/k-leumas/queque/actions/runs/40967340170"
        status: fail
    human_judgment: true
    rationale: "Run failed on 4 of 6 test-distro legs; needs a gap plan and a re-run"
  - id: D3
    description: "D-15: smoke-breaking push opens exactly one auto-revert PR"
    requirement: P10-REVERT
    verification: []
    human_judgment: true
    rationale: "Drill not run: the plan skips it when the verify run is red"
  - id: D4
    description: "D-03: ci-ok is the only required check on main"
    verification: []
    human_judgment: true
    rationale: "Task 3 human checkpoint, not yet done"

duration: 9min
completed: 2026-10-29
status: checkpoint-pending  # Task 3 human-verify outstanding; reply expected: gaps
---

# Phase 10 Plan 12: GitHub CI Proof and Revert Drill Summary

**First real run of ci.yml on phase head 9401eba: all six `smoke` legs pass, but `test-distro` fails on fedora:44, debian:13, ubuntu:24.04 and ubuntu:22.04. All four fail on the same test, `zsh-widget.test.ts` z4 (instant-frame header is 75 chars, expected 77). That points at zsh counting multibyte glyphs as bytes under a non-UTF-8 locale. The revert drill was skipped per plan, so Task 3 is pending with gaps.**

**Status: checkpoint pending (Task 3, human-verify). The reply expected here is "gaps".**

## Performance

- **Duration:** about 9 min for this continuation (Task 2). The CI run itself took about 4 min; test-distro legs failed after 50-63 s.
- **Started:** 2026-10-29T22:36:39Z (continuation; Task 1 was finished in an earlier session)
- **Completed:** 2026-10-29T22:45Z (checkpoint reached)
- **Tasks:** 2 of 3 (Task 1 human-action done; Task 2 ran and recorded gaps; Task 3 pending)
- **Files modified:** 2 (`.wolf/memory.md`, this SUMMARY)

## Accomplishments

- D-21 confirmed: `{"default_workflow_permissions":"read","can_approve_pull_request_reviews":true}`.
- Pushed phase head `9401eba1e3bdb88bbe1778f72336b4f040f5785a` to `ci/phase-10-verify`. The pre-push hook passed (typecheck, lint, affected tests; 47 s), the repo stayed intact (`core.bare=false`) and HEAD did not move.
- Verify run: https://github.com/k-leumas/queque/actions/runs/40967340170 (conclusion `failure`)
  - `changes` success, `checks` success
  - `smoke`: **6/6 success** (alpine:3.24, debian:13, ubuntu:24.04, ubuntu:22.04, fedora:44, archlinux:latest). This is the first real install-distro-deps.sh run on fedora, arch and both ubuntus, and all of them installed and passed the zsh round trip plus doctor.
  - `test-distro`: **2/6 success** (alpine:3.24, archlinux:latest); failure on fedora:44, debian:13, ubuntu:24.04, ubuntu:22.04
  - `ci-ok` failure (`results: success success failure`), as designed
  - `auto-revert` success, no-op: `auto-revert: no smoke failure in this run; nothing to revert`. No `auto-revert/ci-phase-10-verify` branch or PR was created. This is real evidence that the script filters on smoke failures and not on the aggregate `distro` result.

## Run / PR / base record

| Item | Value |
|---|---|
| Verify run URL | https://github.com/k-leumas/queque/actions/runs/40967340170 |
| Verify SHA | 9401eba1e3bdb88bbe1778f72336b4f040f5785a |
| Drill run URL | not run (skipped: verify red) |
| Drill PR URL/number | none |
| Base SHA chosen by auto-revert | n/a. No drill ran. In the verify run the script exited before base selection ("no smoke failure") |
| Remote scratch branches now present | `ci/phase-10-verify` only |
| Local drill branch / worktree | not created |

## Gaps

### GAP-1: `tests/zsh-widget.test.ts > instant frame > z4` fails on the four glibc images

- **Jobs:** `distro / test-distro (fedora:44)` (job 123775167461), `distro / test-distro (debian:13)` (123775167596), `distro / test-distro (ubuntu:24.04)` (123775167633), `distro / test-distro (ubuntu:22.04)` (123775167662)
- **Images:** fedora:44, debian:13, ubuntu:24.04, ubuntu:22.04. alpine:3.24 and archlinux:latest pass.
- **Failure (the same on all four):** `AssertionError: expected [ ' ', 'q', 'u', 'e', 'q', 'u', …(69) ] to have a length of 77 but got 75` at `tests/zsh-widget.test.ts:1023:31` (`expect([...header('78')]).toHaveLength(1 + 76)`). Totals: 1 failed, 1456 passed, 2 skipped (1459).
- **Hypothesis (not verified, no code changed):** the instant-frame truncation in `shell/zsh/queque.zsh` (around line 120, `text="${text[1,width-1]}…"`) uses zsh string length and slicing. Neither `scripts/ci/test-in-distro.sh` nor `install-distro-deps.sh` sets `LANG`/`LC_ALL`, so the glibc containers run zsh in the C/POSIX locale with MULTIBYTE effectively byte-wise. The 3-byte glyphs (`›` in the `queque › ` prefix and/or `…`) are then counted as 3 columns each, giving exactly 2 fewer visible characters (77 to 75). Alpine (musl, always UTF-8) and the Arch image pass. The fix belongs in a gap plan, which has two options: (a) make the frame width math locale-independent (or force a UTF-8 `LC_CTYPE` inside the widget), which matters for real users on C-locale hosts too; or (b) set a UTF-8 locale in `test-in-distro.sh`. Option (a) is the product fix; option (b) would hide a real user-facing truncation bug.
- **Last 100 lines of `gh run view 40967340170 --log-failed` for `test-distro (fedora:44)`** (ANSI codes and timestamps removed). The other three legs have the same `Failed Tests` block apart from blank-line placement and durations (debian 27.04 s, ubuntu:24.04 26.40 s, ubuntu:22.04 33.74 s), and the same post-job checkout cleanup apart from temp-file UUIDs.

```text
       ✓ a real spawn with the missing HOME does not emit an unhandled error  2032ms
       ✓ a real spawn error event becomes a normal startup timeout, not a crash  2031ms
     ✓ requestDaemonShutdown is false for a daemon that ignores the request  510ms
     ✓ restartDaemon unlinks a daemon that ignores shutdown and spawns once  588ms
     ✓ restartDaemon rejects when the new daemon never listens  2106ms
 ✓ tests/claude-stream-json.test.ts (10 tests) 10ms
 ✓ tests/registry.test.ts (16 tests) 8ms
 ✓ tests/context-pipeline.test.ts (6 tests) 372ms
 ✓ tests/tool-handoff.test.ts (8 tests) 15ms
 ✓ tests/prewarm-sleep.test.ts (3 tests) 4408ms
     ✓ takes a child that was stopped and continued (sleep then wake) and refills the slot  540ms
     ✓ detects a child still frozen past its boot allowance, kills it and runs cold  3283ms
     ✓ misses with dead when the idle child was killed out from under the daemon  583ms
 ✓ tests/env-file.test.ts (9 tests) 9ms
 ✓ tests/candidate-stream.test.ts (13 tests) 44ms
 ✓ tests/lsof-busybox.test.ts (7 tests) 355ms
 ✓ tests/code-changed.test.ts (8 tests) 1290ms
 ✓ tests/environment-shape.test.ts (17 tests) 12ms
 ✓ tests/provider-resolver.test.ts (7 tests) 9ms
 ✓ tests/registry-bootstrap.test.ts (9 tests) 11ms
 ✓ tests/shell-contract.test.ts (7 tests) 8ms
 ✓ tests/telemetry-endpoint.test.ts (9 tests) 4ms
 ✓ tests/main-direct-run.test.ts (5 tests) 9ms
 ✓ tests/debug-log.test.ts (2 tests) 92ms
 ✓ tests/porcelain-parser.test.ts (9 tests) 6ms
 ✓ tests/claude-exec.test.ts (2 tests) 181ms
 ✓ tests/init-command.test.ts (5 tests) 5ms
 ✓ tests/controls-line.test.tsx (1 test) 17ms
 ✓ tests/git-env-isolation.test.ts (1 test) 5775ms
     ✓ never touch the repository GIT_DIR points at  5747ms
stdout | tests/command-words-fuzz.test.ts > command-words fuzz (child process, hard timeouts) > deep nesting stays fast (2,000 nested substitutions under 100 ms)
deep 2000 ms per run: 3.1

 ✓ tests/command-words-fuzz.test.ts (36 tests) 8034ms
     ✓ 20k random inputs finish without hang or throw  519ms
     ✓ 5k random inputs, second seed, finish without hang or throw  400ms
     ✓ crafted malformed input ">" finishes within 1 s  307ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/zsh-widget.test.ts > instant frame > z4: a long lbuffer is truncated to the modal content width with a trailing …
AssertionError: expected [ ' ', 'q', 'u', 'e', 'q', 'u', …(69) ] to have a length of 77 but got 75

- Expected
+ Received

- 77
+ 75

 ❯ tests/zsh-widget.test.ts:1023:31
    1021|     const long = 'a'.repeat(200);
    1022|     const header = (columns: string): string => frameRows(instantFrame…
    1023|     expect([...header('78')]).toHaveLength(1 + 76);
       |                               ^
    1024|     expect(header('78').endsWith('…')).toBe(true);
    1025|     expect([...header('40')]).toHaveLength(1 + 38);

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed | 58 passed (59)
      Tests  1 failed | 1456 passed | 2 skipped (1459)
   Start at  22:38:47
   Duration  29.23s (transform 2.89s, setup 487ms, collect 6.96s, tests 63.20s, environment 9ms, prepare 321ms)

[ELIFECYCLE] Command failed with exit code 1.
##[error]Process completed with exit code 1.
Post job cleanup.
[command]/usr/bin/git version
git version 2.56.0
Temporarily overriding HOME='/home/runner/work/_temp/81ea9e0b-1a9d-42dc-a403-ff7195c588bd' before making global git config changes
Adding repository directory to the temporary git global config as a safe directory
[command]/usr/bin/git config --global --add safe.directory /home/runner/work/queque/queque
Removing SSH command configuration
[command]/usr/bin/git config --local --name-only --get-regexp core\.sshCommand
[command]/usr/bin/git submodule foreach --recursive sh -c "git config --local --name-only --get-regexp 'core\.sshCommand' && git config --local --unset-all 'core.sshCommand' || :"
Removing HTTP extra header
[command]/usr/bin/git config --local --name-only --get-regexp http\.https\:\/\/github\.com\/\.extraheader
[command]/usr/bin/git submodule foreach --recursive sh -c "git config --local --name-only --get-regexp 'http\.https\:\/\/github\.com\/\.extraheader' && git config --local --unset-all 'http.https://github.com/.extraheader' || :"
Removing includeIf entries pointing to credentials config files
[command]/usr/bin/git config --local --name-only --get-regexp ^includeIf\.gitdir:
includeif.gitdir:/home/runner/work/queque/queque/.git.path
includeif.gitdir:/home/runner/work/queque/queque/.git/worktrees/*.path
includeif.gitdir:/github/workspace/.git.path
includeif.gitdir:/github/workspace/.git/worktrees/*.path
[command]/usr/bin/git config --local --get-all includeif.gitdir:/home/runner/work/queque/queque/.git.path
/home/runner/work/_temp/git-credentials-6808ddf6-0581-4339-9247-68ea472a2506.config
[command]/usr/bin/git config --local --unset includeif.gitdir:/home/runner/work/queque/queque/.git.path /home/runner/work/_temp/git-credentials-6808ddf6-0581-4339-9247-68ea472a2506.config
[command]/usr/bin/git config --local --get-all includeif.gitdir:/home/runner/work/queque/queque/.git/worktrees/*.path
/home/runner/work/_temp/git-credentials-6808ddf6-0581-4339-9247-68ea472a2506.config
[command]/usr/bin/git config --local --unset includeif.gitdir:/home/runner/work/queque/queque/.git/worktrees/*.path /home/runner/work/_temp/git-credentials-6808ddf6-0581-4339-9247-68ea472a2506.config
[command]/usr/bin/git config --local --get-all includeif.gitdir:/github/workspace/.git.path
/github/runner_temp/git-credentials-6808ddf6-0581-4339-9247-68ea472a2506.config
[command]/usr/bin/git config --local --unset includeif.gitdir:/github/workspace/.git.path /github/runner_temp/git-credentials-6808ddf6-0581-4339-9247-68ea472a2506.config
[command]/usr/bin/git config --local --get-all includeif.gitdir:/github/workspace/.git/worktrees/*.path
/github/runner_temp/git-credentials-6808ddf6-0581-4339-9247-68ea472a2506.config
[command]/usr/bin/git config --local --unset includeif.gitdir:/github/workspace/.git/worktrees/*.path /github/runner_temp/git-credentials-6808ddf6-0581-4339-9247-68ea472a2506.config
[command]/usr/bin/git submodule foreach --recursive git config --local --show-origin --name-only --get-regexp remote.origin.url
Removing credentials config '/home/runner/work/_temp/git-credentials-6808ddf6-0581-4339-9247-68ea472a2506.config'
Cleaning up orphan processes
```

`ci-ok` failed only because it aggregates the results: `RESULTS: success success failure` (changes, checks, distro).

### GAP-2: the D-15 revert drill is still unproven

This follows from GAP-1. The plan skips the drill when the verify run is red. Once GAP-1 is fixed, a later run has to repeat Task 2 (a green verify run first, then the `ci/phase-10-revert-drill` push).

## Task Commits

1. **Task 1: Allow GitHub Actions to create pull requests (D-21)**: human action, no commit
2. **Task 2: Green six-distro run, then revert drill**: recorded as gaps; memory lines and this SUMMARY are in one `docs(10-12)` commit (hash is in the executor's return message)
3. **Task 3: Review drill PR, make `ci-ok` required**: pending (checkpoint)

## Files Created/Modified

- `.wolf/memory.md`: two session lines (push and run link; failed legs and gap)
- `.planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-12-SUMMARY.md`: this file

## Decisions Made

- Followed the plan's gap protocol: no code patched, drill skipped, Task 3 reported with gaps.

## Deviations from Plan

### Pre-push defect found and fixed before this attempt (orchestrator, earlier session)

**1. [Rule 1 - Bug] Pre-push tests inherited `GIT_DIR` and damaged the shared repo**
- **Found during:** Task 2, first attempt (previous executor)
- **Issue:** the lefthook pre-push hook runs inside a linked worktree with `GIT_DIR` and related vars exported. `tests/auto-revert.test.ts` and `tests/code-changed.test.ts` spawned fixture `git` commands that inherited those vars, so they ran against the real repository and set `core.bare=true`. The push was rejected and nothing reached GitHub.
- **Fix:** the orchestrator repaired the repo (`core.bare=false`, damaged worktree removed), added a regression test (`8a1fb17`, `tests/git-env-isolation.test.ts`) and a vitest `setupFiles` scrub of hook-exported `GIT_*` vars (`801e6da`, `tests/setup/scrub-git-env.ts`), and logged bug-461 (`9401eba`).
- **Verification:** this attempt's push from a linked worktree passed the pre-push hook (47 s). Afterwards `core.bare` was still `false` and HEAD was still `9401eba`. `tests/git-env-isolation.test.ts` also passed in all six CI containers.

### This attempt

**2. [Plan gap protocol] Drill skipped**: the verify run was red on test-distro (GAP-1). Per the objective, Task 2 step 2 (drill worktree, breaking commit, `ci/phase-10-revert-drill` push) was not run.

---

**Total deviations:** 1 pre-existing bug fixed by the orchestrator, plus 1 planned skip.
**Impact on plan:** the plan halts at Task 3 with gaps; no scope creep.

## Issues Encountered

- `gh run watch --exit-status` exited 1 because of the failed legs (expected handling).
- The `auto-revert` job runs whenever `distro` fails, including test-distro-only failures, but the script no-ops correctly. Nothing to fix; noted for whoever reads the next drill.

## User Setup Required

None beyond the Task 3 checkpoint.

## Next Phase Readiness

- Blocked on GAP-1. Next step is `/gsd-plan-phase 10 --gaps`, then re-run plan 12 Task 2. Leave `ci/phase-10-verify` in place or delete it during Task 3 cleanup; a re-run pushes the new head to it anyway.
- Positive signal: install-distro-deps.sh and the full PTY smoke (default, c-locale, consent passes plus doctor) work on all six images.

---
*Phase: 10-linux-distro-ci-harness-and-anonymous-telemetry*
*Checkpoint reached: 2026-10-29*

## Self-Check: PASSED (as a checkpoint-pending record)

- FOUND: this SUMMARY; `.wolf/memory.md` lines appended
- Plan verify 1 (`gh run list ... ci/phase-10-verify ... conclusion`): `failure`, expected FAIL, recorded as GAP-1
- Plan verify 2 (`gh pr list ... auto-revert/ci-phase-10-revert-drill ... length`): `0`, expected FAIL, drill skipped (GAP-2)
- Remote heads: only `ci/phase-10-verify` at 9401eba; no drill branch
- Repo tripwire after push: `core.bare=false`, HEAD unchanged at 9401eba
