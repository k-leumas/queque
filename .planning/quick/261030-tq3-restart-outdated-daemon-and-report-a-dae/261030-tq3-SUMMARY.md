---
phase: quick-261030-tq3
plan: 01
subsystem: daemon
status: complete
tags: [daemon, ipc, version-skew, stale-daemon, telemetry, cli]
requires: []
provides:
  - pong `build` field (tsup define __QUEQUE_BUILD_ID__)
  - ensureDaemon replaces a daemon from any other qq build
  - qq daemon --restart
  - qq telemetry show/off no-answer copy (socketConnectable probe)
affects: [src/daemon/bootstrap.ts, src/daemon/server.ts, src/contracts/ipc.ts, src/cli/commands/daemon.ts, src/cli/commands/telemetry.ts]
tech-stack:
  added: []
  patterns:
    - build id baked by tsup define and compared on the existing single ping
    - zod `.optional().catch(undefined)` to filter malformed optional fields instead of rejecting the reply
    - call-time reads of daemon/bootstrap.js bindings in CLI modules
key-files:
  created: []
  modified:
    - tsup.config.ts
    - vitest.config.ts
    - src/env.d.ts
    - src/contracts/ipc.ts
    - src/daemon/server.ts
    - src/daemon/bootstrap.ts
    - src/cli/commands/daemon.ts
    - src/cli/main.ts
    - src/cli/commands/telemetry.ts
    - tests/daemon-bootstrap.test.ts
    - tests/telemetry-ipc.test.ts
    - tests/telemetry-cli.test.ts
    - docs/PROVIDERS.md
    - docs/SYSTEM_DESIGN.md
    - .wolf/anatomy.md
    - .wolf/buglog.json
    - .wolf/cerebrum.md
    - .wolf/memory.md
decisions:
  - "Signal is a per-build id (version + commit + build time, base 36), not the semver or the commit: dev rebuilds keep the version, and Homebrew source builds have no commit"
  - "An absent or other build reads as 'no' (replace); the four capability flags remain a second guard; an unanswered ping still keeps the listener"
  - "Supersedes the 2026-10-08 Phase 9 deferral of build-hash-in-pong: restarting after a rebuild is the point (bug-473)"
  - "`qq daemon --restart` reuses restartDaemon (the `qq init provider` path); no second shutdown implementation"
metrics:
  duration: ~12 min
  completed: 2026-10-31
estimate:
  tokens: 75000
  tasks: 3
actuals:
  tokens: 14250
  tasks: 3
  commits: 3
plan_head_before: c2b098c3f8555b07e148072032232bd60ab59c31
plan_head_after: 332b484984b3854777c77fa20e0e0c020dcdf18b
---

# Quick 261030-tq3 Plan 01: Restart an outdated daemon and report a daemon that does not answer — Summary

The daemon pong now carries a build id that tsup bakes in (`__QUEQUE_BUILD_ID__`, made of version, commit and build time). ensureDaemon replaces any daemon whose build is missing or different, using the existing graceful `shutdown` request with lsof as the fallback. There is a new `qq daemon --restart` command. `qq telemetry show` and `qq telemetry off` now tell "no daemon" apart from "a daemon that did not answer", and in the second case they print a restart hint. This fixes bug-473 in code.

## Tasks

| Task | Name | Commit | Key files |
| ---- | ---- | ------ | --------- |
| 1 (tracer, TDD) | Replace a daemon from another qq build | 3176bbc | tsup.config.ts, vitest.config.ts, src/env.d.ts, src/contracts/ipc.ts, src/daemon/server.ts, src/daemon/bootstrap.ts, tests/daemon-bootstrap.test.ts, tests/telemetry-ipc.test.ts |
| 2 (TDD) | `qq daemon --restart` reuses restartDaemon | 5172dd4 | src/cli/commands/daemon.ts, src/cli/main.ts, tests/daemon-bootstrap.test.ts, docs/PROVIDERS.md, docs/SYSTEM_DESIGN.md |
| 3 (TDD) | telemetry show/off report a daemon that does not answer | 332b484 | src/cli/commands/telemetry.ts, tests/telemetry-cli.test.ts, .wolf/buglog.json (bug-474), .wolf/cerebrum.md |

