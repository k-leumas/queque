---
phase: 10-linux-distro-ci-harness-and-anonymous-telemetry
plan: 11
subsystem: telemetry
tags: [telemetry, consent, tty, smoke, expect, zsh, openwolf, phase-gate]
requires:
  - phase: 10-04
    provides: telemetry-config (TelemetryState, telemetryBlockedBy, readTelemetryState, markTelemetryAsked, TelemetryConfigWriteError)
  - phase: 10-10
    provides: run-foreground llm-branch finally with reportClientTelemetry (the insertion point), QueryOutcome records
  - phase: 10-01
    provides: smoke-distro.sh / smoke-distro-runner.sh / smoke-distro.exp with the default and c-locale passes
provides:
  - "src/client/telemetry-consent.ts: CONSENT_PROMPT, CONSENT_TIMEOUT_MS = 30_000, shouldAskTelemetryConsent(input), askTelemetryConsent(io, timeoutMs?), ConsentInput/ConsentOutput/ConsentIo"
  - "run-foreground.ts asks once after the first accepted ?? (after the result write and Ink unmount, before the report)"
  - "smoke `consent` pass (expect exits 17 no question, 18 asked twice) and runner exit 36 (answer not saved)"
  - "phase 10 OpenWolf records (buglog bug-453..460, anatomy, cerebrum, memory) and the closed 09.1 stale-prewarm todo"
affects: [10-12 repo settings, 10-13 real key bake and consent carry-over confirmation]
actuals:
  tokens: 40600
  tasks: 3
  commits: 5
plan_head_before: 036cfe04eebf374487e41ee5b7f759a9ba1cb59e
plan_head_after: 67f290f1c9e7714235a49e3718ff3fd71fe7adb5
tech-stack:
  added: []
  patterns:
    - "One-key tty prompt: setRawMode(true), once('data'), first character of the first chunk, settle once, then raw off, pause, off(listener), clearTimeout, erase every wrapped row"
    - "Consent gate composed from pure inputs (outcome, state, blockedBy, hasTty) so the caller owns the IO"
    - "importOriginal-spread mocks keep the real gates (shouldAskTelemetryConsent, telemetryBlockedBy) and fake only the prompt and the config IO"
key-files:
  created:
    - src/client/telemetry-consent.ts
    - tests/telemetry-consent.test.ts
  modified:
    - src/client/run-foreground.ts
    - tests/client-result.test.ts
    - scripts/smoke-distro.exp
    - scripts/smoke-distro-runner.sh
    - scripts/smoke-distro.sh
    - .wolf/anatomy.md
    - .wolf/buglog.json
    - .wolf/cerebrum.md
    - .wolf/memory.md
    - .planning/todos/done/2026-10-13-09.1-stale-prewarm-after-sleep.md (moved from pending/)
key-decisions:
  - "The prompt erases every row it wrapped onto (columns from the tty write stream): the 85-character question wraps in an 80-column terminal or Zellij pane, and `\\r\\x1b[2K` alone would leave the first row behind"
  - "A terminal that refuses raw mode is a silent no: no question is written"
  - "The consent block runs only when outcome is accepted and both tty streams exist; askTelemetryConsent never rejects, so only markTelemetryAsked sits in the try/catch (logs `consent not saved` with the error name, never the message, which carries the config path)"
  - "The consent debug lines are awaited: main.ts calls process.exit right after the client action, so a void append was lost (bug-460)"
  - "The default and c-locale smoke passes keep QQ_TELEMETRY=0 because their error pattern `(queque|QueQue): ` would match the question; only the consent pass waits for `[y/N]` without it"
  - "buglog ids continue from the pre-drop max (452), so no new entry reuses a dropped auto-detected id"
  - "anatomy: the 161 hook-written `.claude/worktrees/...` sections were dropped (ephemeral paths); phase 10 lines now sit under the real directories"
patterns-established:
  - "Tests that read the real env gates clear CI/DO_NOT_TRACK/QQ_TELEMETRY with vi.stubEnv first, so a CI run (CI=true) takes the same paths as a local one"
