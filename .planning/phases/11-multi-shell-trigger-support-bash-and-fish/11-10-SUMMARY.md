---
phase: 11-multi-shell-trigger-support-bash-and-fish
plan: 10
subsystem: docs
tags: [docs, bash, zsh, fish, shell-adapter, invariant-test]

requires:
  - phase: 11-multi-shell-trigger-support-bash-and-fish
    provides: "SHELL_NAMES and request shell fields (01, 02), tools.pending (03, 07), shell registry and qq init (04), SHELL_KINDS (05), instant-frame spec (06), doctor ids and --shell (08)"
provides:
  - "README and INSTALL/USAGE/PROVIDERS are shell-neutral: `qq init` with zsh and bash examples, macOS bash notes, undo steps"
  - "shell/README.md: the adapter contract and new-shell checklist that Phase 12 follows for fish"
  - "tests/shell-names-invariant.test.ts: SHELL_NAMES round-trips through request, registry, telemetry and doctor; shipped = zsh, bash"
affects: [phase-12-fish, docs, onboarding]

actuals:
  tokens: 8600
  tasks: 2
  commits: 3
plan_head_before: 0045aff825ca9c61e8f1317a002fd08f195f8caf
plan_head_after: c19c15d081ace119431f19ca45d9ef8257013f2f

tech-stack:
  added: []
  patterns:
    - "Invariant test per enum promotion: one test asserts every SHELL_NAMES entry appears in each seam that keys on it"

key-files:
  created:
    - shell/README.md
    - tests/shell-names-invariant.test.ts
  modified:
    - README.md
    - docs/INSTALL.md
    - docs/USAGE.md
    - docs/PROVIDERS.md
    - docs/SYSTEM_DESIGN.md
    - docs/EXTENSIONS.md

key-decisions:
  - "INSTALL presents chsh as the user's own optional step and states the shipped behavior exactly: when the login shell is /bin/bash, qq init bash refuses and prints the /etc/shells + chsh steps; when the login shell is zsh and the user starts bash, nothing changes"
  - "The ~/.bash_profile line is described as warn-only (qq init bash and qq doctor --shell bash warn; QueQue never edits login files)"
  - "shell/README.md is written against the shipped bash and zsh adapters (log reasons, file names, constants) rather than the plan text, and leaves fish-specific room: read -t is tokenize, abbr --list goes in functions.txt, prompt padding"

patterns-established:
  - "New-shell checklist lives in shell/README.md; the invariant test is the gate a shell must pass to ship"

requirements-completed: [BASH-01]

coverage:
  - id: D1
    description: "README and user docs say `qq init` with zsh and bash examples, the macOS bash note, and how to undo init; no doc redirects into an rc file"
    requirement: BASH-01
    verification:
      - kind: unit
        ref: "tests/docs-links.test.ts, tests/readme-badges.test.ts"
        status: pass
      - kind: other
        ref: "test $(wc -l < README.md) -le 78 (69 lines); acceptance greps for source ~/.bashrc, brew install bash, no `>>` into rc files, queque shell integration, bash_profile, qq doctor --shell bash"
        status: pass
    human_judgment: true
    rationale: "Whether the install and macOS bash wording reads clearly to a new user is an editorial judgment"
  - id: D2
    description: "shell/README.md documents the adapter contract for Phase 12; SYSTEM_DESIGN and EXTENSIONS describe per-shell adapters and link it"
    requirement: BASH-01
    verification:
      - kind: other
        ref: "grep -cF tools.pending / shellVersion / instant-frame-parity shell/README.md; grep -cF shell/README.md docs/EXTENSIONS.md"
        status: pass
      - kind: unit
        ref: "tests/docs-links.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "SHELL_NAMES invariant: request schema, SHELL_SPECS, SHELL_KINDS and DOCTOR_CHECK_IDS agree; shipped shells are zsh and bash; shipped adapters exist"
    requirement: BASH-01
    verification:
      - kind: unit
        ref: "tests/shell-names-invariant.test.ts (17 tests)"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-11-14
status: complete
---

# Phase 11 Plan 10: Shell-neutral docs, the adapter contract and the SHELL_NAMES invariant Summary

**The install docs now say `qq init` followed by `source ~/.zshrc` or `source ~/.bashrc`. They cover the macOS bash 3.2, login-shell and `~/.bash_profile` notes, and how to undo `qq init`. `shell/README.md` is the adapter contract and new-shell checklist that Phase 12 follows for fish. A 17-case invariant test makes sure every `SHELL_NAMES` entry appears in the request schema, `SHELL_SPECS`, `SHELL_KINDS` and the doctor ids.**

## Performance

