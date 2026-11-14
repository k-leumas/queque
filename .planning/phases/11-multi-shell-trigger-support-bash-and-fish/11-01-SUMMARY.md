---
phase: 11-multi-shell-trigger-support-bash-and-fish
plan: 01
subsystem: shell-integration
tags: [bash, readline, bind-x, zsh, tmux, pty, zod, vitest, ci]

requires:
  - phase: 10
    provides: "zsh widget (shell/zsh/queque.zsh), fixture result mode, CI checks + distro test legs"
provides:
  - "shell/bash/queque.bash: bash 5.0+ readline adapter for the literal ?? trigger (inline path)"
  - "SHELL_NAMES / ShellName / isShellName and shellRequestSchema.shell (default zsh) + shellVersion"
  - "QQ_TEST_RESULT_MODE dev/test fallback for qq client --result-mode"
  - "Shell-parameterized PTY harness: tests/helpers/shells.ts, tests/pty/drive.sh, tests/shell-pty.test.ts"
  - "tests/bash-widget.test.ts b1-b7"
  - "bash + tmux in PR CI, the release test job and all distro legs"
affects: [11-02, 11-03, 11-04, 11-05, 11-06, 11-07, 11-08, 11-09, 11-10, phase-12-fish]

actuals:
  tokens: 11500
  tasks: 3
  commits: 4
plan_head_before: a188de747ee028bc9f2dbc23588a0521adf2af38
plan_head_after: 0379e4b7fbbaf4c77e023137905cbb78da635c8f

tech-stack:
  added: []
  patterns:
    - "bash adapter: interactive guard, then version guard, then bash 5-only code; local - + set +euE +o pipefail in the bind -x function; every external through `command`"
    - "every restore path sets READLINE_POINT back to QQ_ORIG_POINT (saved on the second ?)"
    - "PTY harness: private tmux server (-L, -f /dev/null) started via env -u ZELLIJ* -u TMUX, real tsup bundle in a temp QQ_DEV_ROOT, fixture mode via QQ_TEST_RESULT_MODE"
    - "test prerequisites: skip locally with one warning, throw when CI is set (ciRequired)"
    - "PTY sync by polling the screen or the debug log; diagnostics in thrown errors kept single-line and quote-free (vitest TAP)"

key-files:
  created:
    - shell/bash/queque.bash
    - tests/helpers/shells.ts
    - tests/pty/drive.sh
    - tests/shell-pty.test.ts
    - tests/bash-widget.test.ts
    - .planning/phases/11-multi-shell-trigger-support-bash-and-fish/.red/11-01-red.json
  modified:
    - src/contracts/shell.ts
    - src/cli/commands/client.ts
    - src/client/run-foreground.ts
    - tests/intent-router.test.ts
    - tests/context-pipeline.test.ts
    - .github/workflows/ci.yml
    - .github/workflows/release.yaml
    - scripts/ci/install-distro-deps.sh
    - CONTRIBUTING.md

key-decisions:
  - "Fixture and cancel debug lines in run-foreground are awaited: main.ts exits right after the command returns and dropped the un-awaited appends, so the harness could not observe completion"
  - "findShell probes /opt/local/bin (MacPorts) next to the Homebrew dirs; QQ_TEST_BASH / QQ_TEST_ZSH are authoritative when set"
  - "bash-only PTY rows (prompt-multiline, errexit) are not registered for zsh at all, so the zsh leg reports no skipped rows"
  - "bash -i -c helper tests filter bash's own job-control notices (no job control / cannot set terminal process group) before asserting stderr"
  - "Failure messages (qq not found, cannot create a temp dir) go to stderr; the replace-buffer summary and the error-result message go to stdout like zsh print"

patterns-established:
  - "describe.each(PTY_SHELLS) with describe.skipIf(!runnable(row)): plan 07 adds handoff-quiet and hostile-env rows here"
  - "tests/bash-widget.test.ts ids b1-b7; plans 06/07 continue at b8"

requirements-completed: [BASH-01]