requirements-completed: [P10-TEL, P10-SMOKE, P10-FIX, P10-PREWARM]
coverage:
  - id: D1
    description: "Consent gate truth table and one-key prompt: y/Y yes; n, Enter, Esc, Ctrl-C, other keys and 30 s silence no; first character only; settles once; raw mode off, paused, no listener, line erased"
    requirement: P10-TEL
    verification:
      - kind: unit
        ref: "tests/telemetry-consent.test.ts#shouldAskTelemetryConsent"
        status: pass
      - kind: unit
        ref: "tests/telemetry-consent.test.ts#askTelemetryConsent"
        status: pass
    human_judgment: false
  - id: D2
    description: "Asked once after the first accepted ?? on the Ink tty streams, after the result write and Ink unmount, answer saved before the report; never after Esc/error, when asked, under DO_NOT_TRACK/CI/QQ_TELEMETRY=0, or in the cancel/fixture modes; a config write failure is swallowed"
    requirement: P10-TEL
    verification:
      - kind: unit
        ref: "tests/client-result.test.ts#runForegroundClient: telemetry consent (D-09)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Real zsh PTY: the question shows once, `n` leaves the accepted command intact (it executes), a second accept is not asked, config.json holds asked true / enabled false / no installId; the default and c-locale passes never show it"
    requirement: P10-SMOKE
    verification:
      - kind: e2e
        ref: "pnpm smoke:distro alpine:3.24 (passes default, c-locale, consent; runner jq check)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Phase gate on the phase head: full suite, typecheck, lint, build and the alpine smoke"
    requirement: P10-FIX
    verification:
      - kind: command
        ref: "pnpm test:run && pnpm typecheck && pnpm lint && pnpm build; pnpm smoke:distro alpine:3.24"
        status: pass
    human_judgment: false
  - id: D5
    description: "OpenWolf records: the three Linux defects in buglog, phase 10 anatomy lines, cerebrum learnings and decisions; folded 09.1 stale-prewarm todo (D-04) closed"
    requirement: P10-PREWARM
    verification:
      - kind: command
        ref: "node buglog busybox/jq/mktemp check; grep telemetry-buffer.ts/smoke-distro.sh/auto-revert.sh .wolf/anatomy.md; test ! -e the pending todo"
        status: pass
    human_judgment: false
  - id: D6
    description: "The consent question copy, default No and the 30 s timeout feel right in a real interactive terminal and in a Zellij pane"
    requirement: P10-TEL
    human_judgment: true
    rationale: "UX adequacy; the PTY smoke proves behaviour, not feel. The user confirms the carry-over (asked even while the key is empty) at plan 13 Task 1"
duration: 23min
completed: 2026-10-29
status: complete
---

# Phase 10 Plan 11: Telemetry Consent Ask and Phase Gate Summary

**QueQue now asks one default-No question on /dev/tty after the first accepted `??`: `QueQue: send anonymous usage and error counts (no commands, prompts or paths)? [y/N] `. It reads one key and saves the answer once, and the accepted command still lands in the buffer. A third smoke pass in a real zsh PTY proves this. The phase gate is green, and the OpenWolf records that the parallel plans deferred are applied once.**

## Performance

- **Duration:** about 23 min (start 21:14 UTC, last commit 21:35 UTC, then this SUMMARY)
- **Tasks:** 3 of 3
- **Files:** 2 created, 10 modified (one moved)
- **Step timings (wall clock, machine under load):**
  - Task 1 (RED, GREEN): about 4 min
  - Task 2 (RED, GREEN, first alpine smoke): about 9 min. The smoke itself took about 2 min, including build and pack.
  - Task 3 gate: `pnpm test:run` about 2 min, typecheck about 10 s, lint under 1 s, build about 5 s, alpine smoke about 2 min. The records took about 8 min.

## Accomplishments

- **`src/client/telemetry-consent.ts`**
  - `shouldAskTelemetryConsent` is true only for an `accepted` outcome, `asked: false`, no env gate and a tty.
  - `askTelemetryConsent` writes the prompt to the given tty stream, never to stdout. It enters raw mode and settles on the first character of the first chunk. Only `y`/`Y` means yes. Any other key, or 30 s of silence, means no.
  - After settling it always turns raw mode off, pauses the input, removes the listener and clears the timer. It then erases the prompt with `\r\x1b[2K`, plus `\x1b[1A\x1b[2K` for each row the prompt wrapped onto.
- **`run-foreground.ts`:** the consent block sits immediately before `reportClientTelemetry` in the llm-branch `finally`. By then the result is written, Ink has unmounted and the inline reserve is cleared, and the tty handle is still open.
  - It reuses the Ink tty streams and calls `markTelemetryAsked(answer)`, which creates the install id only on yes (D-06).
  - A write failure is logged as `consent not saved` with the error name only, and swallowed. The report still runs.
  - The cancel and fixture modes are unchanged.
- **Smoke:**
  - The runner's `.zshrc` line is now `[ -n "${QQ_SMOKE_CONSENT:-}" ] || export QQ_TELEMETRY=0`, written single-quoted so zsh evaluates it.
  - The new `consent` pass accepts and waits for `[y/N]` (exit 17 if it never shows), then answers `n`. It waits for the `QQSMOKE% tldr z3  # ` redraw and checks that `command not found: tldr` executes. A second accept must reach the redraw without the question (exit 18 if asked again).
  - The runner then checks config.json with jq, as user qq (exit 36 on failure).
  - The host script's failure output now also tails `pty-consent.log`.
