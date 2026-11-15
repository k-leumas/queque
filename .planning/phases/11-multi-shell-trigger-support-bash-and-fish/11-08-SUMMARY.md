---
phase: 11-multi-shell-trigger-support-bash-and-fish
plan: 08
subsystem: cli
tags: [bash, zsh, doctor, shell-registry, readline, vitest]

requires:
  - phase: 11-04
    provides: "src/shared/shell-registry.ts (SHELL_SPECS, getShellSpec, shippedShellNames, detectShell, parseShellVersion, versionBelow, loginFileSourcesBashrc, ZSH_/BASH_ floors)"
  - phase: 11-01
    provides: "SHELL_NAMES / ShellName / isShellName; shell/bash/queque.bash binds _qq_question in emacs and vi-insert"
provides:
  - "doctor check ids bash, fish (reserved, never emitted in Phase 11), bash_profile"
  - "DoctorDeps.shellVersion(shell), .shellBindings(shell), .readRc(relPath), .userShell; ShellBindings"
  - "BASH_BINDINGS_SCRIPT, parseBashBindings(output), resolveDoctorShell(deps, requested?)"
  - "runDoctorChecks(deps?, { shell? }) with per-shell version, integration, binding and the macOS bash_profile row"
  - "doctorCommand({ json, shell }, deps?) and CLI `qq doctor --shell <name>` (fish and unknown shells exit 2)"
affects: [11-09 smoke (doctor-bash.json, exit codes 38/39), 11-10 docs, 11-11 phase gate, phase 12 fish doctor]

actuals:
  tokens: 13200
  tasks: 2
  commits: 4
plan_head_before: 43c48611bae9eefdf77b96529763946bc217dca0
plan_head_after: 76077c4af5c5aebc046175ac07888f971300255b

tech-stack:
  added: []
  patterns:
    - "Doctor reads every per-shell fact from SHELL_SPECS: version row id = spec.shell, rcFile/rcDisplay, bindingWidget/bindingKeymaps, failBelow/warnBelow"
    - "One report = one target shell; row count depends on target and platform, never on DOCTOR_CHECK_IDS.length"

key-files:
  created: []
  modified:
    - src/contracts/doctor.ts
    - src/cli/commands/doctor.ts
    - src/cli/main.ts
    - tests/doctor.test.ts

key-decisions:
  - "The bash binding probe falls back from `bind -X` to `bind -p`, so a readline function such as self-insert can be named in the warning"
  - "The probe calls `builtin printf` / `builtin bind` and `command grep`, so user aliases from ~/.bashrc cannot change its output (checked against a real bash 5.3 with `alias printf=false`)"
  - "Marker regex is not anchored at a line start: bash 3.2 readline prints ESC[?1034h on the same line as a marker"
  - "bash 5.3 prints `\"?\" \"_qq_question\"` from bind -X (no colon); the parser accepts both forms"
  - "The binding row is skipped (warn, no spawn) when the version row failed, and for bash also when the version is unreadable"
  - "Both shell probes drop BASH_ENV and ENV from the child env; the -ic probe also sets QQ_DAEMON_PREWARMED=1"
  - "The bracketed-paste hint names ~/.inputrc; the copy-rule comment in the contract now lists it with the other ~/ literals"

patterns-established:
  - "Usage errors in doctor (unknown or unshipped --shell) go to stderr with exit 2 and never echo the rejected value"

requirements-completed: [BASH-01]

