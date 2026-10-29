---
phase: 10-linux-distro-ci-harness-and-anonymous-telemetry
plan: 09
subsystem: cli
tags: [telemetry, doctor, cli, cac, ipc, privacy]
status: complete

requires:
  - phase: 10-03
    provides: qq doctor (DOCTOR_CHECK_IDS, DoctorDeps, runDoctorChecks)
  - phase: 10-04
    provides: telemetry consent state (setTelemetryEnabled, readTelemetryState, telemetryBlockedBy) and resolveTelemetryEndpoint
  - phase: 10-06
    provides: daemon IPC kinds telemetry-show / telemetry-reset and the telemetry-buffer reply
provides:
  - "src/cli/commands/telemetry.ts: telemetryCommand(action, deps?), TelemetryCliDeps, defaultTelemetryCliDeps, requestDaemonOnce(socketPath, request, timeoutMs?), DAEMON_REQUEST_TIMEOUT_MS = 500"
  - "CLI: qq telemetry [status|on|off|show] (no action = status)"
  - "DOCTOR_CHECK_IDS gains 'telemetry' (appended, 12 ids); DoctorDeps.telemetryStatus(); exported TelemetryStatus type"
affects: [10-11 consent prompt, 10-13 real key, 10-05 distro smoke doctor step (now 12 checks)]

estimate:
  tokens: 60000
  tasks: 2
actuals:
  tokens: 7300
  tasks: 2
  commits: 4
plan_head_before: 4b290325567099b8edf04dc62c8c277b8abfaff3
plan_head_after: 06b1a2b01a2370e7a71e3042613a79b28e1ebd4d

tech-stack:
  added: []
  patterns:
    - "Injectable TelemetryCliDeps (env, configPath, socketPath, endpoint, requestDaemon, out, err), the same shape as DoctorDeps"
    - "One-shot daemon request: one JSON line, first reply line validated with ipcResponseSchema, null on error, close or timeout"

key-files:
  created:
    - src/cli/commands/telemetry.ts
    - tests/telemetry-cli.test.ts
  modified:
    - src/cli/main.ts
    - src/contracts/doctor.ts
    - src/cli/commands/doctor.ts
    - tests/doctor.test.ts

key-decisions:
  - "status shows the effective state, the reason (a blocking variable by name, or 'not turned on'), the stored config value, asked, project key presence and the endpoint host (URL host only, never scheme, path, key or credentials)"
  - "Without a project key, status still prints the configured host (QQ_TELEMETRY_HOST override or the baked EU host), so the user sees where data would go"
  - "off writes the config first; when that write is refused (invalid JSON), the daemon is not contacted, because an unreadable config already reads as off at the daemon's flush-time gate"
  - "show distinguishes no reply (daemon not running: nothing buffered) from a reply that is not telemetry-buffer (an outdated daemon); both exit 0"
  - "Doctor telemetry row: enabled without an install id reads as off; an unreadable state is still ok ('treated as off'); a declined user gets plain 'telemetry off'"

requirements-completed: [P10-TEL, P10-DOCTOR]

duration: 12min
completed: 2026-10-29
---

# Phase 10 Plan 09: qq telemetry and the doctor telemetry row Summary

**`qq telemetry status|on|off|show` on top of the plan 04 consent state and the plan 06 daemon IPC. `show` prints the daemon's pending and last sent bodies byte for byte, `off` deletes the install id and then clears the daemon buffer, and a broken config is never overwritten. `qq doctor` gains a twelfth, always-✓ `telemetry` row that names blocking variables only.**

## Performance

- **Duration:** about 12 min
- **Started:** 2026-10-29T20:51Z
- **Completed:** 2026-10-29T21:04Z
- **Tasks:** 2 (both TDD, RED then GREEN)
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments

- `qq telemetry status` (also the no-action default) prints:
  - `telemetry: on|off`
  - `reason: DO_NOT_TRACK is set (it overrides the config)`, or `reason: not turned on (...)`
  - `config: on|off`
  - `asked: yes|no`
  - `project key: absent in this build (nothing is sent)` or `present`
  - `endpoint: <host>`