coverage:
  - id: D1
    description: "bash 5 `??` round trip: echo qqtrace?? goes through the real built client in fixture mode, comes back into the line and runs only on Enter; identical zsh leg"
    requirement: BASH-01
    verification:
      - kind: e2e
        ref: "tests/shell-pty.test.ts#round-trip: echo qqtrace?? comes back into the line"
        status: pass
    human_judgment: false
  - id: D2
    description: "Edge parity in a real PTY for zsh and bash: cancel (end of line and mid-line cursor restore), empty line (fixture and cancel), multibyte mid-line, vi-insert, bracketed paste; bash-only multi-line PS1 head and user set -e; no job-control notice"
    requirement: BASH-01
    verification:
      - kind: e2e
        ref: "CI=true pnpm exec vitest run tests/shell-pty.test.ts (18 passed, 0 skipped)"
        status: pass
    human_judgment: false
  - id: D3
    description: "bash adapter helpers: non-interactive silence (3.2 and 5.3), <5.0 refusal with one line, replace-buffer + history, every restore path with READLINE_POINT, insertion only, set -e survives, qq missing"
    requirement: BASH-01
    verification:
      - kind: unit
        ref: "tests/bash-widget.test.ts (13 passed: b1-b7)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Request contract: SHELL_NAMES enum, shell defaults to zsh for old widgets, shellVersion max 40"
    requirement: BASH-01
    verification:
      - kind: unit
        ref: "pnpm typecheck + tests/shell-contract.test.ts, tests/intent-router.test.ts, tests/context-pipeline.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "CI installs bash 5 and tmux everywhere vitest runs (checks, release test job, six distro legs)"
    verification:
      - kind: other
        ref: "actionlint .github/workflows/ci.yml .github/workflows/release.yaml; shellcheck -s sh scripts/ci/install-distro-deps.sh"
        status: pass
    human_judgment: true
    rationale: "The distro legs only prove the new packages install and the harness runs once CI executes them on a pushed branch (Docker is down locally)"
  - id: D6
    description: "Live (non-fixture) bash ?? feel: Ink picker over readline, real pick and Esc in a user's terminal"
    verification: []
    human_judgment: true
    rationale: "Fixture mode never opens the Ink UI; raw-mode handover between readline and Ink in a real terminal needs a human (spike 005 validated it once)"

duration: 22min
completed: 2026-11-14
status: complete
---

# Phase 11 Plan 01: bash `??` tracer and PTY harness Summary

**bash 5 readline adapter (`bind -x` on `?`) that round-trips `??` through the unchanged `qq client`, proven alongside zsh in a private tmux PTY harness, with the edge cases pinned and the harness wired into every CI vitest job**

## Performance

- **Duration:** 22 min
- **Started:** 2026-11-14T12:37:29Z
- **Completed:** 2026-11-14T12:59:41Z
- **Tasks:** 3 (Task 1 tracer, Task 2 TDD, Task 3 CI)
- **Files modified:** 15 (6 created, 9 modified)

## Accomplishments

- `shell/bash/queque.bash`: interactive guard first, then the `needs bash 5.0+` refusal, `shopt -s interactive_comments`, `_qq_log` (`[bash]` tag), `_qq_cleanup`, `_qq_reprint_prompt_head` (`${PS1@P}`, `\001`/`\002` markers stripped), `_qq_restore_line`, `_qq_apply_result_str`, `_qq_apply_result`, `_qq_question`, and bindings in emacs and vi-insert only. request.json is built with `jq -n --arg` and carries `shell:"bash"` and `shellVersion`.
- The request contract now names the shell (`SHELL_NAMES`, `shell` defaulting to `'zsh'`, `shellVersion`), and `qq client` reads `QQ_TEST_RESULT_MODE` when `--result-mode` is absent.
- The PTY harness builds the real bundle once and drives zsh 5.9 and bash 5.3 through 18 scenarios with no model call and no skips. The helper tests cover b1-b7, including the old-bash refusal on macOS `/bin/bash` 3.2.
- PR CI, the release test job and all six distro legs install bash and tmux. CONTRIBUTING documents the harness variables.

## Task Commits

1. **Task 1 (tracer): end-to-end bash `??` round trip in a private tmux PTY.** `be9b46d` (feat)
2. **Task 2 (TDD): edge cases.** RED `fde1420` (test), GREEN `86536d7` (feat)
3. **Task 3: CI installs bash and tmux, CONTRIBUTING notes.** `0379e4b` (ci)

**Plan metadata:** recorded in the SUMMARY commit (docs)

## Files Created/Modified