coverage:
  - id: D1
    description: "bash version row: fail when missing or below 5.0, warn below 5.1 (bracketed paste off by default), ok from 5.1; major.minor.patch only"
    requirement: BASH-01
    verification:
      - kind: unit
        ref: "tests/doctor.test.ts#runDoctorChecks: bash version (D-12)"
        status: pass
    human_judgment: false
  - id: D2
    description: "integration reads ~/.bashrc for a bash target; macOS bash_profile row warns when the first login file does not source ~/.bashrc or none exists; read only"
    requirement: BASH-01
    verification:
      - kind: unit
        ref: "tests/doctor.test.ts#runDoctorChecks: bash integration and macOS login file (D-09)"
        status: pass
    human_judgment: false
  - id: D3
    description: "bash binding row (emacs and vi-insert run _qq_question, bracketed paste, ble.sh) and parseBashBindings over real probe output"
    requirement: BASH-01
    verification:
      - kind: unit
        ref: "tests/doctor.test.ts#runDoctorChecks: bash binding"
        status: pass
      - kind: unit
        ref: "tests/doctor.test.ts#parseBashBindings"
        status: pass
      - kind: other
        ref: "PATH=/opt/local/bin:$PATH node dist/cli/main.js doctor --shell bash (real bash 5.3.20)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Target resolution (--shell > $SHELL > passwd shell > zsh, shipped only) with zsh reports unchanged (12 rows, same rules)"
    requirement: BASH-01
    verification:
      - kind: unit
        ref: "tests/doctor.test.ts#runDoctorChecks: target shell (D-08, D-02)"
        status: pass
      - kind: other
        ref: "node dist/cli/main.js doctor --shell zsh --json (12 checks, version 1, first id zsh)"
        status: pass
    human_judgment: false
  - id: D5
    description: "No leaks: HOME, the SHELL path, rc content and the raw build string never reach JSON or text output"
    requirement: BASH-01
    verification:
      - kind: unit
        ref: "tests/doctor.test.ts#runDoctorChecks: no leaks for a bash target (T-11-25)"
        status: pass
    human_judgment: false
  - id: D6
    description: "`qq doctor --shell <name>`: bash/zsh reports from the built CLI; fish and unknown shells exit 2 on stderr"
    requirement: BASH-01
    verification:
      - kind: unit
        ref: "tests/doctor.test.ts#doctorCommand --shell"
        status: pass
      - kind: other
        ref: "node dist/cli/main.js doctor --shell fish; test $? -eq 2"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-11-14
status: complete
---

# Phase 11 Plan 08: bash diagnostics in `qq doctor` Summary

**`qq doctor` now targets the user's shell (`--shell` > `$SHELL` > passwd shell > zsh) and reads every shell fact from the 11-04 registry. For bash it fails below 5.0, warns below 5.1, checks that `~/.bashrc` loads QueQue, that `?` runs `_qq_question` in emacs and vi-insert with bracketed paste on and without ble.sh, and on macOS that the login file sources `~/.bashrc`. zsh reports are unchanged.**

## Performance

- **Duration:** about 12 min
- **Started:** 2026-11-14T13:34:39Z
- **Completed:** 2026-11-14T13:46:16Z
- **Tasks:** 2 (each RED and GREEN)
- **Files modified:** 4

## Accomplishments

- Contract: ids `bash`, `fish` (reserved for Phase 12) and `bash_profile` appended. Existing ids and order are untouched, and the JSON stays `version: 1`.
- `DoctorDeps` is per-shell: `shellVersion(shell)`, `shellBindings(shell)`, `readRc(relPath)`, `userShell`. `readZshrc`, `zshVersion` and `zshBindings` are gone.
- Doctor's own `ZSH_*` constants and `versionParts`/`versionBelow` are removed. Everything comes from `src/shared/shell-registry.ts`. `checkNode` now uses `parseShellVersion(deps.nodeVersion)`. The floors are re-exported from doctor.ts.
- Rows for a bash target: `bash, jq, tmp, socket, daemon, integration, [bash_profile on darwin], binding, term, locale, provider, node, telemetry`. That is 12 rows on Linux and 13 on macOS, so the smoke's `>= 11` holds.
- `qq doctor --shell <name>` is wired in `main.ts`. `fish` prints `qq doctor: fish support is coming in a later release; supported now: zsh, bash`. An unknown name prints `qq doctor: unsupported shell; supported: zsh, bash`. Both exit 2 with no report.

