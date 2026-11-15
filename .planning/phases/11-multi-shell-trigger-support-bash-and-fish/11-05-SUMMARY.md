---
phase: 11-multi-shell-trigger-support-bash-and-fish
plan: 05
subsystem: telemetry
tags: [telemetry, zod, privacy, bash, posthog]

requires:
  - phase: 11-01
    provides: "shellRequestSchema.shell (z.enum(SHELL_NAMES).default('zsh')) and shellVersion on request.json"
  - phase: 11-03
    provides: "run-foreground.ts with the handoff start-early/await-late edits (call site of reportClientTelemetry)"
provides:
  - "SHELL_KINDS = ['zsh', 'bash', 'fish'] and ShellKind in the telemetry allow list"
  - "qq_environment fields shell (enum) and shell_version (major.minor or unknown); zsh kept"
  - "shellMajorMinor(version) exported from src/shared/environment-shape.ts (was private zshMajorMinor)"
  - "EnvironmentShapeInput.shell / .shellVersion and ReportClientTelemetryInput.shell / .shellVersion"
  - "run-foreground threads request.shell and request.shellVersion into reportClientTelemetry"
  - "wire-body canary on the flushed PostHog /batch/ body for a bash ??"
affects: [11-10 shell-names invariant test, 11-11 wolf entries, telemetry dashboards]

actuals:
  tokens: 6400
  tasks: 2
  commits: 4

plan_head_before: 43c48611bae9eefdf77b96529763946bc217dca0
plan_head_after: 319f389ad466f346cb4cfa8807795ac65c387dac

tech-stack:
  added: []
  patterns:
    - "Telemetry contract fields are added, never renamed: zsh stays next to shell_version"
    - "One shared majorMinor zod schema for every shell version field"
    - "Missing request shell defaults to zsh (D-02 back-compat), not unknown"

key-files:
  created: []
  modified:
    - src/contracts/telemetry.ts
    - src/shared/environment-shape.ts
    - src/client/telemetry-events.ts
    - src/client/run-foreground.ts
    - docs/PRIVACY.md
    - tests/telemetry-contract.test.ts
    - tests/environment-shape.test.ts
    - tests/telemetry-events.test.ts
    - tests/telemetry-buffer.test.ts

key-decisions:
  - "SHELL_KINDS is declared in src/contracts/telemetry.ts (the allow list file) and pinned equal to SHELL_NAMES by a test, instead of importing SHELL_NAMES"
  - "SHELL_KINDS has no unknown value: shell 'unknown' fails the schema; a request with no shell reports zsh"
  - "QQ_ZSH_VERSION is read only when the shell is zsh, so a bash or fish ?? always reports zsh: unknown"

patterns-established:
  - "Wire-body canary: assert on String(fetchImpl.mock.calls[0][1].body) after buffer.flush(), through the default (non-injected) environment branch"

requirements-completed: [BASH-01]

coverage:
  - id: D1
    description: "Strict environment contract allow-lists shell (zsh, bash, fish) and shell_version (major.minor or unknown), zsh kept"
    requirement: BASH-01
    verification:
      - kind: unit
        ref: "tests/telemetry-contract.test.ts#pins the payload keys of every event"
        status: pass
      - kind: unit
        ref: "tests/telemetry-contract.test.ts#free-form values fail"
        status: pass
      - kind: unit
        ref: "tests/telemetry-contract.test.ts#lists the same shells as the shell request contract"
        status: pass
    human_judgment: false
  - id: D2
    description: "shellMajorMinor and collectEnvironmentShape report bash 5.2, fish 4.0, zsh 5.9 and old widgets as zsh"
    requirement: BASH-01
    verification:
      - kind: unit
        ref: "tests/environment-shape.test.ts#shellMajorMinor"
        status: pass
      - kind: unit
        ref: "tests/environment-shape.test.ts#reports zsh from QQ_ZSH_VERSION when the request names no shell (old widgets)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A bash ?? sends shell bash and shell_version 5.2 on the wire, never the raw BASH_VERSION or an rc path"
    requirement: BASH-01
    verification:
      - kind: integration
        ref: "tests/telemetry-events.test.ts#posts shell bash and major.minor, never the raw bash version, on the wire"
        status: pass
      - kind: unit
        ref: "tests/telemetry-events.test.ts#reports a bash request as bash from the default environment shape"
        status: pass
      - kind: integration
        ref: "tests/telemetry-events.test.ts#leaks no prompt, path, command or message end to end"
        status: pass
    human_judgment: false
  - id: D4
    description: "docs/PRIVACY.md lists shell and shell_version and says nothing free-form is sent"
    requirement: BASH-01
    verification:
      - kind: other
        ref: "pnpm exec vitest run tests/docs-links.test.ts; grep -cF shell_version docs/PRIVACY.md"
        status: pass
    human_judgment: true
    rationale: "Privacy wording accuracy is a reading judgment; tests only check links and the presence of the field names"