- `shell/bash/queque.bash`: the bash readline adapter (inline path)
- `src/contracts/shell.ts`: `SHELL_NAMES`, `ShellName`, `isShellName`, the `shell` / `shellVersion` fields, shell-neutral comments
- `src/cli/commands/client.ts`: the `QQ_TEST_RESULT_MODE` fallback
- `src/client/run-foreground.ts`: the fixture and cancel debug lines are awaited
- `tests/helpers/shells.ts`: `findShell`, `findBinary`, `ciRequired`, `shellVersionOf`
- `tests/pty/drive.sh`: the `start|type|key|paste|wait|capture|stop` tmux driver (bash 3.2-compatible)
- `tests/shell-pty.test.ts`: the zsh and bash PTY scenarios
- `tests/bash-widget.test.ts`: b1-b7
- `tests/intent-router.test.ts`, `tests/context-pipeline.test.ts`: `shell: 'zsh'` in the two hand-built `NormalizedRequest` literals
- `.github/workflows/ci.yml`, `.github/workflows/release.yaml`: `zsh jq bash tmux`
- `scripts/ci/install-distro-deps.sh`: tmux for every family, bash on alpine, `--help` range 2-18
- `CONTRIBUTING.md`: the "Shell Adapter Tests (PTY Harness)" section
- `.planning/.../.red/11-01-red.json`: the RED evidence record

## Output Notes Requested by the Plan

- **Versions used:** bash 5.3.20 (MacPorts, `/opt/local/bin/bash`), `/bin/bash` 3.2.57 for b1/b2, zsh 5.9 (`/bin/zsh`), tmux 3.6a, jq at `/usr/local/bin/jq`, node 24.14.1.
- **PTY run time per shell:** the zsh leg takes about 6.2 s for 8 rows and the bash leg about 5.5 s for 10 rows. The whole file takes about 12.9 s including the bundle build (under 1 s with a warm esbuild). There are no timing assertions.
- **bash 5.x behaviour that differed from spike 005:** the core trigger behaved like the spike. Differences found:
  - The spike's restore put the cursor at `${#QQ_ORIG_LBUFFER}`. The adapter uses the saved `QQ_ORIG_POINT`, and the mid-line `keepmeX tail` scenario confirms it.
  - `bash -i -c` prints its own job-control notices on stderr when there is no terminal. The helper tests filter those.
  - `bind` gives no warning under `bash -i -c` and does not trip a user's `set -e` at source time.
  - Bracketed paste is on by default in 5.3, so the `paste` row stays quiet.
- **`NormalizedRequest` / `ShellRequest` literal grep:** a re-grep before the Task 1 commit found only the two planned literals, `tests/intent-router.test.ts` `makeRequest` and `tests/context-pipeline.test.ts` `buildRequest`. Both got `shell: 'zsh'`. `run-foreground.ts:288` spreads a parsed request and needed no change.
- **`paste` row:** it ran on both shells here (zsh 5.9 and bash 5.3 are both 5.1 or newer). It was not skipped.
- **`.wolf/` entries:** none were committed from the worktree, per the orchestrator. The entries to apply are listed under "Wolf entries" below.

## TDD Gate Compliance (Task 2)

- **RED** `fde1420`: the target was `tests/shell-pty.test.ts > 'bash' ?? in a PTY > bash (/opt/local/bin/bash) > empty cancel: ?? on an empty line leaves exactly the prompt`, run with `CI=true pnpm --silent exec vitest run tests/shell-pty.test.ts -t "bash.*empty cancel" --reporter=tap-flat` (exit 1). `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK` (`target_test_failed`).
  - **Semantic assessment:** the target executed and failed on its planned completion assertion: it timed out waiting for the client's `wrote cancel result` line. The reason was the intended one: the client never wrote that line before exiting. All 6 cancel rows (3 per shell) failed for this reason.
  - The other 25 new cases passed in RED, because Task 1 had already implemented the full adapter the plan specified (restore paths, prompt head, `local -`, guards). They are kept as regression pins, and the passes are recorded here rather than hidden.
  - The first two classifier attempts returned `invalid_record`, because multi-line and nested-quote error messages make vitest's TAP malformed. The wait helpers now throw single-line, quote-free messages (`oneLine`).
- **GREEN** `86536d7`: the cancel debug line in `run-foreground.ts` is now awaited. All 18 PTY rows and 13 helper cases pass.
- **REFACTOR:** none needed.

## Decisions Made

See `key-decisions` in the frontmatter. The most consequential one is that debug lines the harness synchronizes on (fixture and cancel) are awaited in the client, instead of the harness polling on timing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The client dropped its fixture-mode debug line on exit**
- **Found during:** Task 1 (tracer verify)
- **Issue:** `void appendDebugLog('client', 'wrote replace-buffer result')` was never written, because `main.ts` calls `process.exit` right after `clientCommand` resolves. The planned assertion that the debug log contains `wrote replace-buffer result` failed on both shells, even though the round trip itself worked.
- **Fix:** await that one append in the fixture branch.
- **Files modified:** `src/client/run-foreground.ts` (not in files_modified)
- **Verification:** `tests/shell-pty.test.ts` round-trip passes on both shells; `tests/client-result.test.ts` still passes.
- **Committed in:** `be9b46d`

