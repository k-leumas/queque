---
phase: 11-multi-shell-trigger-support-bash-and-fish
plan: 02
subsystem: context-pipeline
tags: [zod, bash, zsh, prompt, providers, vitest]

requires:
  - phase: 11-01
    provides: "SHELL_NAMES / ShellName, shellRequestSchema.shell (default zsh) and shellVersion"
provides:
  - "baseContextSchema.shellName = z.enum(SHELL_NAMES); buildBaseContext copies request.shell"
  - "SHELL_SYNTAX_INSTRUCTION in buildPrompt (src/providers/claude.ts), shared by SDK, claude -p, OpenAI and Ollama"
  - "zsh request.json declares \"shell\": \"zsh\" and a jq-escaped \"shellVersion\""
  - "static provider call-site invariant: every src/providers adapter calls buildPrompt (claude-default delegates)"
affects: [11-05, 11-10, 11-11, phase-12-fish]

actuals:
  tokens: 7000
  tasks: 2
  commits: 4
plan_head_before: b08c7618978639108ba32e175926cfbdcfcba528
plan_head_after: 892433afad828c730f27f15a77db0b12a15a9756

tech-stack:
  added: []
  patterns:
    - "Shell identity flows request.json -> shellRequestSchema.shell -> NormalizedRequest -> BaseContext.shellName -> user prompt; it is an enum at every step"
    - "Per-shell prompt cues go in the user prompt (buildPrompt), never the system prompt, because the claude -p prewarm process is keyed on the system prompt"

key-files:
  created:
    - .planning/phases/11-multi-shell-trigger-support-bash-and-fish/.red/11-02-task1-red.json
    - .planning/phases/11-multi-shell-trigger-support-bash-and-fish/.red/11-02-task2-red.json
  modified:
    - src/contracts/request.ts
    - src/context/base-context.ts
    - shell/zsh/queque.zsh
    - src/providers/claude.ts
    - src/providers/ollama.ts
    - src/providers/openai.ts
    - tests/shell-contract.test.ts
    - tests/zsh-widget.test.ts
    - tests/claude-provider.test.ts

key-decisions:
  - "SHELL_SYNTAX_INSTRUCTION is one generic line naming the shellName field; the system prompt stays shell-independent so one warm claude -p serves every shell"
  - "shellVersion stays out of the base context and the prompt (T-11-09); a test asserts the bash version string never reaches buildPrompt"
  - "The provider call-site invariant matches the literal ': LLMAdapter = {' and allow-lists delegators (claude-default.ts) so a new provider file is covered without editing the test"

patterns-established:
  - "New provider adapters must call buildPrompt( or be added to the delegator allow list in tests/claude-provider.test.ts"

requirements-completed: [BASH-01]

coverage:
  - id: D1
    description: "D-02: the base context names the shell the adapter reported (zsh, bash, fish), rejects anything else, and an old zsh payload still parses as zsh"
    requirement: BASH-01
    verification:
      - kind: unit
        ref: "tests/shell-contract.test.ts#buildBaseContext shellName, baseContextSchema shellName, shellRequestSchema"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-02: the zsh widget writes shell zsh and a jq-escaped shellVersion into request.json"
    requirement: BASH-01
    verification:
      - kind: unit
        ref: "tests/zsh-widget.test.ts#request.json shell fields"
        status: pass
      - kind: other
        ref: "zsh -n shell/zsh/queque.zsh"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-06: the shared user prompt names the shell and asks for its syntax for every provider; the system prompt is identical for zsh and bash"
    requirement: BASH-01
    verification:
      - kind: unit
        ref: "tests/claude-provider.test.ts#shell syntax in the prompt (Phase 11 D-06)"
        status: pass
      - kind: unit
        ref: "pnpm exec vitest run tests/claude-provider.test.ts tests/claude-prewarm.test.ts tests/openai-provider.test.ts tests/ollama-provider.test.ts (195 passed)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Live model output quality: suggestions for a bash request actually use bash syntax"
    verification: []
    human_judgment: true
    rationale: "Whether a hosted model follows the instruction needs a live call; 11-11's live-model UAT covers it"

duration: 9min
completed: 2026-11-14
status: complete
---

# Phase 11 Plan 02: shell identity in the context and prompt Summary

**The shell the adapter reports now flows as a zod enum from request.json through the base context into the user prompt every provider shares. The prompt gains one line that asks for that shell's syntax, and the zsh widget now declares `shell: zsh` itself instead of relying on the schema default.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-11-14T13:05:08Z
- **Completed:** 2026-11-14T13:13:46Z
- **Tasks:** 2 (both TDD: RED then GREEN)
- **Files modified:** 11 (2 RED records created, 9 source and test files modified)

