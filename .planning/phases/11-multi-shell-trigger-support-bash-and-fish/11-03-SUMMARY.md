---
phase: 11-multi-shell-trigger-support-bash-and-fish
plan: 03
subsystem: tool-awareness
tags: [bash, zsh, fish, tool-handoff, lexer, command-words, vitest, tdd]

requires:
  - phase: 11-01
    provides: "SHELL_NAMES / ShellName and shellRequestSchema.shell (default zsh)"
  - phase: 09
    provides: "tool handoff (commands/builtins/functions.txt), readToolHandoff, hand lexer, missingTools, installed-tools chunk"
provides:
  - "TOOL_HANDOFF_PENDING ('tools.pending'), TOOL_HANDOFF_PENDING_BUDGET_MS (500), TOOL_HANDOFF_PENDING_POLL_MS (10)"
  - "readToolHandoff(sessionDir, { shell?, pendingBudgetMs? }) with the bounded marker wait and debug reason pending-timeout"
  - "run-foreground starts the handoff read with request.json and awaits it right before withInstalledToolsChunk"
  - "RES_EXPECT_BY_SHELL / RES_LOOP_BY_SHELL; extractCommandWords(command, builtins, shell = 'zsh'); commandWords(tokens, builtins, depth = 0, shell = 'zsh')"
  - "ToolInventory.shell; missingTools lexes in the inventory's dialect"
  - "Shell-neutral interactive-mode copy: Run ?? from an interactive shell."
affects: [11-07, 11-10, 11-11, phase-12-fish]

actuals:
  tokens: 13400
  tasks: 2
  commits: 4
plan_head_before: b08c7618978639108ba32e175926cfbdcfcba528
plan_head_after: 9217591b43ad5830c02c494c8b29c82487dd52c8

tech-stack:
  added: []
  patterns:
    - "Optional session-dir marker (tools.pending) that a slow adapter creates before its detached writer and the writer removes last; the client polls with a hard budget and never throws"
    - "Start an I/O promise early, await it at the last consumer (start-early/await-late) so it overlaps startup work"
    - "Per-shell reserved-word tables keyed by ShellName; only set membership differs between dialects, lexHand stays shared"

key-files:
  created:
    - .planning/phases/11-multi-shell-trigger-support-bash-and-fish/.red/11-03-task1-red.json
    - .planning/phases/11-multi-shell-trigger-support-bash-and-fish/.red/11-03-task2-red.json
  modified:
    - src/client/tool-handoff.ts
    - src/client/run-foreground.ts
    - src/shared/command-words.ts
    - src/shared/tool-awareness.ts
    - tests/tool-handoff.test.ts
    - tests/client-result.test.ts
    - tests/command-words.test.ts
    - tests/tool-awareness.test.ts

key-decisions:
  - "The pending budget is a named constant (500 ms), not configuration; tests pass pendingBudgetMs: 100 only to stay fast"
  - "The handoff promise is awaited after gatherContext and right before withInstalledToolsChunk, so one inventory feeds the steering chunk and every annotateCandidates call"
  - "missingTools passes inventory.shell straight through; an absent shell takes the lexer's zsh default"
  - "zsh repeat N now skips the count word (only when the next token is a word), so repeat 3 echo hi yields echo, not a false '3 not installed' flag"
  - "bash command-word tests read builtins from a real `bash -c 'compgen -b'`, mirroring the zsh `${(k)builtins}` source, never a hardcoded list"

patterns-established:
  - "Session-dir pending marker: any adapter whose scan is slow (bash in plan 07, fish in Phase 12) creates tools.pending, starts the writer detached, and the writer removes the marker last"
  - "New shell dialect = add a ShellName key to RES_EXPECT_BY_SHELL and RES_LOOP_BY_SHELL"

requirements-completed: [BASH-01]