**2. [Rule 1 - Bug] The same dropped-log bug on the cancel path (this was the Task 2 RED)**
- **Found during:** Task 2
- **Issue:** `wrote cancel result` was never logged, so the PTY cancel scenarios could not observe that the client had finished.
- **Fix:** await the append (GREEN).
- **Files modified:** `src/client/run-foreground.ts`
- **Committed in:** `86536d7`

**3. [Orchestrator environment note] bash 5 comes from MacPorts, not Homebrew**
- **Found during:** precondition check, Task 1
- **Issue:** the plan's precondition and user_setup name `brew install bash` at `/usr/local/bin` or `/opt/homebrew/bin`. This machine has bash 5.3 at `/opt/local/bin/bash` (MacPorts).
- **Fix:** I treated the precondition as met, as the orchestrator instructed, and installed nothing. `findShell` also probes `/opt/local/bin` (FALLBACK_DIRS), and CONTRIBUTING mentions `sudo port install bash` next to `brew install bash`.
- **Files modified:** `tests/helpers/shells.ts`, `CONTRIBUTING.md`
- **Committed in:** `be9b46d`, `0379e4b`

**4. [Rule 3 - Blocking] Lint and tooling adjustments**
- **shellcheck SC2317:** shellcheck flags the `|| exit 0` after the refusal's `return 0` as unreachable. I added a targeted disable with a reason, because that branch is reached when the file is run instead of sourced.
- **biome:** biome's `noTemplateCurlyInString` rejected the `${BASH_VERSINFO[0]}.${BASH_VERSINFO[1]}` probe string. The probe now echoes `$BASH_VERSION` and parses major.minor, which gives the same result.
- **scripts/ci/install-distro-deps.sh:** the header grew by one line, so the `--help` range moved from `2,17p` to `2,18p`.
- **Committed in:** `be9b46d`, `0379e4b`

**5. [Rule 2 - Missing critical] Robustness the plan did not spell out**
- `_qq_reprint_prompt_head` strips the readline `\001`/`\002` markers before printing.
- If request.json cannot be written (for example, `jq` is missing), the adapter cleans up the session dir and keeps the restored line instead of starting the client on an empty request.
- `_qq_apply_result` restores the line and returns 1 when the result file is missing or unreadable. A b4 case covers it.
- **Committed in:** `be9b46d`, `fde1420`

**Minor:** `shellVersionOf` was exported in Task 1 already (the plan places the export in Task 2), because `findShell` shares it.

---

**Total deviations:** 5 recorded: 2 Rule 1 bugs (the same root cause on two paths), 1 environment note from the orchestrator, 1 group of Rule 3 tooling fixes, 1 group of Rule 2 hardening.
**Impact on plan:** all of these were needed for the planned assertions to be meaningful or for lint to pass. The `run-foreground.ts` change touches a file outside files_modified, but it is one awaited log call per branch and changes no behaviour.

## Issues Encountered

- **Daemon churn:** each PTY run replaces the developer's running daemon, because the build id differs. This was accepted as Pitfall 9, and the next real `??` replaces it back.
- **Worktree path guards:** this worktree's guards refused to write the GSD plan-ledger and sentinel files under the shared `.git/worktrees/<id>/` directory. The commit count above was measured directly against base `a188de7`.

## User Setup Required

None on this machine: bash 5.3 is already installed via MacPorts. Contributors on macOS without a bash 5 need `brew install bash` or `sudo port install bash` (see CONTRIBUTING). I did not generate a separate `11-USER-SETUP.md`.

## Wolf entries (for the orchestrator to apply in the main checkout)

