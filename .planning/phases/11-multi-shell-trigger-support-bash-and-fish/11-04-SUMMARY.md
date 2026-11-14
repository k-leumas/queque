---
phase: 11-multi-shell-trigger-support-bash-and-fish
plan: 04
subsystem: cli
tags: [bash, zsh, init, shell-registry, readline, vitest]

requires:
  - phase: 11-01
    provides: "SHELL_NAMES / ShellName / isShellName in src/contracts/shell.ts; shell/bash/queque.bash adapter"
provides:
  - "src/shared/shell-registry.ts: ShellSpec, SHELL_SPECS (zsh, bash shipped; fish shipped: false), getShellSpec, shippedShellNames, detectShell, HOMEBREW_PREFIXES, resolveAdapterPath, ZSH_/BASH_ FAIL/WARN floors, parseShellVersion, versionBelow, BASH_LOGIN_FILES, BASHRC_SOURCE_RE, loginFileSourcesBashrc"
  - "src/cli/commands/init.ts: InitDeps, defaultInitDeps(), runInit(shellArg, deps) -> { exitCode, wrote }, initCommand(shell?, deps?), hasShellIntegration(existing, ShellName) over source/dot forms"
  - "bash shell adapter registered in bootstrap ({ id: 'bash', shell: 'bash' })"
  - "qq init [shell] (auto-detect) and dispatchInit(shell | undefined)"
affects: [11-08 doctor (reads the registry), 11-09 smoke and packaging, 11-10 docs]

actuals:
  tokens: 10850
  tasks: 3
  commits: 6
plan_head_before: b08c7618978639108ba32e175926cfbdcfcba528
plan_head_after: 699ecc4e2a20c8bc3cc735a81e25e4624e804832

tech-stack:
  added: []
  patterns:
    - "Per-shell registry (SHELL_SPECS) is the single source of shell facts for init and doctor"
    - "InitDeps injection mirrors DoctorDeps: tests use an in-memory home with a write log plus a mkdtemp home"

key-files:
  created:
    - src/shared/shell-registry.ts
    - tests/shell-registry.test.ts
  modified:
    - src/cli/commands/init.ts
    - src/registry/bootstrap.ts
    - src/cli/commands/init-provider.ts
    - src/cli/main.ts
    - tests/init-command.test.ts
    - tests/registry-bootstrap.test.ts
    - tests/init-provider.test.ts

key-decisions:
  - "bash is registered in bootstrap in the same GREEN commit (329933d) that moves init's rc write to the registry"
  - "InitDeps gains an optional adapterPath(spec) so tests never depend on a Homebrew install on the machine"
  - "The bash version probe drops BASH_ENV and ENV from its env: a non-interactive bash reads BASH_ENV even with --norc"
  - "An unreadable bash version is reported as 'bash not found' (T-11-16)"
  - "The chsh follow-up prints on any platform when $SHELL is an old bash and the PATH bash is >= 5.0; it carries no path"
  - "The macOS hint names the first existing login file (~/.bash_profile, ~/.bash_login or ~/.profile literal), defaulting to ~/.bash_profile"

patterns-established:
  - "Version-gate copy for bash: `bash 5+ needed: brew install bash` (darwin), `bash 5.0 or newer is needed for the ?? trigger` (other), unprefixed as in the phase artifact table"

requirements-completed: [BASH-01]

coverage:
  - id: D1
    description: "Per-shell registry with specs, detection, adapter path, version helpers and login-file check"
    requirement: BASH-01
    verification:
      - kind: unit
        ref: "tests/shell-registry.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "runInit detects the shell, gates bash below 5.0, appends only to ~/.bashrc or ~/.zshrc, is idempotent over source/dot forms, prints the macOS hint, refuses fish and undetectable shells"
    requirement: BASH-01
    verification:
      - kind: unit
        ref: "tests/init-command.test.ts"
        status: pass
      - kind: unit
        ref: "tests/registry-bootstrap.test.ts#registers the bash shell adapter"
        status: pass
    human_judgment: false
  - id: D3
    description: "qq init [shell] wiring from the built CLI and shell-neutral OpenAI copy"
    requirement: BASH-01
    verification:
      - kind: unit
        ref: "tests/init-provider.test.ts#dispatchInit passes bash and a missing shell to initCommand"
        status: pass
      - kind: other
        ref: "node dist/cli/main.js init --help (shows init [shell]); temp-HOME runs for zsh, bash 5.3, /bin/bash 3.2, fish"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-11-14
status: complete
---

# Phase 11 Plan 04: Shell registry and `qq init [shell]` Summary

**`qq init` now detects zsh or bash from `$SHELL` or the passwd shell. It refuses bash older than 5.0, with `bash 5+ needed: brew install bash` on macOS, and appends only to `~/.bashrc` or `~/.zshrc`. Every per-shell fact comes from one `SHELL_SPECS` registry, which doctor will also read (plan 08).**