- **Duration:** about 6 min
- **Started:** 2026-11-14T13:56:39Z
- **Completed:** 2026-11-14T14:02:36Z
- **Tasks:** 2
- **Files modified:** 8 (2 created, 6 modified)

## Accomplishments

- **README** (69 lines, limit 78): the Homebrew and npm blocks run `qq init`, then `source ~/.zshrc` or `source ~/.bashrc`. One sentence says init detects the shell and appends to the rc file itself. The npm prerequisites now read "zsh or bash 5+". One line tells macOS bash users to run `brew install bash` and links INSTALL. The badges are unchanged.
- **docs/INSTALL.md** has new sections:
  - "Set up your shell": the zsh and bash subsections, the 5.0 floor and Homebrew bash.
  - Login shells: chsh is the user's own optional step, and QueQue never runs it. The `[ -f ~/.bashrc ] && . ~/.bashrc` line is described as something `qq init bash` and `qq doctor --shell bash` warn about, not a required step.
  - "Check your setup": `qq doctor` and `--shell`.
  - "Undo `qq init`": delete the marker line and the `source …queque.zsh|bash` line.
- **USAGE and PROVIDERS**: the wording no longer assumes zsh ("in zsh or bash", "`~/.zshrc` or `~/.bashrc`", `qq init`). The tool-refresh text names zsh `rehash` and bash `compgen`.
- **shell/README.md** (new) sets out what every adapter must do:
  - the contract itself: one file per shell, quiet in non-interactive shells, refuses unsupported versions, calls tools through `command`, inserts without running anything;
  - trigger rules and the private session dir;
  - the request.json field table, including `shell` and `shellVersion`;
  - the result kinds, restoring the line and cursor, and putting the query (not the command) in history;
  - the inline and Zellij paths: a 30 s read timeout, the fish `read -t` caveat, and the setup failures `mkfifo failed`, `fifo open failed` and `zellij run failed`;
  - the tool handoff: the three files, `tools.pending`, the 500 ms budget and the two-flag `closed` cleanup, with fish abbreviations going in `functions.txt`;
  - the instant-frame spec and the `ADAPTERS` parity row, and prompt redraw;
  - a 9-step new-shell checklist covering the registry, bootstrap, doctor probe, telemetry, command-words tables, PTY row, packaging and docs.
- **SYSTEM_DESIGN and EXTENSIONS** now describe the shell layer as one adapter per shell (zsh and bash, fish planned) with shared seams, and both link `shell/README.md`.
- **tests/shell-names-invariant.test.ts** (new): 17 tests that match the plan's `<behavior>` block.

## Task Commits

1. **Task 1: Install docs say `qq init` with zsh and bash examples, the macOS bash note and how to undo it**: `e0b5d11` (docs)
2. **Task 2: Adapter contract and SHELL_NAMES invariant**: `c21823a` (test, invariant), `c19c15d` (docs, contract and design docs)

**Plan metadata:** the SUMMARY commit (docs)

## D-03 check (no edit needed)

| Check | Command | Result |
|---|---|---|
| BASH-01 → Phase 11 | `grep -cF "\| BASH-01 \| Phase 11 \|" .planning/REQUIREMENTS.md` | 1 (line 125) |
| FISH-01 listed for Phase 12 | `grep -nF "FISH-01" .planning/REQUIREMENTS.md` | lines 66 (`(Phase 12)`), 126 (`\| FISH-01 \| Phase 12 \|`), 130 |
| PROJECT.md wording | `grep -cF "fish in Phase 12" .planning/PROJECT.md` | 1 (line 38: "bash follows in Phase 11 and fish in Phase 12") |
| ROADMAP Phase 12 entry | `grep -cF "### Phase 12: fish trigger support" .planning/ROADMAP.md` | 1 (line 432) |

## TDD Evidence (Task 2)

- **RED, which could not fail as planned:** the test guards an invariant over code that plans 01, 04, 05 and 08 already shipped, so it passed on the first run (17/17). tdd.md says a test that passes must be investigated. The investigation: the feature exists, and the test is not vacuous.
- **Mutation proof that the test can fail** (both files restored with `git checkout --`, nothing committed):
  - Dropping `'fish'` from `SHELL_KINDS` failed two tests: `fish is in the telemetry SHELL_KINDS allow list` and `SHELL_KINDS lists exactly SHELL_NAMES, in the same order`.
  - Setting fish to `shipped: true` failed two tests: `the shipped shells are exactly zsh and bash` and `the fish adapter file exists under shell/<name>/`. This is the exact failure Phase 12 has to clear.
- **GREEN:** no production change was needed. **REFACTOR:** none.

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

