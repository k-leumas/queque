---
phase: 10-linux-distro-ci-harness-and-anonymous-telemetry
plan: 03
subsystem: cli
tags: [doctor, zod, cac, diagnostics, zsh, ci]

requires:
  - phase: 08
    provides: provider pin (loadProviderPin) and detectProvider waterfall
  - phase: 09.1
    provides: pingDaemonFetchCap pong-flag check in src/daemon/bootstrap.ts
provides:
  - "src/contracts/doctor.ts: DOCTOR_CHECK_IDS, DOCTOR_STATUSES, DOCTOR_PLATFORMS, doctorCheckSchema, doctorReportSchema, DoctorCheck, DoctorReport, doctorExitCode"
  - "src/cli/commands/doctor.ts: DoctorDeps, defaultDoctorDeps, runDoctorChecks, formatDoctorReport, doctorCommand, parseZshBindings, ZSH_FAIL_BELOW, ZSH_WARN_BELOW, SOCKET_PATH_MAX_BYTES"
  - "CLI: qq doctor [--json]"
affects: [10-05 distro smoke doctor step, 10-07 auto-revert PR body, 10-09 telemetry check id]

actuals:
  tokens: 9200
  tasks: 2
  commits: 3
plan_head_before: a7bdf0bdb7a48125c349d0d7fb60fa7a2f2e04ca
plan_head_after: a90916b2baf8a63b7efa7235df0edfd80c4a49a6

tech-stack:
  added: []
  patterns:
    - "Injectable DoctorDeps object (no execFile mocks); healthy baseline spread per test case"
    - "spawn with stdin ignored, timeout + SIGKILL, exit-then-grace resolve so a grandchild holding stdout cannot hang doctor"
    - "Marker-line probe (__qq_emacs__/__qq_viins__) so ~/.zshrc output from zsh -ic cannot be mistaken for a binding"

key-files:
  created:
    - src/contracts/doctor.ts
    - src/cli/commands/doctor.ts
    - tests/doctor.test.ts
  modified:
    - src/cli/main.ts

key-decisions:
  - "A missing zsh is detected with the PATH scan (fail); zsh on PATH whose version cannot be read is a warn, so a hung probe never becomes a hard blocker"
  - "Provider check: a valid pin is ok without running detectProvider; an invalid pin warns and never echoes the pin path or parse message (they can carry home paths and file text)"
  - "Summary counts warn plus fail as problems, singular/plural ('1 problem found', '2 problems found')"
  - "ok summaries never print env values either: TERM shows 'TERM is set', locale shows only the variable name it came from"

patterns-established:
  - "Doctor copy rule: summaries and hints are fixed text plus versions, the socket path, a widget name or the literal ~/.zshrc"

requirements-completed: [P10-DOCTOR, P10-FIX]

coverage:
  - id: D1
    description: "Strict versioned doctor JSON contract with stable check ids and exit rule (1 exactly when a check failed)"
    requirement: P10-DOCTOR
    verification:
      - kind: unit
        ref: "tests/doctor.test.ts#sets ok to \"no check failed\" and doctorExitCode to 1 exactly then"
        status: pass
      - kind: unit
        ref: "tests/doctor.test.ts#rejects unknown check ids and extra keys"
        status: pass
    human_judgment: false
  - id: D2
    description: "Hard blockers fail (zsh missing or below 5.0, jq missing, /tmp, socket length/owner); everything else warns with exit 0"
    requirement: P10-DOCTOR
    verification:
      - kind: unit
        ref: "tests/doctor.test.ts (runDoctorChecks: zsh, hard blockers, warnings keep exit 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "No environment value, home path or file content reaches the report (canary test)"
    requirement: P10-DOCTOR
    verification:
      - kind: unit
        ref: "tests/doctor.test.ts#never puts environment values, the home directory or file contents in the report"
        status: pass
    human_judgment: false
  - id: D4
    description: "qq doctor [--json] from the built CLI: checklist with marks and hints, JSON with 11 checks, exit 0 on this machine"
    requirement: P10-DOCTOR
    verification:
      - kind: integration
        ref: "pnpm build && node dist/cli/main.js doctor --json | node -e '<version 1, 11 checks, ok true>'"
        status: pass
      - kind: unit
        ref: "tests/doctor.test.ts (formatDoctorReport, doctorCommand)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Linux behaviour under fake claude (provider warn, exit 0) in a real distro container"
    requirement: P10-FIX
    verification: []
    human_judgment: true
    rationale: "Unit-tested with injected deps only; the real Linux run is plan 05's distro smoke doctor step"