## TDD evidence

- Task 1 RED: 6 failures before the implementation: the bug-473 replace, pingDaemonFetchCap 'no', the other-build replace, the two pinned pong shapes, and keeping a normal build string. GREEN: 129/129 across daemon-bootstrap, telemetry-ipc, doctor and daemon-fetch.
- Task 2 RED: both `--restart` tests failed (the restart test hit EADDRINUSE because the command fell through to starting the server; the unsafe-path test timed out). GREEN: 121/121 across daemon-bootstrap, client-result and init-provider.
- Task 3 RED: 5 no-answer cases failed, including the 2 real-socket bug-473 regressions. GREEN: 140/140 across telemetry-cli, client-result and doctor.

## Verification

1. Targeted regression set (daemon-bootstrap, telemetry-ipc, telemetry-cli, doctor, client-result, init-provider, daemon-fetch): 7 files, 257/257 passed.
2. `pnpm typecheck` and `pnpm lint` (biome check, 159 files) are clean. `pnpm build` passes and bakes e.g. `0.8.2+332b484.mvvuyrde`.
3. Real-binary E2E, run only on the scratch socket /tmp/qq-tq3-e2e.sock with a throwaway bug-473 fake (four-flag pong, no telemetry, no build, ignores telemetry-show):
   a. `daemon --ensure` exited 0. The log showed `daemon build differs` (daemonBuild null), `replacing stale daemon`, `daemon accepted shutdown` and `daemon ready`, and the fake process was gone.
   b. ping returned a pong with `telemetry: true` and `build: "0.8.2+332b484.mvvuyrde"`.
   c. telemetry-show returned a `telemetry-buffer` reply.
   d. A second `--ensure` logged `already running` with cap `yes` and no new `replacing stale daemon`.
   e. `daemon --restart` printed `daemon restarted` and exited 0. `--restart --socket /tmp/not-qq.sock` printed `unsafe socket path rejected` and exited 1.
   Cleanup: an IPC `shutdown` was sent to the scratch daemon (pid 5392, confirmed gone) and the socket was removed. The user's live /tmp/qq-501.sock daemon was never contacted.
4. There are 3 commits, none with a Co-Authored-By trailer. shell/zsh/queque.zsh and src/client/run-foreground.ts are unchanged, and the working tree is clean.
5. Note: dist/ in this worktree was rebuilt. Once this is merged and the user runs their own build or upgrade, their running daemon (a different build) will be replaced on the next `??` or new shell. That replacement is the fix working live.

## Deviations from Plan

**1. [Rule 3 - Blocking] vitest define added before the RED run**
- **Found during:** Task 1
- **Issue:** Without the `__QUEQUE_BUILD_ID__` define, the RED tests would have failed with a ReferenceError instead of on behaviour.
- **Fix:** Plan step 2 (vitest.config.ts define) was applied before the first RED run. This only changes the order of steps.
- **Commit:** 3176bbc

**2. Extra test cases beyond the behavior list (additive)**
- Task 1: a schema test that a pong without `build` (an old daemon) parses with build undefined. The keep test now also counts pings (exactly 1).
- Task 2: the unsafe-path check was also run against the built binary in the E2E (exit 1).

**3. Plan commit ledger file not written**
- The worktree harness refused the compound command that would have written `gsd-plan-head-before-*`. `plan_head_before` is the known base c2b098c, and `commits: 3` was measured with `git rev-list --count c2b098c..HEAD`.

Otherwise the plan was executed as written.

## Known Stubs

None.

## Threat Flags

None. No new surface beyond the threat model: T-tq3-01 is covered by the `.max(128).optional().catch(undefined)` tests, T-tq3-04 by the unsafe-path tests and the E2E, and T-tq3-05 because the copy is constant and the T-10-33 no-leak test still passes.

## Self-Check: PASSED

- Commits 3176bbc, 5172dd4 and 332b484 are all ancestors of HEAD.
- Every modified file listed above exists and is committed. The buglog diff is append-only (+20/-0) and the file is valid JSON.