## Live runs on this machine

`node dist/cli/main.js doctor --shell zsh` (exit 0):

```
✓ zsh 5.9
✓ jq found
✓ /tmp is writable
✓ daemon socket /tmp/qq-501.sock
⚠ daemon outdated; replaced on the next ?? — fix: nothing to do, or run `qq daemon --ensure` now
✓ ~/.zshrc loads QueQue
✓ ? is bound to qq-question-widget in emacs and viins
✓ TERM is set
✓ locale is UTF-8 (from LANG)
✓ provider pinned to claude
✓ Node 24.14.1
✓ telemetry on
qq doctor: 1 problem found
```

`node dist/cli/main.js doctor --shell bash` with the default PATH (`/bin/bash` 3.2, `$SHELL` is zsh), exit 1:

```
✗ bash 3.2.57 is older than 5.0 — fix: brew install bash (5.1 or newer), then make it your login shell
✓ jq found
✓ /tmp is writable
✓ daemon socket /tmp/qq-501.sock
⚠ daemon outdated; replaced on the next ?? — fix: nothing to do, or run `qq daemon --ensure` now
⚠ ~/.bashrc does not load QueQue — fix: qq init bash && source ~/.bashrc
⚠ ~/.bash_profile does not source ~/.bashrc; macOS login shells skip it — fix: add [ -f ~/.bashrc ] && . ~/.bashrc to ~/.bash_profile
⚠ ? key bindings not checked: bash 5.0 or newer is needed first — fix: brew install bash (5.1 or newer), then make it your login shell
✓ TERM is set
✓ locale is UTF-8 (from LANG)
✓ provider pinned to claude
✓ Node 24.14.1
✓ telemetry on
qq doctor: 5 problems found
```

