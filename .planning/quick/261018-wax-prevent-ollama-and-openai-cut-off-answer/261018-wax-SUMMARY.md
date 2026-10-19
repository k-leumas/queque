---
phase: quick-261018-wax
plan: 01
subsystem: providers
status: complete
tags: [ollama, openai, structured-output, truncation, retry, beta]
requires: []
provides:
  - src/providers/structured-output.ts (MAX_OUTPUT_TOKENS, CANDIDATE_LIST_JSON_SCHEMA, WRAPPED_CANDIDATE_LIST_JSON_SCHEMA, ModelTurn, candidatesWithCutOffRetry)
  - strictCandidateListWithoutProse in src/providers/claude.ts
affects: [ollama adapter, openai adapter, qq init provider menu, README, docs/EXTENSIONS.md]
tech-stack:
  added: []
  patterns:
    - "Non-Claude adapters build one request body, wrap the POST in an inner postChat() on the shared requestSignal, and hand the first ModelTurn plus a retry closure to candidatesWithCutOffRetry"
    - "Hand-written JSON Schema mirrors the zod candidate contract, guarded by a parity test"
key-files:
  created:
    - src/providers/structured-output.ts
    - tests/structured-output.test.ts
  modified:
    - src/providers/claude.ts
    - src/providers/ollama.ts
    - src/providers/openai.ts
    - src/cli/commands/init-provider.ts
    - tests/ollama-provider.test.ts
    - tests/openai-provider.test.ts
    - tests/init-provider.test.ts
    - README.md
    - docs/EXTENSIONS.md
decisions:
  - "A non-stop reply that already parses as a complete schema-valid list (bare or wrapped) is returned without a retry"
  - "When the retry fails for a non-abort reason, the first reply's closed candidates win; otherwise the retry's error surfaces; a user abort always wins"
  - "OpenAI remembers per model (in-process Set) that `low` reasoning_effort was rejected; the retry ladder is none, minimal, low, then omitted only when the first request used low"
  - "OpenAI null content before a non-stop finish is an empty cut-off (retried), not an unexpected response"
metrics:
  duration: ~13 min
  completed: 2026-10-18
plan_base: be9bb14f69b22e72bd17127d0bc27f6961b37d4e
plan_head_before: d0d9829a92f0928740494daf45dc7fc24c846ae8
plan_head_after: bcf64e4
actuals:
  tokens: 15700
  tasks: 3
  commits: 5
---

# Phase quick-261018-wax Plan 01: Prevent Ollama and OpenAI cut-off answers Summary

Ollama now asks for `think: false`, a candidate-array `format` schema and
`num_predict 16000 / num_ctx 20480`. OpenAI asks for a strict `{ candidates }` json_schema,
`max_completion_tokens 16000` and `reasoning_effort low`, and falls back when a model rejects
that value. Both send one silent retry on the same 25 s signal when a reply is cut off. Both
are labelled beta in the picker, README and EXTENSIONS.

## Tasks

| Task | Name | Commits | Files |
| ---- | ---- | ------- | ----- |
| 1 (tracer, TDD) | Ollama structured request + shared cut-off retry | 1157e26 (RED), 1bcfc75 (GREEN) | structured-output.ts, claude.ts, ollama.ts, structured-output.test.ts, ollama-provider.test.ts |
| 2 (TDD) | OpenAI strict schema, effort fallback, cut-off retry | 4796e99 (RED), 4723990 (GREEN) | openai.ts, openai-provider.test.ts |
| 3 | Beta labels in the picker, README, EXTENSIONS | bcf64e4 | init-provider.ts, init-provider.test.ts, README.md, docs/EXTENSIONS.md |

Tracer gate: Task 1's verify command was re-run end to end after GREEN and passed (6 files),
then the Claude-untouched `git diff --quiet be9bb14…` guard exited 0, before Task 2 started.

## Verification

- Full serial suite: `pnpm exec vitest run --maxWorkers=1`: **43 files, 1039 tests passed**
  (70 s, load average ~7-8). No flaky reruns were needed.
- `pnpm typecheck`: clean. `pnpm exec biome check src tests scripts shell docs *.json *.ts`:
  123 files, no findings.