## Performance

- **Duration:** about 15 min
- **Started:** 2026-11-14T13:06:18Z
- **Completed:** 2026-11-14T13:21:00Z
- **Tasks:** 3 (each RED and GREEN)
- **Files modified:** 9 (2 created, 7 modified)

## Accomplishments

- `src/shared/shell-registry.ts`: one registry for rc file, display literal, adapter, version probe, floors and binding facts. zsh and bash are shipped; fish is listed with `shipped: false`. It also holds `detectShell`, `resolveAdapterPath`, `parseShellVersion`, `versionBelow` and `loginFileSourcesBashrc`.
- `runInit(shellArg, deps)` works through injected deps and covers:
  - the bash 5.0 gate, which probes the `$SHELL` bash first and the PATH bash otherwise;
  - darwin and generic refusal copy, plus a chsh line when a newer bash is installed but is not the login shell;
  - fish and undetectable-shell refusals;
  - idempotence over `source`/`.` lines with double quotes, single quotes or none;
  - a read-only macOS login-shell hint.
- bash is registered in bootstrap in the same commit as the `runInit` rewrite. No commit lets `qq init bash` write to `~/.zshrc`.
- `qq init [shell]` is wired from `main.ts`. `dispatchInit` accepts `undefined`, and the OpenAI missing-key copy names `~/.zshrc or ~/.bashrc`.

## Task Commits

1. **Task 1: per-shell registry**: RED `adbfb53` (test), GREEN `5eeee45` (feat). The GREEN commit lists only `src/shared/shell-registry.ts`.
2. **Task 2: runInit and bash registration**: RED `4411440` (test), GREEN `329933d` (feat). The GREEN commit lists both `src/cli/commands/init.ts` and `src/registry/bootstrap.ts`.
3. **Task 3: `qq init [shell]` and provider copy**: RED `11a44b4` (test), GREEN `699ecc4` (feat).

## TDD Evidence

- **Task 1 RED:** the target is `tests/shell-registry.test.ts > shippedShellNames() > ships zsh and bash only`. It failed with `expected '' to be 'zsh,bash'`, and `check tdd-red-evidence` returned RED_EVIDENCE_OK. Semantic check: this is the planned assertion, run against a stub returning `[]`. No load or syntax fault.
- **Task 2 RED:** the target is `tests/init-command.test.ts > hasShellIntegration > source forms for bash > counts . /p/queque.bash`. It failed with `expected false to be true`, and the check returned RED_EVIDENCE_OK. Semantic check: the old pattern only matched quoted `source`. 33 tests failed on assertions, including the runInit stub cases and the bootstrap bash assertion.
- **Task 3 RED:** the target is `tests/init-provider.test.ts > picker failure paths (nothing written) > OpenAI without a usable key exits 1 with export guidance`. It failed with `expected false to be true`, and the check returned RED_EVIDENCE_OK. Semantic check: the copy still named only `~/.zshrc`.
- **REFACTOR:** none needed.

## Files Created/Modified

- `src/shared/shell-registry.ts`: per-shell specs and helpers. Imports only `../contracts/shell.js` and node built-ins.
- `src/cli/commands/init.ts`: `InitDeps`, `defaultInitDeps`, `runInit`, `initCommand(shell?, deps?)` and the widened `hasShellIntegration`. The old supported-shell constant, Homebrew prefix list and script resolver are removed (moved to the registry).
- `src/registry/bootstrap.ts`: bash shell adapter.
- `src/cli/commands/init-provider.ts`: `InitHandlers.shell` and `dispatchInit` take `string | undefined`. The OpenAI copy now names both rc files.
- `src/cli/main.ts`: `init [shell]` with the shell-neutral description.
- `tests/shell-registry.test.ts` (new), `tests/init-command.test.ts`, `tests/registry-bootstrap.test.ts`, `tests/init-provider.test.ts`.

## Decisions Made

See `key-decisions` in the frontmatter. The main ones:
- Both version-gate lines are printed without a `queque:` prefix, exactly as in the phase artifact table, because plan 09's CI check greps for them.
- `InitDeps.adapterPath` is optional, so callers that build `InitDeps` keep compiling.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] The version probe strips BASH_ENV and ENV**
- **Found during:** Task 2
- **Issue:** `bash --noprofile --norc -c …` still sources `$BASH_ENV` when non-interactive, so the probe could run user code.
- **Fix:** `defaultInitDeps().probeVersion` passes a copy of the env without `BASH_ENV` and `ENV`. stdin is ignored and the timeout is 3000 ms, as planned.
- **Files modified:** src/cli/commands/init.ts
- **Committed in:** 329933d