- **Phase gate:** green on the phase head (details below).
- **OpenWolf:**
  - buglog: added bug-453 to bug-460 and dropped 35 phase-10 hook entries.
  - anatomy: every new phase 10 file now has a line under its real directory, and the 161 ephemeral worktree sections are gone.
  - cerebrum: Key Learnings, Do-Not-Repeat and Decision Log entries, and the esbuild define list now includes `__QUEQUE_TELEMETRY_KEY__` and `__QUEQUE_TELEMETRY_HOST__`.
  - memory: session lines appended.
- **Todo:** the folded 09.1 stale-prewarm todo is closed (moved to `.planning/todos/done/` with a resolution line).

## Task Commits

1. **Task 1: consent gate and one-key prompt.** RED `0fa5e03` (test), GREEN `dde2ec4` (feat)
2. **Task 2: ask once after the first accept, PTY proof.** RED `fdde4e6` (test), GREEN `d2c5adf` (feat)
3. **Task 3: phase gate and OpenWolf records.** `67f290f` (chore)

## TDD Gate Compliance

- **Task 1 RED** (`0fa5e03`): the tests plus a throw-on-call stub that carries the public names, so pre-commit `tsc` passes.
  - Command: `NO_COLOR=1 pnpm exec vitest run tests/telemetry-consent.test.ts -t "a chunk y means yes" --reporter=tap-flat`, exit 1.
  - Target `tests/telemetry-consent.test.ts > askTelemetryConsent > a chunk y means yes` failed and the other 22 were skipped. The full file had 23/23 failing.
  - Classifier: `RED_EVIDENCE_OK` (`target_test_failed`). The shell profile's `compdef:153` line was stripped from the captured report.
  - Semantic assessment: the target ran and failed because `askTelemetryConsent` was not implemented (the stub threw). That is the missing feature, not a load or syntax fault.
- **Task 1 GREEN** (`dde2ec4`): 23/23 pass.
- **Task 2 RED** (`fdde4e6`):
  - Command: `NO_COLOR=1 pnpm exec vitest run tests/client-result.test.ts -t "asks once on the tty streams" --reporter=tap-flat`, exit 1.
  - The target failed with the single-line assertion `expected "vi.fn()" to be called 1 times, but got 0 times`.
  - Classifier: `RED_EVIDENCE_OK` (`target_test_failed`).
  - Semantic assessment: run-foreground had no consent call yet, which is the planned assertion. In the full file, 3 cases failed on their planned assertions (ask, yes saved, write failure). The 8 never-ask cases passed in RED as intended: they are characterization guards.
- **Task 2 GREEN** (`d2c5adf`): 92/92 across client-result, telemetry-consent and telemetry-events. The alpine smoke passed all three passes.
- No REFACTOR commit was needed.

## Phase Gate Results

| Check | Result |
|---|---|
| `pnpm test:run` | 58 files, 1458 tests passed (no flake this run) |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | `biome check .` checked 155 files, no fixes (works inside the worktree since 18de580) |
| `pnpm build` | success; `dist/cli/app.js` has `send anonymous usage` once, and its only `phc_` text is the schema prefix (no key baked, D-22) |
| `pnpm smoke:distro alpine:3.24` | `smoke-distro: PASS alpine:3.24` on both runs, with no "Docker is not available" warning. `pty-consent.log` shows `[y/N]` once (0 in the default and c-locale logs) followed by `\r\x1b[2K`. qq-debug.log has `consent saved {"enabled":false}` |
| buglog / anatomy checks | busybox, jq and mktemp are present; the grep for `telemetry-buffer.ts` returns 1 |
| `git log -- pnpm-lock.yaml` | no Phase 10 commit |

Acceptance greps:
- Task 1:
  - `[y/N]` 1
  - `CONSENT_TIMEOUT_MS = 30_000` 1
  - `process.stdout` 0
- Task 2:
  - `askTelemetryConsent(` 1
  - `markTelemetryAsked(` 1
  - `exit 17` 1
  - `exit 18` 1
  - `exit 36` 1
  - `QQ_SMOKE_CONSENT` in the runner 2
  - `shellcheck -s sh` exit 0
- Task 3:
  - `__QUEQUE_TELEMETRY_KEY__` in cerebrum 1
  - the pending todo is gone
  - `smoke-distro.sh` 2 and `auto-revert.sh` 2 in anatomy

## Decisions Made