- `git diff --quiet be9bb14f69b22e72bd17127d0bc27f6961b37d4e -- candidate-stream.ts claude-cli.ts
  claude-process.ts claude-default.ts steering.ts + the three Claude test files`: exit 0 (UD-2).
- No `.wolf/` file in any commit (`git show --stat` across d0d9829..HEAD). No Co-Authored-By
  trailers.
- Task 3 doc greps (`OpenAI or Ollama (beta)`, `num_ctx`, at least 2 `(beta)` lines in
  EXTENSIONS): pass.

## TDD Gate Compliance

- Task 1 RED (1157e26): 9/12 structured-output tests and 9 Ollama tests failed (the
  behaviour tests). The schema-parity tests passed because the constants are real by design.
  GREEN (1bcfc75): all pass.
- Task 2 RED (4796e99): 9 OpenAI tests failed. GREEN (4723990): 50/50 pass.

## Deviations from Plan

1. **[Rule 3 - Blocking] `resetOpenAiEffortCache` RED stub is a no-op, not throw-on-call.**
   `beforeEach` calls it, so a throwing stub would have failed every OpenAI test (key handling
   and failure mapping too) and hidden which behaviour tests were really red. The no-op is
   honest, since no cache existed yet. Commit 4796e99.
2. **[Rule 1 - Bug] EXTENSIONS beta label wording.** My first wording, "(both beta)", left only
   one line matching `(beta)`, so the plan's `grep -c '(beta)' >= 2` check failed. The bullet now
   reads ``**An `openai` or `ollama` pin (beta)**``. This was fixed before the Task 3 commit.
3. Tests named in the plan that were already green before GREEN: the wrapped-object parse cases
   in the Ollama parser block passed at RED, because the existing scanner fallback already pulled
   closed objects out of `{"candidates":[...]}`. The strictCandidateListWithoutProse test and
   the adapter tests carried the RED evidence.

No architectural changes, no package installs.

## Known Stubs

None.

## Threat Flags

None. The new surface (the OpenAI 400 reader) reads only `error.param` and the safe `error.code`
(T-261018-wax-02). A test puts `sk-proj-SECRET` in the upstream message and checks that it
appears in no error and no debug-log argument.

## OpenWolf entries (deferred)

Not staged (per orchestrator constraints). Suggested entries:

- anatomy.md: add `src/providers/structured-output.ts`: shared non-Claude structured-output
  seam: MAX_OUTPUT_TOKENS (= SDK_MAX_TOKENS), CANDIDATE_LIST_JSON_SCHEMA (array root),
  WRAPPED_CANDIDATE_LIST_JSON_SCHEMA (`{ candidates }` root), ModelTurn,
  candidatesWithCutOffRetry (one silent retry, closed-candidate fallback, abort wins). ~900 tok.
- anatomy.md: add `tests/structured-output.test.ts`: schema parity vs commandCandidateSchema,
  and the retry decision table (a)-(h). ~1300 tok.
- cerebrum Key Learnings: Ollama and OpenAI adapters share `candidatesWithCutOffRetry`. Each
  adapter's inner `postChat` returns a ModelTurn on the same `requestSignal`, so the retry
  never grows the 25 s budget. A test that expects a retry must give each fetch call a fresh
  Response (`mockResolvedValueOnce` per call or `mockImplementation(async () => ...)`).
- cerebrum Key Learnings: OpenAI `reasoning_effort` fallback keys only on HTTP 400 +
  `error.param === 'reasoning_effort'`, is remembered per model in-process
  (`resetOpenAiEffortCache()` for tests), and never reads `error.message`.
- cerebrum Do-Not-Repeat: a TS `export const X = 'low'` widens to `string` inside an array
  literal; annotate the array (`readonly (Effort | undefined)[]`) or tsc rejects it.
- cerebrum Do-Not-Repeat: in this worktree harness, Bash commands that combine git with
  `$(...)`, heredocs or long chains are refused as "too complex to verify". Run git commands
  alone and use the Edit/Write tools for file edits.
- buglog: none new (no pre-existing bug fixed; the TS widening error was fixed during GREEN).

## Self-Check: PASSED

- FOUND: src/providers/structured-output.ts, tests/structured-output.test.ts
- FOUND commits: 1157e26, 1bcfc75, 4796e99, 4723990, bcf64e4 (all on HEAD)