## Accomplishments

- `baseContextSchema.shellName` is now `z.enum(SHELL_NAMES)`, and `buildBaseContext` sets it from `request.shell`. No shared context code hardcodes zsh any more.
- The zsh request heredoc carries `"shell": "zsh",` and `"shellVersion": $(printf '%s' "$ZSH_VERSION" | jq -Rs .),`. `export QQ_ZSH_VERSION` is unchanged.
- `buildPrompt` emits `SHELL_SYNTAX_INSTRUCTION` ("Write every command in the syntax of the shell named in shellName.") right after the safety line. `buildSystemPrompt` and steering.ts are unchanged.
- A static test scans `src/providers/*.ts`. Every `: LLMAdapter = {` file must call `buildPrompt(`, except `claude-default.ts`, which delegates to the other Claude adapters.

## Task Commits

1. **Task 1: the normalized request and base context carry the real shell; the zsh widget declares itself.** RED `b07ae08` (test), GREEN `a024116` (feat)
2. **Task 2: every provider is asked for the current shell's syntax (D-06).** RED `ba07c3c` (test), GREEN `892433a` (feat)

**Plan metadata:** recorded in the SUMMARY commit (docs)

## Files Created/Modified

- `src/contracts/request.ts`: `shellName: z.enum(SHELL_NAMES)`, with a comment naming `request.shell` as the source
- `src/context/base-context.ts`: `shellName: request.shell`
- `shell/zsh/queque.zsh`: the `shell` and `shellVersion` request fields
- `src/providers/claude.ts`: `SHELL_SYNTAX_INSTRUCTION` and its line in `buildPrompt`
- `src/providers/ollama.ts`, `src/providers/openai.ts`: the budget comments now say "the shell adapter reads the FIFO"
- `tests/shell-contract.test.ts`: `shellRequestSchema` shell/shellVersion rows, the `baseContextSchema shellName` and `buildBaseContext shellName` describes
- `tests/zsh-widget.test.ts`: `request.json shell fields` (static check on the heredoc)
- `tests/claude-provider.test.ts`: `shell syntax in the prompt (Phase 11 D-06)`. It covers zsh/bash prompt lines, the line's position, the path through `buildBaseContext`, system-prompt equality and the call-site invariant.
- `.planning/.../.red/11-02-task1-red.json`, `11-02-task2-red.json`: the RED evidence records

## TDD Gate Compliance

- **Task 1 RED** `b07ae08`
  - **Target:** `tests/shell-contract.test.ts > buildBaseContext shellName > copies shell bash from the request`
  - **Classifier:** `RED_EVIDENCE_OK` (`target_test_failed`); the failure message was "expected 'zsh' to be 'bash'"
  - **Semantic assessment:** the target ran and failed on its planned assertion, for the intended reason: `buildBaseContext` returned the hardcoded zsh. The other failing rows had the same cause: `baseContextSchema` accepting bash and fish, and the fish copy.
  - **Rows already passing in RED:** the `shellRequestSchema` rows, because plan 01 had already delivered `shell` and `shellVersion`. The static zsh widget row was meant to fail and did. These rows are kept as regression pins.
- **Task 1 GREEN** `a024116`: all 88 tests in shell-contract, zsh-widget and context-pipeline pass.
- **Task 2 RED** `ba07c3c`
  - **Target:** `tests/claude-provider.test.ts > shell syntax in the prompt (Phase 11 D-06) > puts the instruction in the instruction block, before the Shell context`
  - **Classifier:** `RED_EVIDENCE_OK`; the failure message was "expected -1 to be greater than 4"
  - **Semantic assessment:** the instruction line was missing from the prompt. The RED commit declared the constant as a stub so tsc passes in pre-commit, but did not wire it into `buildPrompt`.
  - **Rows already passing in RED:** system-prompt equality and the call-site invariant. No shell reaches the system prompt today, and all four model adapters already call `buildPrompt`. These are regression pins.