See `key-decisions` in the frontmatter. The plan's own discretion choices stand: the prompt copy, a 30 s timeout that counts as no, and asking even while the baked key is empty. The user confirms that carry-over at plan 13 Task 1.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Consent debug lines were lost on exit**
- **Found during:** Task 2, first alpine smoke
- **Issue:** config.json held the `n`, but qq-debug.log had no `consent saved` line. `void appendDebugLog(...)` raced the `process.exit` that main.ts runs right after the client action.
- **Fix:** both consent log calls are now awaited. appendDebugLog never throws, so the shell result is unaffected. The gate smoke shows `consent saved {"enabled":false}`.
- **Files modified:** src/client/run-foreground.ts
- **Commit:** `d2c5adf`. Logged as bug-460.

**2. [Rule 2 - Missing critical] The erase covers a wrapped prompt**
- **Found during:** Task 1
- **Issue:** the question is 85 characters, so it wraps in an 80-column terminal or in the 80-column Zellij pane minus its frame. `\r\x1b[2K` alone erases only the last row, so the first row would stay on screen above the shell redraw (T-10-42).
- **Fix:** the output's `columns` decides how many rows to erase. The required `\r\x1b[2K` is still written first. Covered by the narrow-terminal test.
- **Files modified:** src/client/telemetry-consent.ts
- **Commit:** `dde2ec4`

**3. [Rule 2 - Missing critical] The default passes are protected against the consent text**
- **Found during:** Task 2
- **Issue:** the smoke error pattern `(queque|QueQue): ` matches the question itself. A consent wait that included it could fail with 16 on a partial read.
- **Fix:** the consent pass's first wait omits the error pattern, and the default and c-locale passes keep QQ_TELEMETRY=0. If the question ever leaked into those passes, they would still fail visibly (16).
- **Files modified:** scripts/smoke-distro.exp
- **Commit:** `d2c5adf`

**4. [Rule 2 - Diagnostics] The host failure output tails pty-consent.log**
- **Issue:** without this, a CI failure in the new pass would print no PTY tail.
- **Fix:** scripts/smoke-distro.sh now tails pty-consent.log too. This file was not in `files_modified` (a one-word list change).
- **Commit:** `d2c5adf`

**5. [Rule 3 - Environment] Worktree setup**
- **Fix:** `pnpm install --frozen-lockfile --offline`, with no package added.
- The worktree guard refused `gsd-tools query todo complete`, so the todo was closed with the plan's documented fallback (`git mv` to done/ plus a `completed`/`resolution` frontmatter line).
- The plan ledger was written to `.git/worktrees/<id>/gsd-plan-head-before-10-11`. `commits:` is measured: `git rev-list --count 036cfe0..HEAD` = 5 before this SUMMARY commit.

**6. [Rule 1 - Records] Buglog numbering redone once**
- **Issue:** the first buglog run computed the next id after dropping the hook entries, so new ids reused dropped ones (bug-430..437).
- **Fix:** the file was restored with `git checkout --` and the script rerun with the next id taken from the pre-drop max (452). The new entries are bug-453..460. Recorded in cerebrum Do-Not-Repeat.

**Total deviations:** 6, all auto-fixed: 1 code bug, 3 correctness or diagnostics additions, 2 environment or records fixes. **Impact:** none on the planned interfaces. The extra exported types (`ConsentInput`, `ConsentOutput`, `ConsentIo`, `ShouldAskTelemetryConsentInput`) are additive.

## Issues Encountered

- `.wolf/buglog.json` already had a duplicate `bug-065` id before this plan. It was left untouched as out of scope. The duplicate `bug-428`/`bug-429` ids, from hook entries that collided with the orchestrator's curated ones, are resolved: the hook entries were dropped.
- The SUMMARYs written before 18de580 describe the biome `!!**/.claude` worktree issue as open. It was recorded as resolved (bug-427 plus a note on the cerebrum Do-Not-Repeat line), not as a new defect.

## Known Stubs

None. The Task 1 RED stub was replaced in its GREEN commit.

## OpenWolf entries

Applied in this plan (`67f290f`). No further entries are pending for later plans.

## Next Phase Readiness

- Plan 12 (repo settings, `ci-ok` required) and plan 13 (PostHog EU project and the real key) can proceed. Until plan 13 bakes a key, a "yes" is saved but nothing is sent (D-22).
- Plan 13 Task 1 must confirm with the user that the question is asked even in keyless builds.

## Self-Check: PASSED

- FOUND: src/client/telemetry-consent.ts, tests/telemetry-consent.test.ts, .planning/todos/done/2026-10-13-09.1-stale-prewarm-after-sleep.md
- FOUND commits: 0fa5e03, dde2ec4, fdde4e6, d2c5adf, 67f290f (all ancestors of HEAD)
- MISSING: none