- **anatomy.md, new files:**
  - `shell/bash/queque.bash`: the bash 5.0+ readline adapter. `bind -x` on `?` in emacs and vi-insert; the interactive guard, then the `needs bash 5.0+` refusal; request.json via `jq --arg` with `shell:"bash"`; inline `qq client` run; result applied to READLINE_LINE/READLINE_POINT with QQ_ORIG_POINT restore. ~2.5k tokens.
  - `tests/helpers/shells.ts`: `findShell(name, {min})` (QQ_TEST_BASH/QQ_TEST_ZSH, PATH, Homebrew, MacPorts, system), `findBinary`, `ciRequired` (warns locally, throws under CI), `shellVersionOf`. ~0.9k tokens.
  - `tests/pty/drive.sh`: a private tmux driver for the PTY harness (`start|type|key|paste|wait|capture|stop SERVER`). Bash 3.2-safe; strips ZELLIJ*/TMUX. ~0.8k tokens.
  - `tests/shell-pty.test.ts`: zsh + bash PTY scenarios (round-trip, cancel, cancel mid-line, empty, empty cancel, multibyte, vi-insert, paste; bash-only prompt-multiline and errexit). Builds the real bundle into a temp QQ_DEV_ROOT and uses QQ_TEST_RESULT_MODE fixture mode. ~3.3k tokens.
  - `tests/bash-widget.test.ts`: bash adapter helper tests b1-b7 via `bash -i -c` (filters bash's job-control notices). ~2.4k tokens.
- **cerebrum Key Learnings:**
  - `bash -i -c` with no terminal prints `bash: cannot set terminal process group` and `bash: no job control in this shell` on stderr. Filter these before asserting on the adapter's stderr.
  - bash `bind -x` clears the current line (`\r` + `ce`) before it runs the function and repaints only the last prompt line afterwards. That is why the multi-line PS1 head must be reprinted.
  - `qq client` exits through `process.exit` right after the command returns, so an un-awaited `appendDebugLog` there is lost. Await any line a test synchronizes on.
  - vitest TAP (`tap-flat`) breaks on error messages that contain newlines or escaped double quotes (the YAML block is not escaped). Keep thrown test diagnostics single-line and quote-free for gsd `tdd-red-evidence`.
  - This machine's bash 5 is MacPorts at `/opt/local/bin/bash`. The Bash tool's PATH lacks `/opt/local/bin`; `findShell` probes it.
- **cerebrum Do-Not-Repeat (2026-11-14):**
  - Do not register shell-specific vitest rows with `it.skipIf(row.name !== 'bash')` inside a shared `describe.each`. That reports skipped rows on the other shell and violates "no skips under CI". Wrap them in `if (row.name === 'bash') { … }`.
  - Keep `it('name', () => {` titles short (under the 100-column biome width) and pass the timeout through describe options. A trailing timeout argument makes biome put the title on its own line, which breaks `grep "it\('…"` acceptance criteria.
- **buglog:** bug-NNN.
  - error_message: "PTY round-trip passed but the debug log lacked 'wrote replace-buffer result' / 'wrote cancel result'"
  - file: `src/client/run-foreground.ts`
  - root_cause: fire-and-forget `void appendDebugLog` in the fixture and cancel branches, followed by `process.exit` in `main.ts`
  - fix: await both appends
  - tags: [debug-log, process-exit, pty, vitest]
- **memory.md:** `| 12:59 | executed 11-01: bash adapter, PTY harness (zsh+bash 18 rows), b1-b7, CI bash+tmux | shell/bash/queque.bash, tests/shell-pty.test.ts, tests/bash-widget.test.ts, ci | 4 commits, all green | ~90k |`

## Next Phase Readiness

- Plans 02-10 can consume `SHELL_NAMES`, `shell` and `shellVersion`, and the zsh heredoc can gain `"shell": "zsh"` in plan 02.
- Plans 06 and 07 add to `shell/bash/queque.bash` (instant frame, tool handoff, Zellij path, prewarm, two-flag cleanup), add rows to `tests/shell-pty.test.ts` (handoff-quiet, hostile-env) and continue the helper ids at b8.
- **Open risk:** the distro legs (alpine bash and tmux, `C.UTF-8` multibyte on musl, BusyBox `sleep 0.05` and `env -u`) are first exercised when CI runs on push. Docker is down locally.

## Self-Check: PASSED

- All 6 created files exist on disk.
- All 4 task commits (`be9b46d`, `fde1420`, `86536d7`, `0379e4b`) are on `worktree-agent-a3f8055ae191c3229`.
- Every acceptance criterion for Tasks 1-3 was re-run and passes.
- Plan-level verification:
  - `CI=true pnpm exec vitest run tests/shell-pty.test.ts tests/bash-widget.test.ts`: 31 passed, 0 skipped.
  - `pnpm test:run`: 63 files, 1541 tests passed.
  - `pnpm typecheck` and `pnpm lint` exit 0.
  - shellcheck (adapter, driver, distro deps) and actionlint (ci.yml, release.yaml) are clean.

---
*Phase: 11-multi-shell-trigger-support-bash-and-fish*
*Completed: 2026-11-14*
