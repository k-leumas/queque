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
  - "Live D-15 drill (run 40974964457): six smoke legs red, auto-revert job green, exactly one PR (#15) into ci/phase-10-revert-drill"
  - "Observed that auto-revert's green base needs a fully successful run (status=success), not smoke-only, so the drill fell back to the merge base with main (489a67a) and the PR reverts 99 files"
  - "Observed that smoke artifact upload fails with EACCES on qq-debug.log on 5 of 6 failing legs, so the PR body has diagnostics for ubuntu:24.04 only"
affects: [phase-10-gaps, ci, zsh-widget, instant-frame, auto-revert, smoke-artifacts]

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
  - "User-approved parallel track: the drill ran from 9401eba while GAP-1 is fixed on main; the verify run is not repeated here"
  - "No code was changed after the drill exposed GAP-3 and GAP-4; both are recorded for the gap plan"

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
    verification:
      - kind: integration
        ref: "https://github.com/k-leumas/queque/actions/runs/40974964457 -> https://github.com/k-leumas/queque/pull/15"
        status: fail
    human_judgment: true
    rationale: "Exactly one PR opened with failing distros, doctor JSON and a PTY log tail, but its base is the merge base with main (489a67a), not 9401eba, so the diff touches 99 files instead of only shell/zsh/queque.zsh (GAP-3); diagnostics exist for ubuntu:24.04 only (GAP-4)"
  - id: D4
    description: "D-03: ci-ok is the only required check on main"
    verification: []
    human_judgment: true
    rationale: "Task 3 human checkpoint, not yet done"

duration: 9min
completed: 2026-10-29
status: checkpoint-pending  # Task 3 human-verify outstanding; reply expected: gaps (GAP-1 open, fix on main; GAP-2 not met; GAP-3, GAP-4 new)
---

# Phase 10 Plan 12: GitHub CI Proof and Revert Drill Summary