**2. [Rule 3 - Blocking] Type-only widening in RED commits**
- **Found during:** Tasks 2 and 3
- **Issue:** the RED tests call `hasShellIntegration(…, 'bash')` and `dispatchInit(undefined, …)`, which would fail `tsc --noEmit` in pre-commit.
- **Fix:** the RED commits widened only the parameter types (`ShellName`, `string | undefined`), with no behavior change. The planned RED assertions still failed.
- **Committed in:** 4411440, 11a44b4

**3. [Rule 2 - Test determinism] Optional `InitDeps.adapterPath`**
- **Found during:** Task 2
- **Issue:** the real `resolveAdapterPath` checks `/usr/local/share/queque/`, which exists on this machine, so tests would depend on the host.
- **Fix:** an optional `adapterPath(spec)` dep, defaulting to `resolveAdapterPath`.
- **Committed in:** 4411440 (shape), 329933d (use)

**Total deviations:** 3 auto-fixed (2 missing-critical, 1 blocking). **Impact:** no scope creep. No file outside `files_modified` was touched.

## Issues Encountered

- **Full suite (`QQ_TEST_BASH=/opt/local/bin/bash pnpm test:run`):** 1613 of 1614 tests passed. The one failure was `tests/command-words-fuzz.test.ts > 5k random inputs, second seed`: one input took 283 ms against the fuzz budget while the suite was under load. The file passes alone (36/36). This is out of scope: command-words.ts belongs to plan 03, and this plan does not touch it.
- **Temp-HOME runs of the built CLI:** `.cache/` also appears in the temp home. That is the launcher's existing Node compile cache (`src/cli/launcher.ts`), not init. init wrote only `.zshrc` or `.bashrc`.
- `pnpm typecheck`, `pnpm lint` (164 files) and `pnpm build` all exit 0. `node dist/cli/main.js init --help` shows `init [shell]`.

## User Setup Required

None.

## Next Phase Readiness

- Plan 08 can switch doctor's `ZSH_*` constants and its `versionParts`/`versionBelow` to the registry. It can also use `loginFileSourcesBashrc` and `BASHRC_SOURCE_RE` for the `bash_profile` check.
- Plan 09's smoke and `bash-version-check.sh` can grep the exact refusal copy.

## Wolf entries

For the orchestrator to apply. Nothing under `.wolf/` was committed from this worktree.

**anatomy.md**
- `src/shared/shell-registry.ts`: per-shell registry (Phase 11 D-02/D-08). Holds `SHELL_SPECS` (zsh, bash; fish not shipped), `detectShell`, `resolveAdapterPath`, `parseShellVersion`/`versionBelow`, the bash/zsh floors, `loginFileSourcesBashrc`. ~1.6k tok
- `tests/shell-registry.test.ts`: registry unit tests (specs, detection, versions, login files, adapter path). ~1.8k tok
- `src/cli/commands/init.ts` (update): `qq init [shell]` covering detection, bash 5.0 gate, rc append, macOS hint. Exports `InitDeps`, `defaultInitDeps`, `runInit`, `initCommand`, `hasShellIntegration`. ~2.3k tok
- `tests/init-command.test.ts` (update): runInit tests with an in-memory home and a mkdtemp home, plus `hasShellIntegration` source forms. ~3.3k tok

**cerebrum.md, Key Learnings**
- [2026-11-14] `qq init` takes an optional shell. Per-shell facts live in `src/shared/shell-registry.ts`; doctor still has its own `ZSH_*` copies until plan 08. `runInit(shellArg, deps)` is injectable (`InitDeps`), and tests must never touch the real home.
- [2026-11-14] A non-interactive `bash --norc -c` still sources `$BASH_ENV`. Strip `BASH_ENV` and `ENV` from the env of any bash version probe.
- [2026-11-14] vitest tap-flat names a test by its full `file > describe > test` path. `check tdd-red-evidence` needs that qualified name as `targetTest`, while `-t` filters by the short title. Passing the qualified name to `-t` matches nothing and exits 0 (unexpected_green).
- [2026-11-14] In the Bash tool, `command -v node` prints `node` (nvm shell function). An `env -i` script needs the real path from `whence -p node`.

**buglog.json**
- `tests/command-words-fuzz.test.ts`: "5k random inputs, second seed" failed under full-suite load (`status=2`, slow input 283 ms) and passes alone. Tags: flaky, fuzz, load, timing. Not fixed (plan 03 scope).

## Self-Check: PASSED

- FOUND: src/shared/shell-registry.ts, tests/shell-registry.test.ts, src/cli/commands/init.ts, src/registry/bootstrap.ts
- FOUND commits: adbfb53, 5eeee45, 4411440, 329933d, 11a44b4, 699ecc4 (all subjects carry `(11-04)`)

---
*Phase: 11-multi-shell-trigger-support-bash-and-fish*
*Completed: 2026-11-14*