duration: 10min
completed: 2026-10-29
status: complete
---

# Phase 10 Plan 03: qq doctor Summary

**`qq doctor [--json]`: eleven checks marked ✓/⚠/✗, each ⚠ and ✗ with a one-line fix. The JSON contract is strict, zod-validated and versioned. Exit 1 only when zsh is missing or older than 5.0, jq is missing, /tmp is unusable, or the socket path is too long or owned by another user.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-10-29T19:36:33Z
- **Completed:** 2026-10-29T19:45:58Z
- **Tasks:** 2
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments
- `src/contracts/doctor.ts`: `doctorReportSchema` (`z.strictObject`, `version: 1`, strings capped at 200 chars), a stable check-id enum and `doctorExitCode`.
- `src/cli/commands/doctor.ts`: `runDoctorChecks(deps)` encodes D-17, D-19 and D-20. Real deps use `spawn` with stdin ignored (3 s for `zsh -fc`, 5 s for `zsh -ic` with `QQ_DAEMON_PREWARMED=1`). They only read: `lstat`, ping, a `/tmp` mkdtemp probe that cleans up after itself.
- `formatDoctorReport` / `doctorCommand` write to stdout and set `process.exitCode`. `qq doctor` is registered in `src/cli/main.ts` between `init` and `daemon`.
- 45 tests in `tests/doctor.test.ts`. They cover every `<behavior>` case, the binding parser, the read-only default deps (real zsh version probe), the formatter and command exit codes, and a multi-source canary no-leak test.

## This machine's `qq doctor` output (macOS, built CLI)

```
✓ zsh 5.9
✓ jq found
✓ /tmp is writable
✓ daemon socket /tmp/qq-501.sock
✓ daemon running
✓ ~/.zshrc loads QueQue
✓ ? is bound to qq-question-widget in emacs and viins
✓ TERM is set
✓ locale is UTF-8 (from LANG)
✓ provider pinned to claude
✓ Node 24.14.1
qq doctor: no problems found
```

Exit 0. `doctor --json` parses with version 1, 11 checks and `ok: true`. `--help` lists `doctor`. No ✗ on this machine.

## Task Commits

1. **Task 1 RED: failing doctor tests + stubs** - `4ce19ee` (test)
2. **Task 1 GREEN: doctor checks and exit rule** - `33a09ee` (feat)
3. **Task 2: `qq doctor [--json]` command** - `a90916b` (feat)

## TDD Gate Compliance

- **RED** (`4ce19ee`): 30 of 33 tests failed against stubs: `runDoctorChecks` returned an empty report and `doctorExitCode` returned 0. Evidence was captured with `--reporter=tap-flat -t "fails when jq is missing"`. `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK` (`target_test_failed`).
  - **Semantic assessment:** the target test ran and failed on its planned assertion (`expected undefined to be 'fail'`) because the stub emits no `jq` check. It was not a load, syntax or fixture fault.
  - Three tests passed against the stub, as expected: the schema-rejection test (the contract was already real), the canary no-leak test (an empty report leaks nothing) and the platform-`other` test (the stub hardcodes `other`).
- **GREEN** (`33a09ee`): all tests pass.
- **REFACTOR:** none needed.

## Files Created/Modified
- `src/contracts/doctor.ts` - doctor JSON contract and exit rule
- `src/cli/commands/doctor.ts` - injectable checks, real deps, checklist formatter, command
- `src/cli/main.ts` - registers `qq doctor [--json]`
- `tests/doctor.test.ts` - status, exit-code, JSON-shape, formatter and no-leak tests

## Decisions Made
- Check order follows `DOCTOR_CHECK_IDS`. The four async checks (zsh, daemon, binding, provider) run in parallel, so wall time is about the slowest probe.
- A zsh that is on PATH but does not report a version is a warning, not a failure. Only a missing zsh, or a parsed version below 5.0, makes `??` impossible.
- The binding probe prints `__qq_emacs__`/`__qq_viins__` marker lines. Only `"?" <widget>` after a marker is parsed. Widget names are limited to `[A-Za-z0-9_.:+-]{1,64}`, so stray `~/.zshrc` output never ends up in the report.
- `captureStdout` resolves when the child emits `close`, or 100 ms after it emits `exit`. Background helpers started from `~/.zshrc` (such as gitstatusd) can hold stdout open, and this keeps them from stalling doctor until the timeout.