duration: 11min
completed: 2026-11-14
status: complete
---

# Phase 11 Plan 05: Shell-aware telemetry environment Summary

**The opt-in `qq_environment` event now carries an allow-listed `shell` enum (`zsh`, `bash`, `fish`) and that shell's major.minor `shell_version`, threaded from request.json through `reportClientTelemetry`. A bash `??` sends `"shell":"bash","shell_version":"5.2","zsh":"unknown"` on the PostHog wire body, and never the raw `5.2.21(1)-release` build string.**

## Performance

- **Duration:** about 11 min
- **Started:** 2026-11-14T13:29:30Z
- **Completed:** 2026-11-14T13:40:12Z
- **Tasks:** 2 (each RED + GREEN)
- **Files modified:** 9

## Accomplishments

- `src/contracts/telemetry.ts`: `SHELL_KINDS` / `ShellKind`, a shared `majorMinor` schema, `shell` and `shell_version` environment fields. The `zsh` field is kept, and its doc comment now says it is `unknown` outside zsh.
- `src/shared/environment-shape.ts`: `shellMajorMinor` is exported (renamed from the private `zshMajorMinor`, same regex). `collectEnvironmentShape` takes `shell` / `shellVersion`. A missing shell defaults to zsh (D-02 back-compat, with a one-line comment), and `QQ_ZSH_VERSION` is read only for zsh.
- `src/client/telemetry-events.ts` and `src/client/run-foreground.ts`: `request.shell` and `request.shellVersion` reach `collectEnvironmentShape({ env: input.env, shell, shellVersion })`.
- Tests: pinned `ENVIRONMENT_KEYS` with the two new keys. Free-form rejects: `tcsh`, `/bin/bash`, `unknown`, `5.2.21(1)-release`, `5`, `5.2.21`, `GNU bash 5.2`. An early `SHELL_KINDS == SHELL_NAMES` guard. Default-branch bash and old-widget cases, a raw-version and `.bashrc` canary in the leak test, and a wire-body canary on the flushed `/batch/` POST.
- `docs/PRIVACY.md`: the provider context names `zsh` or `bash`, and the `qq_environment` bullet lists shell and `shell_version` next to the kept zsh field. New sentence: "Each field holds a fixed name, a number, a yes/no flag or a major.minor version: nothing free-form is sent."

## Task Commits

1. **Task 1 RED: failing tests for the shell / shell_version contract** - `d16481a` (test)
2. **Task 1 GREEN: allow-list shell and shell_version in the environment** - `b3e3353` (feat)
3. **Task 2 RED: failing tests for bash shell threading into client telemetry** - `23d0424` (test)
4. **Task 2 GREEN: report the request's shell and version, PRIVACY.md** - `319f389` (feat)

No REFACTOR commits were needed.

## TDD Gate Compliance