- `on` stores enabled, asked and a fresh UUID install id. It adds a note naming a blocking variable when one is set, and a note when the build has no key. `off` deletes the id, then sends exactly one `telemetry-reset`; a missing daemon is fine.
- `show` sends `telemetry-show` and writes `pending:\n<body|(none)>\nlast sent:\n<body|(none)>\n`, with nothing else added. With no daemon it prints `daemon not running: nothing buffered`.
- An unknown action prints `qq telemetry: unknown telemetry action` and the usage line on stderr, with exit code 1. A `TelemetryConfigWriteError` goes to stderr with exit code 1, and the file bytes stay unchanged.
- `requestDaemonOnce` mirrors `requestDaemonShutdown`: 500 ms timeout, the reply is schema-validated, and it resolves null on any error. It is tested against real `/tmp/qq-tel-cli-PID-RAND.sock` servers.
- Doctor: `'telemetry'` is appended to `DOCTOR_CHECK_IDS`. `DoctorDeps.telemetryStatus()` defaults to `telemetryBlockedBy(env)`, `readTelemetryState()` and `resolveTelemetryEndpoint(env) !== null`. `checkTelemetry` runs last and is always `ok`.

This machine's built CLI prints `telemetry: off`, `reason: not turned on`, `asked: no`, `project key: absent in this build (nothing is sent)` and `endpoint: eu.i.posthog.com`. `qq doctor --json` has 12 checks, `ok: true`, and the telemetry row `telemetry off (not asked yet)`. `qq telemetry show` printed `daemon not running: nothing buffered`.

## Task Commits

1. **Task 1: `qq telemetry status|on|off|show`.** RED `02c4622` (test), GREEN `320cc8d` (feat)
2. **Task 2: doctor telemetry row.** RED `99f22c5` (test), GREEN `06b1a2b` (feat)

No REFACTOR commits were needed.

## TDD Gate Compliance

Each RED commit has the tests plus only the public names, so `tsc --noEmit` passes in pre-commit (cerebrum 2026-08-26). For Task 1 that is a stub module whose `telemetryCommand` prints nothing. For Task 2 it is the appended id and the `DoctorDeps.telemetryStatus` field with its real default, but no check is emitted yet. Each RED record was checked with `gsd-tools check tdd-red-evidence` (vitest `tap-flat`, one target via `-t`) and returned `RED_EVIDENCE_OK` (`target_test_failed`):

- Task 1: the target was `tests/telemetry-cli.test.ts > qq telemetry status > reports off, not asked, no project key and the endpoint host on a fresh config`. It failed with `expected [ '' ] to include 'telemetry: off'`. Semantic assessment: the target ran and failed on its planned assertion because the stub prints nothing. It was not a load, syntax or fixture fault. 4 of 23 tests passed against the stub, as expected: the three null-returning `requestDaemonOnce` cases and the canary test (empty output leaks nothing).
- Task 2: the target was `tests/doctor.test.ts > runDoctorChecks: telemetry (D-18, never a blocker) > says off, not asked yet, for a fresh install`. It failed with `expected undefined to be 'ok'` because no telemetry row was emitted. Semantic assessment: the planned assertion.

GREEN: each task's verify command exits 0.

## Verification

- `pnpm exec vitest run tests/telemetry-cli.test.ts`: 23 passed
- `pnpm exec vitest run tests/doctor.test.ts tests/telemetry-cli.test.ts`: 78 passed
- `pnpm build && QQ_CONFIG_FILE=<scratch>/plan-10-09-tel-cli-check.json node dist/cli/main.js telemetry status`: exit 0, `telemetry: off`. status is read-only, so no temp file was created and there was nothing to remove.
- `pnpm build && node dist/cli/main.js doctor --json | node -e '<telemetry ok, 12 checks, ok true>'`: exit 0
- Plan-level: `pnpm test:run` 54 files, 1362 tests passed. `pnpm typecheck`, `pnpm lint` (145 files) and `pnpm build` all exit 0.
- Acceptance greps:
  - Task 1: `command('telemetry \[action\]'` in main.ts 1; `telemetry-reset` 2; `telemetry-show` 2; `daemon not running: nothing buffered` 1. `--help` lists `telemetry [action]`.
  - Task 2: `'telemetry'` in contracts/doctor.ts 1; `telemetryStatus` in doctor.ts 3.
  - The single-line id-order grep cannot match as written, because biome keeps one id per line. The plan allows adjusting it to the formatter. Collapsed, the array reads `'zsh','jq','tmp','socket','daemon','integration','binding','term','locale','provider','node','telemetry'`, so the earlier ids keep their order.
- `~/.config/qq/config.json` does not exist on this machine after the run, so no test or verify command wrote the real config. No command reached the network: the vitest key is empty and the CLI runs only did status, show and doctor.

## Decisions Made

See `key-decisions` in the frontmatter. Each one fills a gap the plan left open (what status prints beyond the required lines, how off and show handle edge replies). None changes an interface in the artifact table.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Environment] A parallel agent overwrote a shared scratchpad commit-message file**
- **Found during:** Task 1 RED commit
- **Issue:** the session scratchpad is shared with the 10-07/08/10 worktree agents. Between my Write and `git commit -F`, plan 10-08 overwrote `msg1.txt`, so the RED commit first landed with 10-08's message.
- **Fix:** amended my own unpushed commit with a uniquely named message file (`plan-10-09-msg-*.txt`) and used unique names for every later scratch file. Final history: four `(10-09)` commits, checked with `git log`.
- **Files modified:** none in the repo
- **Commit:** `02c4622` (the amended RED commit)