**1. [TDD - Expected green] The Task 2 RED step could not produce a failing commit**
- **Found during:** Task 2
- **Issue:** `<behavior>` describes an invariant over code that had already shipped, so no RED state existed.
- **Fix:** the test was committed as `test(11-10)` with no `feat` commit. Two mutation runs, recorded above, showed the test fails when an invariant breaks.
- **Files modified:** tests/shell-names-invariant.test.ts
- **Committed in:** c21823a

**Total deviations:** 1 (a TDD process note, with no scope change). **Impact:** none. No file outside `files_modified` was changed: the two mutation edits were reverted, and `git status` was clean before each commit.

## Issues Encountered

- **The INSTALL wording had to match shipped behavior.** The plan says chsh is optional. The shipped `qq init bash` reads the bash in `$SHELL` first. So when the login shell is `/bin/bash` 3.2, init refuses even if a terminal profile starts Homebrew bash, and it prints the `/etc/shells` + `chsh` steps. INSTALL says exactly that: the login-shell switch is needed only when the login shell is `/bin/bash`, and it is always the user's own step. A possible follow-up, not done here: let `qq init bash` accept the PATH bash when `$SHELL` is 3.2 and the user confirms that their terminal starts the newer one.
- `shell/README.md` ships in the npm tarball, because `package.json` `files` includes `shell`. It adds about 9 KB and nothing reads it at runtime. No test checks the tarball's file list.
- `pnpm install --frozen-lockfile --offline` was needed first (fresh worktree).

## Verification

- `QQ_TEST_BASH=/opt/local/bin/bash pnpm test:run` (Zellij vars unset): 66 files, 1849 tests, all passed, exit 0.
- `pnpm lint` (biome, 167 files): clean. `pnpm exec biome check tests/shell-names-invariant.test.ts`: clean.
- Task 1 and Task 2 acceptance greps all pass. No whitelist or blacklist wording in any changed doc. No developer-only variable appears in README or the user docs.

## User Setup Required

None.

## Next Phase Readiness

- Phase 12 (fish) has a written contract (`shell/README.md`) and a test that fails until fish's adapter exists and `shipped` is flipped.

## Wolf entries

For plan 11 or the orchestrator to apply. Nothing under `.wolf/` was committed from this worktree.

**anatomy.md**
- `shell/README.md`: the shell adapter contract for authors (Phase 11 D-01/D-02). Covers trigger rules, session dir, request.json fields (`shell`, `shellVersion`), result kinds, cursor restore, history, the Zellij timeout and setup failures, the tool handoff (`tools.pending`, two-flag `closed` cleanup), instant-frame parity, prompt redraw and the new-shell checklist. ~2.3k tok
- `tests/shell-names-invariant.test.ts`: checks that every `SHELL_NAMES` entry appears in `shellRequestSchema`, `SHELL_SPECS`, `SHELL_KINDS` and `DOCTOR_CHECK_IDS`, that the shipped shells are zsh and bash, and that the shipped adapter files exist. ~0.6k tok
- `docs/INSTALL.md` (update): `qq init` for zsh and bash, the bash 5.0 floor, Homebrew bash, optional chsh, the `~/.bash_profile` line, `qq doctor`, undoing `qq init`. ~0.8k tok
- `README.md` (update): 69 lines; the install block is `qq init` + `source ~/.zshrc`/`~/.bashrc`.

**cerebrum.md, Key Learnings**
- [2026-11-14] A new shell's checklist lives in `shell/README.md`, and `tests/shell-names-invariant.test.ts` is the gate it must pass. Phase 12 flips `SHELL_SPECS.fish.shipped` and adds `'fish'` to that test's shipped list.
- [2026-11-14] `qq init bash` probes the `$SHELL` bash before the PATH bash. On macOS with `/bin/bash` as the login shell, it refuses even when Homebrew bash is installed. Docs must not call chsh optional in that case.
- [2026-11-14] `package.json` `files` ships the whole `shell/` dir, so any doc placed there (`shell/README.md`) goes into the npm tarball.
- [2026-11-14] `tests/docs-links.test.ts` scans only README, CONTRIBUTING and `docs/*.md`. Links in `shell/README.md` are not checked, so verify them by hand.

**cerebrum.md, Do-Not-Repeat**
- [2026-11-14] In a worktree-isolated agent, a `sh script.sh` that runs git is refused as "too complex to verify". Run each git command as its own Bash call.

**buglog.json**
- None. No bug was found or fixed.

## Self-Check: PASSED

- FOUND: shell/README.md, tests/shell-names-invariant.test.ts, README.md, docs/INSTALL.md, docs/USAGE.md, docs/PROVIDERS.md, docs/SYSTEM_DESIGN.md, docs/EXTENSIONS.md
- FOUND commits: e0b5d11, c21823a, c19c15d. Every subject carries `(11-10)`.