- **Task 1 RED:** `vitest run tests/environment-shape.test.ts -t 'reports a bash request as shell bash' --reporter=tap-flat` exited 1. `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK` (`target_test_failed`, 1 of 32 ran, 1 failed). Semantic assessment: the target ran and failed on the planned assertion (`expected undefined to be 'bash'`), because `collectEnvironmentShape` did not yet emit `shell`. This was not a load, syntax or fixture fault. The other RED failures were the pinned keys and the shellMajorMinor stub throwing.
- **Task 2 RED:** `vitest run tests/telemetry-events.test.ts -t 'reports a bash request as bash from the default' --reporter=tap-flat` exited 1. Result: `RED_EVIDENCE_OK` (`target_test_failed`). Semantic assessment: the assertion failed as planned (`expected 'zsh' to be 'bash'`), because `reportClientTelemetry` did not pass the request shell yet, so the default shape fell back to zsh. The wire-body canary also failed in RED.
- **GREEN:** every RED commit is followed by its `feat(11-05)` commit, and the target tests pass.
- RED stubs kept `tsc --noEmit` green in pre-commit (cerebrum 2026-08-26). Task 1 added the `SHELL_KINDS` const, a throwing `shellMajorMinor` and type-only input fields. Task 2 added type-only `shell` / `shellVersion` on `ReportClientTelemetryInput`.

## Files Created/Modified

- `src/contracts/telemetry.ts` - SHELL_KINDS, majorMinor, shell / shell_version fields
- `src/shared/environment-shape.ts` - shellMajorMinor, shell-aware collectEnvironmentShape
- `src/client/telemetry-events.ts` - ReportClientTelemetryInput.shell / .shellVersion, passed to the shape
- `src/client/run-foreground.ts` - passes request.shell / request.shellVersion (no other change)
- `docs/PRIVACY.md` - shell name, shell / shell_version, no free-form values
- `tests/telemetry-contract.test.ts` - pinned keys, enum list, SHELL_NAMES guard, accept / reject cases
- `tests/environment-shape.test.ts` - shellMajorMinor table, bash / zsh / fish / old-widget cases
- `tests/telemetry-events.test.ts` - default-branch bash, no-shell zsh, off gate, leak canary, wire canary
- `tests/telemetry-buffer.test.ts` - environment fixture gains shell / shell_version (deviation 1)

## Decisions Made

- `SHELL_KINDS` repeats `SHELL_NAMES` in the allow-list file on purpose (per plan), and a test pins the two lists equal.
- A shell value of `unknown` is rejected, and a request without `shell` reports zsh. The review ledger's disposition stands: the rejected fail-closed `unknown` alternative would mislabel old zsh widgets.
- The key-link form `collectEnvironmentShape({ env: input.env, shell, shellVersion })` destructures `input` first, so the call fits on one line.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Environment fixture in tests/telemetry-buffer.test.ts gained the new fields**
- **Found during:** Task 1 GREEN
- **Issue:** The strict environment schema now requires `shell` and `shell_version`. The untyped `ENVIRONMENT` fixture in tests/telemetry-buffer.test.ts would fail validation, so the buffer would drop it.
- **Fix:** Added `shell: 'zsh'`, `shell_version: '5.9'` to the fixture. This file is not in 11-05 files_modified, and also not in 11-07 (bash adapter and tests) or 11-08 (doctor) files_modified, so it does not collide with the parallel siblings.
- **Files modified:** tests/telemetry-buffer.test.ts
- **Verification:** `pnpm exec vitest run tests/telemetry-buffer.test.ts` passed, and the full suite passed.
- **Committed in:** b3e3353

**2. [Rule 3 - Blocking] Typed SHAPE fixture in tests/telemetry-events.test.ts was updated in Task 1, not Task 2**
- **Found during:** Task 1 GREEN
- **Issue:** `SHAPE: EnvironmentShape` lacked the new required fields, so `pnpm typecheck` (Task 1 verify, and the pre-commit hook) failed.
- **Fix:** Added the two fields in the Task 1 GREEN commit. The file is in this plan's files_modified (Task 2).
- **Committed in:** b3e3353