`PATH=/opt/local/bin:$PATH node dist/cli/main.js doctor --shell bash` (MacPorts bash 5.3; this ran the real `bash -ic` probe against this machine's `~/.bashrc` with the prewarm suppressed), exit 0:

```
✓ bash 5.3.20
...
⚠ ~/.bashrc does not load QueQue — fix: qq init bash && source ~/.bashrc
⚠ ~/.bash_profile does not source ~/.bashrc; macOS login shells skip it — fix: add [ -f ~/.bashrc ] && . ~/.bashrc to ~/.bash_profile
⚠ ? is bound to self-insert in the emacs keymap — fix: qq init bash && source ~/.bashrc, then check what rebinds ? later in ~/.bashrc
...
qq doctor: 4 problems found
```

The binding warning is expected: `qq init bash` has not been run on this machine. That is why the plan's verify checks row ids, not statuses. The JSON verifies also passed: zsh gives 12 checks starting with `zsh`, and bash starts with `bash` and includes `bash_profile`. `doctor --shell fish` exits 2, and `doctor --help` lists `--shell <name>`.

## Task Commits

1. **Task 1: per-shell doctor checks for bash**: RED `f091825` (test), GREEN `2a9c980` (feat)
2. **Task 2: `qq doctor --shell <name>`**: RED `80a5109` (test), GREEN `76077c4` (feat)

REFACTOR: none needed.

## TDD Evidence

- **Task 1 RED:** the target is `tests/doctor.test.ts > runDoctorChecks: bash version (D-12) > fails for bash 4.4.20`. It failed with `expected undefined to be 'fail'`, and `check tdd-red-evidence` returned RED_EVIDENCE_OK. Semantic check: this is the planned assertion. It failed because runDoctorChecks still ignored `options.shell` and emitted no `bash` row. There was no load or type fault, and 35 of 101 tests failed, all on bash or target assertions.
- **Task 2 RED:** the target is `tests/doctor.test.ts > doctorCommand --shell > prints a bash-target report for shell bash and sets the exit code from it`. It failed with `expected 'zsh' to be 'bash'`, and the check returned RED_EVIDENCE_OK. Semantic check: doctorCommand did not pass `shell` through. The fish and tcsh tests also failed on their stderr assertions.
- **GREEN:** `tests/doctor.test.ts` passes 106/106. `vitest run tests/doctor.test.ts tests/shell-registry.test.ts tests/telemetry-cli.test.ts` passes 158/158.

## Verification

- `QQ_TEST_BASH=/opt/local/bin/bash pnpm test:run`: 65 files and 1781 tests passed.
- `pnpm typecheck` and `pnpm lint` (166 files) both exit 0. `pnpm build` succeeds.
- All acceptance greps pass:
  - `'bash_profile'` 1, `'fish'` 1
  - BASH_BINDINGS_SCRIPT export 1, parseBashBindings export 1
  - `readZshrc` 0 in both files
  - `canary-rc-xyz` 3
  - `parseShellVersion(deps.nodeVersion)` 1, `QQ_DAEMON_PREWARMED` 2
  - `'--shell <name>'` 1, `process.exitCode = 2` 2 lines
  - no `DOCTOR_CHECK_IDS.length` anywhere in src or tests
- BASH_BINDINGS_SCRIPT was also run against a real bash 5.3 in a temp HOME, through a throwaway vitest file that was deleted afterwards. Both rc files gave the parsed result the tests expect:
  - an rc binding `?` in both keymaps, plus `alias printf=false`;
  - an rc with paste off and `BLE_VERSION` set, where `?` falls back to self-insert.

## Files Created/Modified

- `src/contracts/doctor.ts`: three new ids; the copy-rule comment lists the bash `~/` literals and the one-target-per-report rule.
- `src/cli/commands/doctor.ts`: `ShellBindings`, per-shell `DoctorDeps`, `BASH_BINDINGS_SCRIPT`, `parseBashBindings`, `resolveDoctorShell`, `checkShellVersion`, spec-driven `checkIntegration`/`checkBinding`, `checkBashProfile`, `doctorCommand` validation.
- `src/cli/main.ts`: `--shell <name>` on `doctor`.
- `tests/doctor.test.ts`: `healthyDeps` updated to the new deps. The id-order test now uses an explicit zsh list. New cases cover target resolution, the bash version, integration, bash_profile, binding, parseBashBindings, bash leak canaries and `doctorCommand --shell`.

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] Hardened the bash probe script**
- **Found during:** Task 1, while running probes against real bash 3.2 and 5.3 in a temp HOME
- **Issue:** the plan's script and parser shape had three gaps:
  - `bind -X` shows only `bind -x` bindings, so a `?` left on `self-insert` printed an empty marker and could not be named.
  - bash 5.3 prints `"?" "_qq_question"` with no colon.
  - bash 3.2 prints `ESC[?1034h` on the same line as a marker.
  - User aliases from `~/.bashrc` apply under `bash -ic`.
- **Fix:**
  - each keymap prints the `bind -X` line or else the `bind -p` line;
  - the parser accepts both forms and does not anchor markers at a line start;
  - builtins are called as `builtin printf` / `builtin bind`.
- **Files modified:** src/cli/commands/doctor.ts
- **Committed in:** 2a9c980

**2. [Rule 2 - Correctness] Binding probe also skipped when the bash version is unreadable**
- **Issue:** the plan skips the probe only when the version check failed. An unreadable version (warn) could be a 3.2 that lacks `bind -X`.
- **Fix:** for bash, the probe is also skipped when the version cannot be parsed.
- **Committed in:** 2a9c980

**3. [Rule 3 - Blocking] Type-level adaptation in the RED commits**
- **Issue:** the RED tests use the new `DoctorDeps` shape and `doctorCommand({ shell })`. Under the old types, `tsc --noEmit` in pre-commit would fail.
- **Fix:**
  - RED `f091825` changed the deps interface and moved the zsh paths to the new deps with no behavior change. The bash exports were stubs (`''` and a throwing `parseBashBindings`), and `options.shell` was ignored.
  - RED `80a5109` only widened the `doctorCommand` options type.