**2. [Rule 3 - Environment] Plan ledger file**
- **Issue:** the worktree harness refuses Bash writes under `.git/worktrees/<id>/` (cerebrum 2026-10-12), so the #3968 ledger was not written.
- **Fix:** `plan_head_before` is the spawn base `4b29032`, checked at startup. `commits` is measured with `git rev-list --count 4b29032..HEAD` = 4.

**Total deviations:** 2 environment fixes, no code deviations. **Impact:** none on scope or interfaces. Every changed file is in `files_modified`.

## Issues Encountered

None in the code.

## Threat Flags

None. The only new surface is the CLI → daemon socket request (T-10-35, accepted: replies are schema-validated and printed locally) and the CLI → config.json write (T-10-34, mitigated by the plan 04 writer and tested here). Mitigations T-10-32, T-10-33 and T-10-34 are implemented and tested: the config write comes before the daemon reset, the canary tests cover the install id and env values in both the CLI and doctor, and the invalid-JSON refusal keeps the file bytes.

## OpenWolf entries

Plan 11 applies these; this plan committed no `.wolf/` file.

**anatomy.md**
- `src/cli/commands/telemetry.ts`: `qq telemetry [status|on|off|show]` (D-06, D-09, D-12, D-22).
  - Exports: TelemetryCliDeps (injectable), defaultTelemetryCliDeps, requestDaemonOnce(socketPath, request, timeoutMs=500) (one-shot, schema-validated, null on error/close/timeout), telemetryCommand(action, deps).
  - Output is state plus variable names and the endpoint host only; show prints the daemon bodies byte for byte. (~2k tok)
- `tests/telemetry-cli.test.ts`: status/on/off/show with a temp config and an injected daemon; invalid-JSON refusal keeps the bytes; unknown action; canary no-leak; requestDaemonOnce against real `/tmp/qq-tel-cli-*.sock` servers. (~3k tok)
- Update the descriptions of:
  - `src/contracts/doctor.ts`: 12 check ids, `telemetry` last.
  - `src/cli/commands/doctor.ts`: `DoctorDeps.telemetryStatus`, exported `TelemetryStatus`, `checkTelemetry` (always ok).
  - `tests/doctor.test.ts`: telemetry row cases and the install-id canary.
  - `src/cli/main.ts`: registers `qq telemetry [action]` after doctor.

**cerebrum.md**
- Do-Not-Repeat [2026-10-29]: the session scratchpad is shared by every parallel worktree agent in a wave. A generic name like `msg1.txt` for a `git commit -F` message file can be overwritten by another agent between Write and commit (10-09's RED commit first got 10-08's message). Prefix scratch files with the plan id (`plan-10-09-msg-red1.txt`) and check `git log` after committing.
- Key Learnings: `qq telemetry status` and the doctor row both treat "enabled without an install id" as off, the same rule as `effectiveTelemetry`. Never print the install id, the key, or a gate variable's value; name the variable only.
- Key Learnings: `qq doctor` now has 12 checks, with `telemetry` last. Anything asserting the count (plan 05's smoke doctor step, the healthy-run test) must use `DOCTOR_CHECK_IDS.length`, not a literal 11.

**buglog.json**
- No code bug. The scratchpad commit-message race can be logged if wanted: error "RED commit landed with test(10-08) subject"; root cause a shared session scratchpad; fix: amend the agent's own commit and use plan-prefixed scratch names. Tags: worktree, parallel, scratchpad, commit-message.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- Plan 11 (consent prompt) can rely on `qq telemetry on|off` as the documented way to change the answer later, and on status `asked:` to confirm that the prompt persisted.
- Plan 13 (real key): once the key is baked, status flips to `project key: present` and the doctor row to `telemetry on` with no code change.
- Plan 05's smoke doctor step validates with `doctorReportSchema`, which accepts the new id. Any literal check-count assertion there must be 12.

## Self-Check: PASSED

- FOUND: src/cli/commands/telemetry.ts, tests/telemetry-cli.test.ts, src/cli/main.ts, src/contracts/doctor.ts, src/cli/commands/doctor.ts, tests/doctor.test.ts
- FOUND commits on this branch: 02c4622, 320cc8d, 99f22c5, 06b1a2b
- Task 1 and Task 2 acceptance criteria re-run: all pass (id-order grep checked against the formatter's one-per-line output, as the plan allows)