coverage:
  - id: D1
    description: "readToolHandoff waits while tools.pending exists (10 ms polls, 500 ms budget), returns null with reason pending-timeout and no tool names after the budget, reads at once without a marker, skips the wait when QQ_TOOL_AWARENESS=0, and keeps the ENOENT degrade path"
    requirement: BASH-01
    verification:
      - kind: unit
        ref: "tests/tool-handoff.test.ts#readToolHandoff: tools.pending marker (D-05) (5 cases) + tags the inventory with the shell it came from"
        status: pass
    human_judgment: false
  - id: D2
    description: "Start-early/await-late: with tools.pending held across ensureDaemon and the files landing only afterwards, the late inventory feeds the installed-tools chunk (rg) and the candidate flags (fd bar -> missingTools ['fd']); control without the marker matches"
    requirement: BASH-01
    verification:
      - kind: integration
        ref: "tests/client-result.test.ts#tools.pending held across ensureDaemon (2 cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Shell-aware lexer: shared cases identical in zsh, bash and fish; noglob, nocorrect, repeat, foreach and end follow zsh rules only for zsh; fish equals bash; zsh default unchanged; fuzz suite green"
    requirement: BASH-01
    verification:
      - kind: unit
        ref: "tests/command-words.test.ts#shell dialects (Phase 11 D-02); tests/command-words-fuzz.test.ts (36 passed)"
        status: pass
    human_judgment: false
  - id: D4
    description: "missingTools reads ToolInventory.shell: noglob fd flags nothing for zsh and flags noglob for bash; an inventory without shell behaves as zsh"
    requirement: BASH-01
    verification:
      - kind: unit
        ref: "tests/tool-awareness.test.ts#reads the inventory shell / treats an inventory without a shell as zsh"
        status: pass
    human_judgment: false
  - id: D5
    description: "End-to-end bash not-installed flags and steering from a real bash ?? (needs plan 07's bash writer)"
    verification: []
    human_judgment: true
    rationale: "The bash side (tools.pending plus the three files) lands in plan 07; this plan only proves the client half"

duration: 14min
completed: 2026-11-14
status: complete
---

# Phase 11 Plan 03: Shell-aware tool handoff and command-word lexer Summary

**The client now waits up to 500 ms on a `tools.pending` marker, so a slow shell-side scan can run alongside Node startup. The handoff read starts with request.json and is awaited just before the installed-tools chunk is built. The command-word lexer and `missingTools` now read bash syntax for bash and zsh syntax for zsh, and fish uses the bash rules for now.**

## Performance

- **Duration:** about 14 min
- **Started:** 2026-11-14T13:05:00Z
- **Completed:** 2026-11-14T13:18:00Z
- **Tasks:** 2, both TDD (RED then GREEN each)
- **Files modified:** 8 source and test files, plus 2 RED evidence records

## Accomplishments

- **D-05 marker wait.** `readToolHandoff` checks for `<sessionDir>/tools.pending` every 10 ms, for at most 500 ms. If the marker is still there after that, it returns null, logs reason `pending-timeout` and never logs tool names. With no marker it reads at once, so zsh behaves exactly as before. The inventory now carries `shell`, taken from the option and defaulting to zsh.
- **Start early, await late.** `run-foreground.ts` starts `readToolHandoff(path.dirname(requestFile), { shell: request.shell })` right after it parses request.json. It awaits the result after `ensureDaemon`, Ink setup and `gatherContext`, right before `withInstalledToolsChunk`. That one inventory feeds the steering chunk and all three `annotateCandidates` calls.
- **D-02 dialect tables.** `RES_EXPECT_BY_SHELL` and `RES_LOOP_BY_SHELL` keep zsh's sets unchanged. bash drops `nocorrect`, `noglob`, `repeat`, `end` and `foreach`, and fish points at the bash sets until Phase 12. Both `commandWords` and `extractCommandWords` take a trailing `shell = 'zsh'`, and recursion keeps the caller's shell.
- **`ToolInventory.shell`.** The doc comments no longer name zsh, and `missingTools` passes `inventory.shell` to the lexer.
- **Copy.** The interactive-mode error is now `Run ?? from an interactive shell.`

## Expected gap until plan 07

Bash not-installed flags and steering will not work until plan 07 lands the bash writer (`tools.pending` plus the three files). Until then, a bash `??` in llm mode finds no inventory (`ENOENT`) and runs without flags. That is expected and does not count as a BASH-01 pass.

## Task Commits

1. **Task 1: `tools.pending` wait, start early, await late.** RED `f4e1eec` (test), GREEN `1a48361` (feat)
2. **Task 2: shell-aware lexer entry point.** RED `908e77b` (test), GREEN `9217591` (feat)

**Plan metadata:** recorded in the SUMMARY commit (docs)

## Files Created/Modified

- `src/client/tool-handoff.ts`: the three constants, `waitWhilePending`, the new `readToolHandoff` signature, and shell-neutral comments for the handoff files (functions.txt also covers fish abbreviations)
- `src/client/run-foreground.ts`: starts the handoff read early and awaits it late; the shell-neutral copy
- `src/shared/command-words.ts`: the per-shell tables, the `shell` parameter, the zsh `repeat` count skip, and module doc updates
- `src/shared/tool-awareness.ts`: `ToolInventory.shell`, shell-neutral docs, and the shell-aware `missingTools`
- `tests/tool-handoff.test.ts`: the marker wait, the timeout, the disabled and ENOENT paths, the constants, and the shell tag
- `tests/client-result.test.ts`: the scheduling test (marker held across `ensureDaemon`) and its control case
- `tests/command-words.test.ts`: `describe.each` over zsh, bash and fish, the dialect cases, and fish matching bash (bash builtins come from a real `compgen -b`)
- `tests/tool-awareness.test.ts`: the bash and zsh inventory cases
- `.planning/.../.red/11-03-task1-red.json`, `11-03-task2-red.json`: the RED evidence records