- **Committed in:** f091825, 80a5109

**4. [Copy] `~/.inputrc` literal**
- The plan's behavior asks for an `~/.inputrc` hint when paste is off, but the truth list of allowed literals omits it. It is a fixed literal, not a home path, so it is allowed and is now listed in the contract's copy-rule comment.

**Total deviations:** 4 (2 correctness, 1 blocking, 1 copy). **Impact:** no scope creep. No file outside `files_modified` was touched.

## Issues Encountered

None. The full suite passed on the first run despite the machine load.

## User Setup Required

None.

## Next Phase Readiness

- Plan 09's smoke can run `qq doctor --shell bash --json` and assert `checks[0].id === 'bash'`. The binding row is ok only after `qq init bash`.
- Phase 12 adds the `fish` row by setting `SHELL_SPECS.fish.shipped`, adding a fish binding script/parser and a `doctorCommand` test. The id is already reserved.

## Wolf entries

For plan 11 to apply. Nothing under `.wolf/` was committed from this worktree.

**anatomy.md**
- `src/cli/commands/doctor.ts` (update): `qq doctor [--json] [--shell <name>]`, per-shell and registry-driven. Exports `DoctorDeps` (shellVersion/shellBindings/readRc/userShell), `ShellBindings`, `parseZshBindings`, `BASH_BINDINGS_SCRIPT`, `parseBashBindings`, `resolveDoctorShell`, `runDoctorChecks(deps?, {shell?})`, `formatDoctorReport`, `doctorCommand`. ~7.5k tok
- `src/contracts/doctor.ts` (update): ids add `bash`, `fish` (reserved), `bash_profile`. ~0.8k tok
- `tests/doctor.test.ts` (update): zsh and bash target cases, bash_profile, parseBashBindings, leak canaries, `doctorCommand --shell`. ~8.5k tok

**cerebrum.md, Key Learnings**
- [2026-11-14] bash 5.3 `bind -m KEYMAP -X` prints `"?" "_qq_question"` (no colon). `bind -X` lists only `bind -x` bindings, so the readline function for a key (`"?": self-insert`) comes from `bind -p`. bash 3.2 has no `-X`, and its readline prints `ESC[?1034h` on the same line as the next output.
- [2026-11-14] A `bash -ic` probe expands the user's aliases. Call `builtin printf` / `builtin bind` and `command grep` in any probe script.
- [2026-11-14] A doctor report has one target shell. Row count is 12 for zsh and Linux bash, and 13 for macOS bash. Never compare `checks.length` with `DOCTOR_CHECK_IDS.length`, because `fish` is reserved and not emitted.
- [2026-11-14] In this harness the Bash tool's PATH bash is `/bin/bash` 3.2 and `$SHELL` is zsh, so `qq doctor --shell bash` fails the version row there. Put `/opt/local/bin` first on PATH to exercise the 5.3 path.

**buglog.json**
- None. No bugs were found or fixed beyond the planned work.

**memory.md**
- `| 13:46 | 11-08 bash doctor checks + qq doctor --shell (RED/GREEN x2) | src/cli/commands/doctor.ts, src/contracts/doctor.ts, src/cli/main.ts, tests/doctor.test.ts | 1781 tests pass | ~13k |`

## Self-Check: PASSED

- FOUND: src/contracts/doctor.ts, src/cli/commands/doctor.ts, src/cli/main.ts, tests/doctor.test.ts
- FOUND commits: f091825, 2a9c980, 80a5109, 76077c4 (all subjects carry `(11-08)`)

---
*Phase: 11-multi-shell-trigger-support-bash-and-fish*
*Completed: 2026-11-14*