## Deviations from Plan

None in behaviour. Small additions inside the planned files:
- `parseZshBindings` is exported so the marker parser has its own tests.
- The real `defaultDoctorDeps()` zsh-version, PATH-scan and `/tmp` probes are tested without mocks (cerebrum: add an unmocked stdin-EOF child test for spawn).

**Total deviations:** 0 auto-fixed.

## Issues Encountered
- `pnpm lint` (`biome check .`) reports "No files were processed" inside this worktree. `biome.json` excludes `!!**/.claude`, and the worktree lives under `.claude/worktrees/`. This comes from where the worktree sits, not from this plan. `pnpm exec biome check src tests` is clean (113 files), and the pre-commit biome hook passed on every commit. On the main checkout, `pnpm lint` will behave normally.
- The worktree had no `node_modules`. Ran `pnpm install --frozen-lockfile --prefer-offline`: lockfile only, no new packages.
- Plan-level verification: `pnpm test:run` 44 files / 1128 tests passed; `pnpm typecheck` 0 errors; `pnpm build` success.

## OpenWolf entries (for plan 11 to apply)

anatomy.md:
- `src/contracts/doctor.ts` — qq doctor JSON contract (D-18): DOCTOR_CHECK_IDS (stable; add, never rename), DOCTOR_STATUSES ok/warn/fail, strict doctorReportSchema `{version:1, ok, qqVersion, platform, checks}`, doctorExitCode (1 iff a check failed). (~500 tok)
- `src/cli/commands/doctor.ts` — qq doctor: DoctorDeps (injectable), defaultDoctorDeps (spawn zsh -fc / zsh -ic with stdin ignored, PATH scan, /tmp mkdtemp probe, lstat owner, pingDaemonFetchCap, loadProviderPin, detectProvider), runDoctorChecks (11 checks, D-17/D-19/D-20), parseZshBindings, formatDoctorReport (✓/⚠/✗ + ` — fix:`), doctorCommand (sets process.exitCode). (~4400 tok)
- `tests/doctor.test.ts` — doctor status/exit/JSON/formatter/command tests with a healthy-baseline fake DoctorDeps; canary no-leak test; real read-only defaultDoctorDeps probes. (~4300 tok)
- `src/cli/main.ts` — add: registers `qq doctor [--json]` between init and daemon.

cerebrum.md (Key Learnings):
- [2026-10-29] Doctor output goes into public revert PR bodies. Every summary/hint is fixed copy plus versions, the socket path, a widget name or the literal `~/.zshrc`. Never echo TERM/LANG values, the pin path or parse message, PATH hits, or `~/.zshrc` text. Plan 09's `telemetry` check must follow the same rule.
- [2026-10-29] `biome check .` processes 0 files inside a `.claude/worktrees/*` checkout because biome.json has `!!**/.claude`. In worktrees, lint explicit paths (`pnpm exec biome check src tests`).
- [2026-10-29] When spawning `zsh -ic`, resolve on `exit` + short grace as well as `close`: helpers started by ~/.zshrc can inherit and hold stdout.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 05 can add the smoke doctor step: `qq doctor --json > doctor.json`, assert exit 0, and validate the JSON with `doctorReportSchema`. Under fake claude on Linux the provider row is ⚠, so the exit code is still 0.
- Plan 07 can embed `doctor.json` in revert PR bodies; the canary test guards against leaks.
- Plan 09 adds the `telemetry` id to `DOCTOR_CHECK_IDS` and its row to `runDoctorChecks`. The healthy-run test asserts id order, so it must be updated too.

## Self-Check: PASSED

- FOUND: src/contracts/doctor.ts, src/cli/commands/doctor.ts, tests/doctor.test.ts
- FOUND: 4ce19ee, 33a09ee, a90916b on worktree-agent-ae7eae29e6f46af10
- Task 1 and Task 2 acceptance criteria re-run: all pass

---
*Phase: 10-linux-distro-ci-harness-and-anonymous-telemetry*
*Completed: 2026-10-29*