**3. [Rule 2 - Missing critical] PRIVACY.md now states "nothing free-form is sent" explicitly**
- **Found during:** Task 2
- **Issue:** The must_haves truth says PRIVACY.md "keeps saying that nothing free-form is sent", but the page only implied it.
- **Fix:** Added one sentence to the telemetry section.
- **Committed in:** 319f389

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 missing critical). **Impact:** fixture and wording updates only. No scope creep, and no behavior outside D-11.

## Verification

- `pnpm test:run`: 65 files, 1764 tests passed (with `QQ_TEST_BASH=/opt/local/bin/bash`, `/opt/local/bin` on PATH)
- `pnpm typecheck`: exit 0
- `pnpm lint`: exit 0 (166 files)
- Task acceptance greps all pass. These include `SHELL_KINDS` declaration, `shell_version:` / `zsh:` in the contract, `export function shellMajorMinor`, `'shell_version'` in the contract test, `shellVersion: request.shellVersion`, `shell_version` and `bash` in PRIVACY.md, `release` and `"shell_version":"5.2"` in telemetry-events.test.ts, and `SHELL_NAMES` in the contract test. Biome check on the seven listed files: clean.

## Issues Encountered

None.

## Known Stubs

None. The RED throw-on-call stub for `shellMajorMinor` was replaced in GREEN (b3e3353).

## Threat Flags

None. No new endpoint or trust boundary. T-11-19 is mitigated by the enum, the regex and the wire canary. T-11-20 is mitigated by `z.enum(SHELL_KINDS)` re-validation and the SHELL_NAMES equality test. T-11-SC: no package installs.

## User Setup Required

None. No external service configuration is required, and no telemetry key is baked yet.

## Next Phase Readiness

- Plan 10's shell-names invariant test can import `SHELL_KINDS` from src/contracts/telemetry.ts.
- Once plan 02's zsh widget sends `shellVersion`, zsh reports come from the request. Until then they fall back to `QQ_ZSH_VERSION`, which gives the same major.minor.

## Wolf entries

For plan 11 to apply (this worktree commits no `.wolf/` file):

- **anatomy.md:** `src/contracts/telemetry.ts` now has `SHELL_KINDS` / `ShellKind` plus `shell` / `shell_version` environment fields (zsh kept). `src/shared/environment-shape.ts` exports `shellMajorMinor(version)`, and `collectEnvironmentShape` takes `shell` / `shellVersion`. `src/client/telemetry-events.ts`: `ReportClientTelemetryInput.shell` / `.shellVersion`.
- **cerebrum Key Learnings:** [2026-11-14] The telemetry environment shape takes the shell from request.json, not from the env. `QQ_ZSH_VERSION` is read only when `shell` is zsh, and a request without `shell` reports zsh (D-02 back-compat). `SHELL_KINDS` (telemetry allow list) must stay equal to `SHELL_NAMES`, and tests/telemetry-contract.test.ts pins it.
- **cerebrum Do-Not-Repeat:** [2026-11-14] Adding a required field to a strict telemetry payload breaks every hand-built environment fixture. The typed `SHAPE` in tests/telemetry-events.test.ts fails `tsc`. The untyped `ENVIRONMENT` in tests/telemetry-buffer.test.ts fails only at runtime, because the buffer drops invalid events. Grep `node_major` across tests/ before changing the environment contract.
- **cerebrum Do-Not-Repeat:** [2026-11-14] Key-link grep patterns like `collectEnvironmentShape\(\{ env: input\.env, shell` need the call on one line. If the object would exceed biome's line width, destructure the inputs first so the call fits.
- **buglog:** none (no bug fixed; the fixture updates were planned contract fallout).
- **memory.md:** `| 13:40 | 11-05: shell + shell_version telemetry fields, threaded from request.json, wire canary, PRIVACY.md | src/contracts/telemetry.ts, src/shared/environment-shape.ts, src/client/telemetry-events.ts, src/client/run-foreground.ts, docs/PRIVACY.md, 4 tests | 1764 tests pass | ~6.4k |`

## Self-Check: PASSED

- All 9 modified files exist on disk.
- Commits d16481a, b3e3353, 23d0424 and 319f389 are ancestors of HEAD.
- Every commit subject carries `(11-05)`.