## TDD Gate Compliance

- **Task 1 RED** `f4e1eec`. The target was `tests/tool-handoff.test.ts > readToolHandoff: tools.pending marker (D-05) > waits for the marker to go and then reads the files the writer left`. It was run with `pnpm --silent exec vitest run tests/tool-handoff.test.ts -t "waits for the marker to go" --reporter=tap-flat` and exited 1. `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK` (`target_test_failed`).
  - **Semantic assessment:** the target ran and failed on its planned `toBe(true)` assertion, for the intended reason: the reader had no wait yet, read at once and got ENOENT. There was no load, syntax or fixture fault.
  - Other cases that failed in RED: the shell tag, the pending timeout, and the scheduling test (`expected [] to have a length of 1`).
  - Cases that passed in RED (unchanged paths): the constants (stub values), the disabled and ENOENT cases, and the control case.
- **Task 1 GREEN** `1a48361`. Both test files pass (66 tests).
  - A mutation check confirmed the scheduling test catches the wrong order: awaiting the read before `ensureDaemon` makes it fail.
- **Task 2 RED** `908e77b`. The target was `tests/command-words.test.ts > shell dialects (Phase 11 D-02) > noglob is a zsh precommand but an ordinary command word in bash`. The classifier returned `RED_EVIDENCE_OK`.
  - **Semantic assessment:** the target failed on its planned `toBe('noglob:external')` assertion, after the zsh half had passed. The cause was the stub parameter that ignored the shell.
  - Other cases that failed in RED: nocorrect, repeat, foreach/end, and the `noglob fd` inventory case.
- **Task 2 GREEN** `9217591`. command-words, fuzz and tool-awareness pass (202 tests).
- **REFACTOR:** none needed.

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] zsh `repeat N cmd` flagged the count as a missing tool**
- **Found during:** Task 2 (probing the existing lexer before writing tests)
- **Issue:** the lexer skipped `repeat` as a reserved word but then treated `3` as an external command word. So `repeat 3 echo hi` returned `3:external`, and `missingTools` reported "3 not installed". The plan's behaviour list requires zsh to yield `echo` as the command word.
- **Fix:** after a reserved `repeat` (zsh table only), skip the next token if it is a word. In bash, `repeat` is an ordinary command word and this branch never runs.
- **Files modified:** `src/shared/command-words.ts`
- **Verification:** the `repeat N runs the next word in zsh` case passes, the 40-case spike table, the 09-REVIEW table and the fuzz suite are green, and `repeat; ls` still yields `ls` thanks to the word guard.
- **Committed in:** `9217591`
- **Note:** this is the one place where zsh output differs from before the plan, and only for `repeat <word>`. All other zsh results are unchanged, because the zsh tables hold exactly the old sets.

**2. [Plan ordering] `ToolInventory.shell` was added in Task 1 instead of Task 2**
- Task 1's behaviour list requires the inventory's `shell` to be set from the option, so the field (a Task 2 file) landed in the Task 1 RED commit as a type stub. Task 2 added its doc comment and the `missingTools` use. No files outside `files_modified` were touched.

---

**Total deviations:** 1 auto-fixed bug (Rule 1) and 1 ordering note.
**Impact on plan:** none on scope. Both stay inside this plan's files.

## Issues Encountered