**First real run of ci.yml on phase head 9401eba: all six `smoke` legs pass, but `test-distro` fails on fedora:44, debian:13, ubuntu:24.04 and ubuntu:22.04. All four fail on the same test, `zsh-widget.test.ts` z4 (instant-frame header is 75 chars, expected 77). That points at zsh counting multibyte glyphs as bytes under a non-UTF-8 locale. The revert drill then ran as a user-approved parallel track from 9401eba: all six smoke legs failed, the `auto-revert` job passed, and exactly one PR opened (#15). But the script chose the merge base with main (`489a67a`), not `9401eba`, because its green lookup needs a fully successful run. So the PR reverts 99 files instead of two lines, and five of the six legs uploaded no diagnostics (EACCES on `qq-debug.log`). Task 3 is pending with gaps.**

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
| Drill SHA | `0db400431dfaa6f484ca485c729b29f5cdc3598a` (9401eba plus one commit, `test: break the ?? binding for the revert drill`) |
| Drill run URL | https://github.com/k-leumas/queque/actions/runs/40974964457 (conclusion `failure`, 23:42:36Z to 23:44:54Z, about 2 min 20 s) |
| Drill PR URL/number | https://github.com/k-leumas/queque/pull/15 (#15, `revert: smoke failed on ci/phase-10-revert-drill at 0db4004`, base `ci/phase-10-revert-drill`, head `auto-revert/ci-phase-10-revert-drill`, open; 1 PR for that head in any state) |
| Base SHA chosen by auto-revert | `489a67a07afc386e53fad24c62f6ac1d91927b3e`, "the merge base with `main` (no green run was found, so this base is not verified green)". Expected `9401eba`; why it differs is GAP-3 |
| Verify run (for comparison) | the script exited before base selection ("no smoke failure") |
| Remote scratch branches now present | `ci/phase-10-verify` (9401eba), `ci/phase-10-revert-drill` (0db4004), `auto-revert/ci-phase-10-revert-drill` (created by CI) |
| Local drill branch / worktree | local branch `ci/phase-10-revert-drill` kept at 0db4004 for Task 3 cleanup; drill worktree removed |

## Gaps

### GAP-1: `tests/zsh-widget.test.ts > instant frame > z4` fails on the four glibc images

**Status: open. Being fixed on main in parallel by the orchestrator.** The drill run hit the same failure on the same four legs (test-distro fedora:44, debian:13, ubuntu:24.04, ubuntu:22.04 red; alpine:3.24 and archlinux:latest green), which is expected because the drill branch is 9401eba plus a zsh-only change.

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

### GAP-2: the D-15 revert drill: run, mechanism proven, acceptance not met

**Status: not resolved. The drill ran, but two acceptance criteria failed (GAP-3, GAP-4).**

The drill ran on a user-approved parallel track while GAP-1 is fixed on main. The drill worktree came from `9401eba`, the two `bindkey -M emacs|viins '?' qq-question-widget` lines in `shell/zsh/queque.zsh` were rebound to `'~'`, and the commit `0db4004` went through the hooks unchanged (pre-commit typecheck and commitlint passed; pre-push typecheck, lint and affected tests passed in 65 s). It was pushed to `ci/phase-10-revert-drill`. The repo tripwire was clean before and after the push: `core.bare=false`, the drill branch was 9401eba plus exactly one commit, and this worktree's HEAD stayed at 6013430.

What worked (drill run 40974964457):
- `changes` and `checks` passed. `smoke` failed on **all six** legs; the debian:13 leg shows `smoke-distro.exp: timed out waiting for the candidate row tldr z3 (exit 11)`, which is the expected effect of the broken binding.
- `ci-ok` failed, and `auto-revert` passed: `auto-revert: smoke failed on: archlinux:latest, fedora:44, ubuntu:22.04, debian:13, alpine:3.24, ubuntu:24.04`, then `pushed auto-revert/ci-phase-10-revert-drill`, then `opened a pull request`.
- Exactly **one** PR, #15, from `auto-revert/ci-phase-10-revert-drill` into `ci/phase-10-revert-drill`, opened by the workflow token (D-21 works live). Its body lists all six failing `smoke (...)` jobs, the run URL, the chosen base and rule, the D-21 "Approve and run workflows" note, and for ubuntu:24.04 the `doctor.json` (whose `binding` check warns `? is bound to self-insert in the emacs keymap`, so doctor catches the break), plus `pty-default.log`, `qq-debug.log` and `df.txt` tails.
- The PR restores the two bindkey lines (`shell/zsh/queque.zsh` is in the diff) and changes nothing under `.github/workflows` (that rule held).

What failed:
- The **diff is not limited to `shell/zsh/queque.zsh`**. It changes 99 files (+827 / -19246) because the base is `489a67a`, the merge base with `main`, not `9401eba` (GAP-3).
- **Diagnostics are missing for five of the six distros** (`_No smoke artifacts were downloaded for this distro._` for archlinux, fedora, ubuntu:22.04, debian, alpine) (GAP-4).

Do not merge #15: it would wipe 86 commits of phase 10 from the scratch branch. Close it in the Task 3 cleanup.

### GAP-3: auto-revert's "green" base needs a fully successful run, not smoke-only

- **Expected:** base `9401eba`, whose push run 40967340170 had all six smoke legs `success`.
- **Chosen:** `489a67a07afc386e53fad24c62f6ac1d91927b3e` by the last-resort rule "the merge base with `main` (no green run was found, so this base is not verified green)". Origin `main` is at `d3db9b9`, and the merge base with the drill head is 489a67a, so 86 commits were reverted.
- **Why (read from `scripts/ci/auto-revert.sh`; no code changed):** `green_runs()` lists runs with `...runs?<query>&event=push&status=success&per_page=20`. On the GitHub API, `status=success` filters on the run's overall **conclusion**. `smoke_passed` is only checked on runs that are already fully green. Run 40967340170 concluded `failure` (GAP-1 test-distro legs), so it is never returned. The lookup then falls through every rule: (1) the drill branch has no runs of its own; (2) none of the 30 first-parent ancestors of `0db4004^` has a fully green push run; (3) the before SHA is all zeros on a new branch; (4) the merge base with `origin/main` matches.
- **So the orchestrator's assumption that "auto-revert's green definition is smoke-only" does not match the code.** It needs the whole run green *and* smoke passed. The 10-07 SUMMARY describes the green definition as "a successful push run whose smoke jobs passed", which is consistent with the code.
- **Two options for the gap plan:** (a) keep the current definition and re-run the drill from a commit that has a fully green verify run (once GAP-1 lands, the ancestor rule should find it); or (b) if the intended design is smoke-only, change `green_runs` to list `status=completed` runs and rely on `smoke_passed`. Then add a fixture test where a run's conclusion is `failure` but smoke passed. Option (b) is a behaviour change to D-15 and needs a decision.

### GAP-4: smoke artifact upload fails with EACCES on failing legs

- **Symptom:** the drill run has one artifact, `smoke-ubuntu-24.04` (2408 bytes). The verify run 40967340170, where every smoke passed, has all six (6000-6228 bytes).
- **Failure (debian:13 leg, job 123800682603, step `Upload smoke artifacts`):** `With the provided path, there will be 7 files uploaded`, then `##[error]An error has occurred while creating the zip file for upload` / `Error: EACCES: permission denied, open '/home/runner/work/_temp/smoke-out/qq-debug.log'`.
- **Hypothesis (not verified):** on the failure path the runner leaves `qq-debug.log` in the mounted out dir owned by the container user or with a mode the runner user cannot read. The success path, and ubuntu:24.04's failure path, end up readable. The fix belongs in `scripts/smoke-distro.sh` or `smoke-distro-runner.sh`: normalise ownership and mode of the out dir on every exit path, for example with a trap. This is exactly the path D-15 diagnostics depend on.

### Side observation (not a gap)

The pre-push "test affected from base" step passed with both `??` bindings broken. The local hook does not catch a rebinding of `?`; the CI smoke does.

## Task Commits

1. **Task 1: Allow GitHub Actions to create pull requests (D-21)**: human action, no commit
2. **Task 2: Green six-distro run, then revert drill**: recorded as gaps; memory lines and this SUMMARY are in one `docs(10-12)` commit (hash is in the executor's return message)
   - Drill (parallel track): `0db4004` `test: break the ?? binding for the revert drill`, on the scratch branch `ci/phase-10-revert-drill` only (not on the phase branch). The record of it is in a second `docs(10-12): record the revert drill` commit
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

### Drill continuation (user-approved parallel track)

**3. [User-approved deviation] Drill run against a verify run that is not fully green.** The user approved running Task 2 steps 2-3 from 9401eba while the orchestrator fixes GAP-1 on main. The verify run was not repeated. The premise was that auto-revert treats a smoke-only pass as green. The drill showed that premise is wrong (GAP-3), and that is why the base came out as 489a67a. No code was changed; the drill commit went through all hooks with no fixes needed.

---

**Total deviations:** 1 pre-existing bug fixed by the orchestrator, 1 planned skip, and 1 user-approved parallel drill.
**Impact on plan:** the plan halts at Task 3 with gaps; no scope creep.

## Issues Encountered

- `gh run watch --exit-status` exited 1 because of the failed legs (expected handling).
- The `auto-revert` job runs whenever `distro` fails, including test-distro-only failures, but the script no-ops correctly. Nothing to fix; noted for whoever reads the next drill.

## User Setup Required

None beyond the Task 3 checkpoint.

## Next Phase Readiness

- Blocked on GAP-1 (fix in progress on main), GAP-3 (decision: keep the fully-green definition and re-drill after a green verify, or switch to smoke-only) and GAP-4 (artifact permissions on the failure path). After those, re-run the verify push, then repeat the drill from the new green head and check that the PR diff is only `shell/zsh/queque.zsh`.
- Task 3 cleanup now covers: close PR #15 with `--delete-branch` (removes `auto-revert/ci-phase-10-revert-drill`), delete the remote branches `ci/phase-10-revert-drill` and `ci/phase-10-verify`, and run `git branch -D ci/phase-10-revert-drill` locally. A re-drill can recreate them.
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

### Drill addendum (parallel track, 2026-10-29T23:42Z)

- Drill tripwire before and after the push: `core.bare=false` (read from the shared config through this worktree, since `git -C` on the main checkout is blocked by agent isolation). `rev-list --count 9401eba..ci/phase-10-revert-drill` = 1, and the remote ref equals `0db4004`.
- Plan verify 2 (`gh pr list ... --head auto-revert/ci-phase-10-revert-drill --state open ... length`): `1`. PASS on count.
- Acceptance "drill run shows failed smoke legs and a successful `auto-revert` job": PASS (6/6 smoke failed, auto-revert success).
- Acceptance "`gh pr diff` lists only `shell/zsh/queque.zsh`": **FAIL**, 99 files (GAP-3).
- Acceptance "SUMMARY records ... PR URL and the base SHA the script chose": PASS (`489a67a`).
- Drill worktree removed; local branch `ci/phase-10-revert-drill` present at `0db4004`.