- **Task 2 GREEN** `892433a`: 195 tests pass across the claude, claude-prewarm, openai and ollama provider tests.
- **REFACTOR:** none needed.

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two wrong expectations in my own Task 2 RED tests, fixed in GREEN**
- **Found during:** Task 2 GREEN
- **Issue 1:** the zsh/bash prompt row expected the line `  "shellName": "bash",`. With no git or filesystem chunk, shellName is the last JSON key, so there is no trailing comma. These rows were still red after the implementation.
- **Issue 2:** the call-site scan used the regex `/:\s*LLMAdapter = \{/`. The acceptance grep `grep -cF "LLMAdapter = {"` counts the literal text, and the regex form does not contain it.
- **Fix:** the row now asserts that the prompt contains `"shellName": "<shell>"` and that the instruction is one of the prompt's lines. The scan now uses `.includes(': LLMAdapter = {')`. Both fixes are in the GREEN commit.
- **Files modified:** `tests/claude-provider.test.ts`
- **Verification:** all 4 provider test files pass (195 tests). The acceptance grep prints 1.
- **Committed in:** `892433a`

**2. [TDD stub] `SHELL_SYNTAX_INSTRUCTION` was declared in the Task 2 RED commit**
- The constant needed to exist so `tsc --noEmit` passes in pre-commit (cerebrum 2026-08-26). `buildPrompt` only uses it from GREEN.

---

**Total deviations:** 2. One Rule 1 fix to my own test expectations; one TDD stub following the project convention.
**Impact on plan:** none. No files outside files_modified were touched, apart from the `.red/` evidence records.

## Issues Encountered

- `shellcheck` does not apply to `shell/zsh/queque.zsh`, which is zsh and has no lefthook shellcheck hook. I validated the widget with `zsh -n` instead. I also rendered the new heredoc shape through a throwaway zsh script piped to `jq`, which gave valid JSON with `"shell":"zsh","shellVersion":"5.9"`.

## User Setup Required

None. No external service configuration is required.

## Wolf entries (for the orchestrator to apply in the main checkout)

- **anatomy.md:** no new source files. Update these descriptions:
  - `src/contracts/request.ts`: `baseContextSchema.shellName` is now `z.enum(SHELL_NAMES)`
  - `src/context/base-context.ts`: `shellName` comes from `request.shell`
  - `src/providers/claude.ts`: exports `SHELL_SYNTAX_INSTRUCTION`, a user-prompt line in `buildPrompt`
  - `shell/zsh/queque.zsh`: request.json carries `shell` and `shellVersion`
- **cerebrum Key Learnings:**
  - Shell-specific prompt cues belong in `buildPrompt` (the user prompt). `buildSystemPrompt` must stay shell-independent, because the warm `claude -p` process is keyed on the system-prompt argv (claude-prewarm.ts).
  - `tests/claude-provider.test.ts` statically requires every `: LLMAdapter = {` file in `src/providers/` to call `buildPrompt(`. A new delegating adapter must be added to the test's `delegators` allow list.
  - In `buildPrompt`'s Shell context JSON, `shellName` is the last key unless a git or filesystem chunk follows. Assert `"shellName": "x"` without a trailing comma.
- **cerebrum Do-Not-Repeat (2026-11-14):** when an acceptance criterion greps a literal (`grep -cF "LLMAdapter = {"`), write that literal in the test source. A regex spelling (`LLMAdapter = \{`) does not match `grep -F`.
- **buglog:** none. The only failures were my own new test expectations, before GREEN.
- **memory.md:** `| 13:14 | executed 11-02: shellName enum + buildBaseContext from request.shell, zsh request.json shell fields, SHELL_SYNTAX_INSTRUCTION in buildPrompt, provider call-site invariant | src/contracts/request.ts, src/context/base-context.ts, shell/zsh/queque.zsh, src/providers/claude.ts, tests | 4 commits, 1563 tests green | ~60k |`

## Next Phase Readiness

- Plan 05 (telemetry) can read `request.shell` and `shellVersion`. The base context does not carry the version, and the prompt never sees it.
- Phase 12 (fish) needs no change here: `fish` already parses at every step.
- Deferred, per the plan's review ledger: a per-shell cue table, if live UAT (11-11) or fish shows syntax drift.

## Self-Check: PASSED

- Both `.red/` records exist, and all 9 modified files are in the 4 commits (`b07ae08`, `a024116`, `ba07c3c`, `892433a`) on `worktree-agent-abef3015cfebacee8`.
- Every task 1 and task 2 acceptance criterion was re-run and passes:
  - the request.ts, base-context.ts and zsh-widget greps print 1 / 0 / 1 / 1 / 1
  - `SHELL_SYNTAX_INSTRUCTION` prints 1; `zsh reads the FIFO` prints 0 in both files; `LLMAdapter = {` prints 1; `buildBaseContext` prints 3
  - biome is clean
- Plan-level verification, with `QQ_TEST_BASH=/opt/local/bin/bash`:
  - `pnpm test:run`: 63 files, 1563 tests passed
  - `pnpm typecheck`, `pnpm lint` and `zsh -n shell/zsh/queque.zsh` all exit 0

---
*Phase: 11-multi-shell-trigger-support-bash-and-fish*
*Completed: 2026-11-14*