- **Fuzz timeouts in the full suite under load.** In the full `pnpm test:run`, two crafted fuzz inputs in `tests/command-words-fuzz.test.ts` (`echo "unterminated` and ``echo `whoami``) hit their 1 s per-child kill at about 1012 ms. The load average was 82 because the three sibling executors were running suites at the same time.
  - Run alone, the file passes 36/36, and it also passed in the Task 2 run.
  - The time goes to spawning Node child processes, not to lexing. Treated as a load flake, not a regression.
- **Plan-level verification:** apart from that flake, 1573 of 1575 tests passed with `PATH=/opt/local/bin:$PATH QQ_TEST_BASH=/opt/local/bin/bash`; `pnpm typecheck` and `pnpm lint` exit 0.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- Plan 07 can now write the bash side: create `tools.pending`, start the `compgen` writer detached, and have it write the three files and remove the marker last. The client already waits up to 500 ms and overlaps that wait with startup.
- Phase 12 (fish) adds a `fish` table to `RES_EXPECT_BY_SHELL` / `RES_LOOP_BY_SHELL` (`begin`, `end`, `and`, `or`, `not`) and writes abbreviations into functions.txt. The handoff format does not change.

## Wolf entries

To be applied by the orchestrator. Nothing under `.wolf/` was committed from this worktree.

- **anatomy.md:**
  - `tool-handoff.ts`: readToolHandoff(sessionDir, { shell, pendingBudgetMs }). It waits while `tools.pending` exists (10 ms poll, 500 ms budget, then null with reason pending-timeout) and reads commands/builtins/functions.txt into a ToolInventory tagged with `shell`, or null (disabled, missing, empty). Logs carry counts only. Exports TOOL_HANDOFF_FILES, TOOL_HANDOFF_PENDING, TOOL_HANDOFF_PENDING_BUDGET_MS and TOOL_HANDOFF_PENDING_POLL_MS.
  - `command-words.ts`: append "per-shell RES_EXPECT_BY_SHELL / RES_LOOP_BY_SHELL (zsh reference; bash drops noglob, nocorrect, repeat, end, foreach; fish = bash until Phase 12), trailing `shell = 'zsh'` on commandWords and extractCommandWords, zsh `repeat N` skips the count (11-03)".
  - `tool-awareness.ts`: append "ToolInventory.shell; missingTools passes inventory.shell to the lexer (11-03)".
  - `client-result.test.ts`: append "describe `tools.pending held across ensureDaemon` (11-03): the ensureDaemon override records the marker and writes the files 50 ms later; asserts the installed-tools chunk and missingTools".
  - `command-words.test.ts`: append "describe `shell dialects (Phase 11 D-02)` with bash builtins from a real `compgen -b`".
- **cerebrum.md, Key Learnings:**
  - [2026-11-14] An `expect` inside a mocked `ensureDaemon` never fails a runForegroundClient test, because run-foreground catches ensureDaemon errors (WR-12 fallback). Record a flag in the mock and assert it after the run.
  - [2026-11-14] To pin start-early/await-late, hold a marker that only a later step (here the ensureDaemon mock) removes. An eager await then times out and the test fails. Check this with a one-line mutation before trusting the test.
  - [2026-11-14] `src/shared/command-words.ts` may only use `import type`: the fuzz child imports the .ts file directly with Node type stripping, which erases type imports but cannot resolve a runtime `../contracts/shell.js` import.
- **cerebrum.md, Do-Not-Repeat:**
  - [2026-11-14] The command-words fuzz test's crafted inputs have a 1 s per-child kill that includes Node startup. When parallel executors push the load average to about 80, they time out at about 1010 ms. Rerun the file alone before treating that as a lexer regression.
- **buglog.json:**
  - `{ error_message: "repeat 3 echo hi flagged '3' as a missing tool (zsh)", file: "src/shared/command-words.ts", root_cause: "repeat was skipped as a reserved word but its count was then read as the command word", fix: "after a reserved repeat, skip the next word token (zsh table only)", tags: ["lexer","zsh","repeat","missing-tools"] }`
  - `{ error_message: "command-words-fuzz crafted inputs exceeded 1 s in the full suite", file: "tests/command-words-fuzz.test.ts", root_cause: "the per-child kill includes Node startup; load average 82 from parallel executors", fix: "none; the file passes alone (36/36). Load flake", tags: ["fuzz","flake","load","vitest"] }`
- **memory.md:** `| 13:18 | 11-03: tools.pending wait + start-early/await-late handoff; per-shell lexer tables, ToolInventory.shell | tool-handoff.ts, run-foreground.ts, command-words.ts, tool-awareness.ts + 4 tests | 4 commits, suite green except a load flake | ~13k |`

## Self-Check: PASSED

- Files exist: src/client/tool-handoff.ts, src/client/run-foreground.ts, src/shared/command-words.ts, src/shared/tool-awareness.ts, the four test files, and both RED records.
- Commits on this branch: f4e1eec, 1a48361, 908e77b and 9217591 (`git rev-list --count b08c761..HEAD` = 4).
- Acceptance criteria for Tasks 1 and 2 were re-run and all pass. That covers the budget line, `pending-timeout`, `{ shell: request.shell }`, the copy, the await order (ensureDaemon 185 < await 303 < withInstalledToolsChunk 304), the `tools.pending`/`missingTools` greps, the RES_*_BY_SHELL counts, the `shell: ShellName = 'zsh'` count, `readonly shell?: ShellName`, and biome on all seven listed files.
